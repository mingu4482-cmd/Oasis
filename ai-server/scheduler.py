import json
import logging
import os
import re
import socket
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import requests
from apscheduler.schedulers.blocking import BlockingScheduler
from dotenv import load_dotenv

from schemas.risk_schema import RiskForecastRequest
from services.risk_predictor import build_risk_forecast


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def configure_utf8_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")


configure_utf8_stdio()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True,
)
logger = logging.getLogger("oasis-ai-scheduler")

LOG_PREFIX = "[OASIS Scheduler]"
SEOUL_LOG_FIELDS = ("GU_NM", "RF_NM", "SE_NM", "PSTN_INFO")

SEOUL_RAINFALL_API_KEY = os.getenv("SEOUL_RAINFALL_API_KEY", "")
SEOUL_DRAINPIPE_API_KEY = os.getenv("SEOUL_DRAINPIPE_API_KEY", "")
KMA_API_KEY = os.getenv("KMA_API_KEY", "")
SEOUL_OPEN_API_BASE_URL = os.getenv("SEOUL_OPEN_API_BASE_URL", "http://openAPI.seoul.go.kr:8088")
KMA_FORECAST_URL = os.getenv(
    "KMA_FORECAST_URL",
    "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst",
)
SEOUL_RAINFALL_SERVICE = os.getenv("SEOUL_RAINFALL_SERVICE", "ListRainfallService")
SEOUL_DRAINPIPE_SERVICE = os.getenv("SEOUL_DRAINPIPE_SERVICE", "DrainpipeMonitoringInfo")
EXPRESS_BASE_URL = os.getenv("EXPRESS_BASE_URL", "http://localhost:4000").rstrip("/")
COLLECT_INTERVAL_SECONDS = int(os.getenv("COLLECT_INTERVAL_SECONDS", "600"))
TARGET_GU_NAME = os.getenv("TARGET_GU_NAME", "강남구")
REQUEST_TIMEOUT_SECONDS = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "10"))
KMA_RATE_LIMIT_COOLDOWN_SECONDS = int(os.getenv("KMA_RATE_LIMIT_COOLDOWN_SECONDS", "900"))
KMA_REQUEST_INTERVAL_SECONDS = float(os.getenv("KMA_REQUEST_INTERVAL_SECONDS", "1.2"))
KMA_MAX_WORKERS = max(1, int(os.getenv("KMA_MAX_WORKERS", "4")))
SCHEDULER_LOCK_PORT = int(os.getenv("SCHEDULER_LOCK_PORT", "49171"))
DANGER_WATER_LEVEL_M = float(os.getenv("DANGER_WATER_LEVEL_M", "1.0"))
DRAINPIPE_MAX_WORKERS = max(1, int(os.getenv("DRAINPIPE_MAX_WORKERS", "25")))

REGION_GRID = {
    "강남구": {"nx": 61, "ny": 125},
    "서초구": {"nx": 61, "ny": 125},
    "관악구": {"nx": 59, "ny": 125},
    "동작구": {"nx": 59, "ny": 125},
    "영등포구": {"nx": 58, "ny": 126},
    "구로구": {"nx": 58, "ny": 125},
    "양천구": {"nx": 58, "ny": 126},
    "마포구": {"nx": 59, "ny": 127},
    "성동구": {"nx": 61, "ny": 127},
    "광진구": {"nx": 62, "ny": 126},
}

REGION_KEYWORDS = {
    "강남구": ["강남구", "역삼", "대치", "개포", "논현", "삼성", "청담", "압구정", "신사", "수서", "일원", "세곡"],
    "서초구": ["서초구", "서초", "반포", "잠원", "방배", "양재", "내곡"],
    "관악구": ["관악구", "봉천", "신림", "남현"],
    "동작구": ["동작구", "노량진", "상도", "사당", "대방", "흑석"],
    "영등포구": ["영등포구", "영등포", "여의도", "문래", "당산", "대림"],
    "구로구": ["구로구", "구로", "고척", "개봉", "오류"],
    "양천구": ["양천구", "목동", "신월", "신정"],
    "마포구": ["마포구", "마포", "공덕", "상암", "성산", "합정"],
    "성동구": ["성동구", "성수", "왕십리", "금호", "옥수"],
    "광진구": ["광진구", "자양", "구의", "중곡", "화양"],
}

FALLBACK_PAYLOAD = {
    "rainfall": 0.0,
    "waterLevel": 20.0,
    "drainageLevel": 75.0,
    "waterLevelRiseRate": 0.0,
    "forecastRainfall1h": 0.0,
    "forecastRainfall2h": 0.0,
    "forecastRainfall3h": 0.0,
}

DATA_STATUS_LABELS = {
    "REALTIME": "실시간 API 기반 분석",
    "PARTIAL": "일부 데이터가 수집되지 않아 분석 신뢰도가 낮습니다.",
    "FALLBACK": "fallback 데이터가 포함되어 참고용 상태만 제공합니다.",
    "UNAVAILABLE": "핵심 데이터가 부족해 위험도 계산을 보류했습니다.",
}

KMA_FORECAST_CACHE: dict[tuple[int, int], tuple[str, str, list[float]]] = {}
KMA_RATE_LIMITED_UNTIL: datetime | None = None
SCHEDULER_LOCK_SOCKET: socket.socket | None = None


def acquire_scheduler_lock() -> bool:
    global SCHEDULER_LOCK_SOCKET

    # UDP has no TCP TIME_WAIT state, so a scheduler that was just stopped can
    # restart immediately without being mistaken for a still-running process.
    lock_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        lock_socket.bind(("127.0.0.1", SCHEDULER_LOCK_PORT))
    except OSError:
        lock_socket.close()
        return False

    SCHEDULER_LOCK_SOCKET = lock_socket
    return True


def mask_key(value: str) -> str:
    return f"{value[:4]}****" if value else "missing"


def log_loaded_keys() -> None:
    logger.info("%s rainfall api key loaded: %s", LOG_PREFIX, mask_key(SEOUL_RAINFALL_API_KEY))
    logger.info("%s drainpipe api key loaded: %s", LOG_PREFIX, mask_key(SEOUL_DRAINPIPE_API_KEY))
    logger.info("%s kma api key loaded: %s", LOG_PREFIX, mask_key(KMA_API_KEY))


def parse_float(value: Any) -> float | None:
    if value is None:
        return None
    matches = re.findall(r"-?\d+(?:\.\d+)?", str(value))
    if not matches:
        return None
    return float(matches[0])


def parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    text = str(value).strip()
    for fmt in (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y%m%d%H%M%S",
        "%Y%m%d%H",
    ):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def parse_rainfall(value: Any) -> float:
    if value is None:
        return 0.0
    text = str(value).strip()
    if not text or "강수없음" in text or "없음" in text:
        return 0.0
    if "1mm 미만" in text:
        return 0.5
    numbers = [float(match) for match in re.findall(r"\d+(?:\.\d+)?", text)]
    if not numbers:
        return 0.0
    return sum(numbers) / len(numbers)


def parse_seoul_response(response: requests.Response) -> dict[str, Any]:
    response.encoding = "utf-8"
    try:
        payload = response.json()
    except ValueError:
        text = response.content.decode("utf-8", errors="replace")
        payload = json.loads(text)
    if not isinstance(payload, dict):
        raise RuntimeError("Seoul API response is not JSON object")
    return payload


def log_seoul_result(name: str, service: str, result: dict[str, Any]) -> None:
    message = result.get("MESSAGE")
    logger.info(
        "%s %s RESULT.CODE=%s RESULT.MESSAGE=%s",
        LOG_PREFIX,
        service,
        result.get("CODE"),
        message,
    )


def request_seoul_api(name: str, api_key: str, service: str, path_suffix: str = "1/100/") -> dict[str, Any]:
    url = f"{SEOUL_OPEN_API_BASE_URL}/{api_key}/json/{service}/{path_suffix}"
    response = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
    payload = None
    try:
        payload = parse_seoul_response(response)
    except (UnicodeDecodeError, ValueError):
        payload = None

    logger.info("%s %s status: %s", LOG_PREFIX, name, response.status_code)

    response.raise_for_status()
    if not isinstance(payload, dict):
        raise RuntimeError(f"{name} response is not JSON object")
    return payload


def extract_service_rows(payload: dict[str, Any], service: str) -> list[dict[str, Any]]:
    service_payload = payload.get(service)
    if isinstance(service_payload, dict):
        result = service_payload.get("RESULT")
        if isinstance(result, dict):
            log_seoul_result("Seoul API", service, result)
            code = str(result.get("CODE", ""))
            if code and code != "INFO-000":
                raise RuntimeError(f"{service} error: {result}")
        rows = service_payload.get("row", [])
        if isinstance(rows, dict):
            return [rows]
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, dict)]
        return []

    result = payload.get("RESULT")
    if isinstance(result, dict):
        log_seoul_result("Seoul API", service, result)
        code = str(result.get("CODE", ""))
        if code and code != "INFO-000":
            raise RuntimeError(f"{service} error: {result}")
    return []


def summarize_row(row: dict[str, Any]) -> dict[str, Any]:
    summary = {key: row[key] for key in list(row.keys())[:10]}
    for field in SEOUL_LOG_FIELDS:
        if field in row:
            summary[field] = row[field]
    return summary


def row_sort_key(row: dict[str, Any], time_field: str, value_field: str) -> tuple[datetime, float]:
    measured_at = parse_datetime(row.get(time_field)) or datetime.min
    value = parse_float(row.get(value_field))
    return measured_at, value if value is not None else -1.0


def fetch_rainfall_rows() -> list[dict[str, Any]]:
    if not SEOUL_RAINFALL_API_KEY:
        raise RuntimeError("SEOUL_RAINFALL_API_KEY is missing")

    payload = request_seoul_api("Seoul rainfall API", SEOUL_RAINFALL_API_KEY, SEOUL_RAINFALL_SERVICE)
    rows = extract_service_rows(payload, SEOUL_RAINFALL_SERVICE)
    if not rows:
        raise RuntimeError("Seoul rainfall API row is empty")
    logger.info("%s Seoul rainfall API success. rows=%s", LOG_PREFIX, len(rows))
    return rows


def fetch_drainpipe_rows() -> list[dict[str, Any]]:
    if not SEOUL_DRAINPIPE_API_KEY:
        raise RuntimeError("SEOUL_DRAINPIPE_API_KEY is missing")

    end_dt = datetime.now()
    start_dt = end_dt - timedelta(hours=1)
    start_time = start_dt.strftime("%Y%m%d%H")
    end_time = end_dt.strftime("%Y%m%d%H")
    all_rows: list[dict[str, Any]] = []

    def fetch_district(code: int) -> tuple[str, list[dict[str, Any]]]:
        se_cd = f"{code:02d}"
        path_suffix = f"1/500/{se_cd}/{start_time}/{end_time}"
        payload = request_seoul_api(
            f"Seoul drainpipe API SE_CD {se_cd}",
            SEOUL_DRAINPIPE_API_KEY,
            SEOUL_DRAINPIPE_SERVICE,
            path_suffix,
        )
        return se_cd, extract_service_rows(payload, SEOUL_DRAINPIPE_SERVICE)

    with ThreadPoolExecutor(max_workers=DRAINPIPE_MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_district, code): code for code in range(1, 26)}
        for future in as_completed(futures):
            se_cd = f"{futures[future]:02d}"
            try:
                _, rows = future.result()
                all_rows.extend(rows)
            except Exception as error:
                logger.warning("%s drainpipe SE_CD %s failed. error=%s", LOG_PREFIX, se_cd, error)

    if not all_rows:
        raise RuntimeError("Seoul drainpipe API row is empty for all SE_CD")

    logger.info("%s Seoul drainpipe API success. total drainpipe rows: %s", LOG_PREFIX, len(all_rows))
    return all_rows


def build_rainfall_map(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        gu_name = str(row.get("GU_NM", "")).strip()
        if not gu_name:
            continue
        if parse_float(row.get("RN_10M")) is None:
            continue
        grouped.setdefault(gu_name, []).append(row)

    result = {}
    for gu_name, region_rows in grouped.items():
        selected = max(region_rows, key=lambda row: row_sort_key(row, "DATA_CLCT_TM", "RN_10M"))
        result[gu_name] = {
            "rainfall": max(parse_float(selected.get("RN_10M")) or 0.0, 0.0),
            "rainfallStation": selected.get("RF_NM") or selected.get("RF_CD") or "-",
            "rainfallObservedAt": selected.get("DATA_CLCT_TM"),
            "rainfallRow": summarize_row(selected),
        }
    return result


def calculate_drainpipe_rise_rate(rows: list[dict[str, Any]], selected_row: dict[str, Any]) -> float:
    unq_no = selected_row.get("UNQ_NO")
    if not unq_no:
        return 0.0

    samples: list[tuple[datetime, float]] = []
    for row in rows:
        if row.get("UNQ_NO") != unq_no:
            continue
        measured_at = parse_datetime(row.get("MSRMT_YMD"))
        raw_level = parse_float(row.get("MSRMT_WATL"))
        if measured_at is not None and raw_level is not None:
            samples.append((measured_at, raw_level))

    if len(samples) < 2:
        return 0.0

    samples.sort(key=lambda sample: sample[0])
    oldest_time, oldest_level = samples[0]
    latest_time, latest_level = samples[-1]
    elapsed_hours = max((latest_time - oldest_time).total_seconds() / 3600, 1 / 60)
    return round(max((latest_level - oldest_level) / elapsed_hours, 0.0), 2)


def normalize_se_nm_to_region(value: Any) -> str:
    name = str(value or "").strip()
    if not name:
        return ""
    if name.endswith("구"):
        return name
    return f"{name}구"


def build_drainpipe_map(rows: list[dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], dict[str, Any] | None]:
    parsed_rows = [row for row in rows if parse_float(row.get("MSRMT_WATL")) is not None]
    if not parsed_rows:
        return {}, None

    latest_global = max(parsed_rows, key=lambda row: row_sort_key(row, "MSRMT_YMD", "MSRMT_WATL"))
    logger.info("%s total drainpipe rows: %s", LOG_PREFIX, len(parsed_rows))

    result = {}
    for region in REGION_GRID:
        keywords = REGION_KEYWORDS.get(region, [region])
        se_nm_matches = [
            row
            for row in parsed_rows
            if normalize_se_nm_to_region(row.get("SE_NM")) == region
        ]
        keyword_matches = [
            row
            for row in parsed_rows
            if any(keyword in str(row.get("PSTN_INFO", "")) for keyword in keywords)
        ]
        matches = se_nm_matches or keyword_matches
        if not matches:
            continue
        selected = max(matches, key=lambda row: row_sort_key(row, "MSRMT_YMD", "MSRMT_WATL"))
        raw_water_level = max(parse_float(selected.get("MSRMT_WATL")) or 0.0, 0.0)
        result[region] = {
            "rawWaterLevel": raw_water_level,
            "waterLevel": min(100.0, max(0.0, round((raw_water_level / DANGER_WATER_LEVEL_M) * 100, 1))),
            "waterLevelRiseRate": calculate_drainpipe_rise_rate(parsed_rows, selected),
            "drainpipeStation": selected.get("SE_NM") or selected.get("UNQ_NO") or "-",
            "drainpipeMeasuredAt": selected.get("MSRMT_YMD"),
            "drainpipePosition": selected.get("PSTN_INFO"),
            "drainpipeRow": summarize_row(selected),
            "usesFallbackDrainpipe": False,
            "fallbackReason": None,
        }

    return result, latest_global


def drainpipe_from_fallback_row(row: dict[str, Any] | None) -> dict[str, Any]:
    if not row:
        return {
            "rawWaterLevel": None,
            "waterLevel": FALLBACK_PAYLOAD["waterLevel"],
            "waterLevelRiseRate": FALLBACK_PAYLOAD["waterLevelRiseRate"],
            "drainpipeStation": "fallback mock",
            "drainpipeMeasuredAt": None,
            "drainpipePosition": None,
            "usesFallbackDrainpipe": True,
            "fallbackReason": "하수관로 관측값이 없어 fallback 값을 사용했습니다.",
        }

    raw_water_level = max(parse_float(row.get("MSRMT_WATL")) or 0.0, 0.0)
    return {
        "rawWaterLevel": raw_water_level,
        "waterLevel": FALLBACK_PAYLOAD["waterLevel"],
        "waterLevelRiseRate": 0.0,
        "drainpipeStation": row.get("SE_NM") or row.get("UNQ_NO") or "latest Seoul drainpipe",
        "drainpipeMeasuredAt": row.get("MSRMT_YMD"),
        "drainpipePosition": row.get("PSTN_INFO"),
        "usesFallbackDrainpipe": True,
        "fallbackReason": "선택 지역의 하수관로 관측값이 없어 중립 fallback 수위로 보정했습니다.",
    }


def get_kma_base_time(now: datetime) -> tuple[str, str]:
    base = now - timedelta(minutes=45)
    return base.strftime("%Y%m%d"), base.strftime("%H30")


def fetch_kma_forecast_rainfall(nx: int, ny: int) -> list[float]:
    global KMA_RATE_LIMITED_UNTIL

    if not KMA_API_KEY:
        raise RuntimeError("KMA_API_KEY is missing")

    base_date, base_time = get_kma_base_time(datetime.now())
    cached = KMA_FORECAST_CACHE.get((nx, ny))
    if cached and cached[0] == base_date and cached[1] == base_time:
        logger.info("%s KMA forecast cache hit. nx=%s ny=%s", LOG_PREFIX, nx, ny)
        return list(cached[2])

    now = datetime.now()
    if KMA_RATE_LIMITED_UNTIL and now < KMA_RATE_LIMITED_UNTIL:
        raise RuntimeError("KMA forecast API rate-limit cooldown is active")

    response = requests.get(
        KMA_FORECAST_URL,
        params={
            "serviceKey": KMA_API_KEY,
            "pageNo": 1,
            "numOfRows": 1000,
            "dataType": "JSON",
            "base_date": base_date,
            "base_time": base_time,
            "nx": nx,
            "ny": ny,
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code == 429:
        KMA_RATE_LIMITED_UNTIL = now + timedelta(seconds=KMA_RATE_LIMIT_COOLDOWN_SECONDS)
        raise RuntimeError("KMA forecast API rate limit exceeded")
    response.raise_for_status()

    payload = response.json()
    items = payload.get("response", {}).get("body", {}).get("items", {}).get("item", [])
    if isinstance(items, dict):
        items = [items]

    values = [
        parse_rainfall(item.get("fcstValue"))
        for item in items
        if item.get("category") in ("RN1", "PCP")
    ][:3]

    if not values:
        raise RuntimeError("Could not parse KMA forecast API response")
    while len(values) < 3:
        values.append(0.0)

    KMA_FORECAST_CACHE[(nx, ny)] = (base_date, base_time, list(values))
    KMA_RATE_LIMITED_UNTIL = None
    logger.info("%s KMA forecast API success. nx=%s ny=%s", LOG_PREFIX, nx, ny)
    return values


def build_forecast_map() -> tuple[dict[str, list[float]], set[str]]:
    forecast_by_grid: dict[tuple[int, int], list[float]] = {}
    failed_grids: set[tuple[int, int]] = set()
    forecast_by_region: dict[str, list[float]] = {}
    failed_regions: set[str] = set()

    grid_keys = {(grid["nx"], grid["ny"]) for grid in REGION_GRID.values()}
    with ThreadPoolExecutor(max_workers=KMA_MAX_WORKERS) as executor:
        futures = {
            executor.submit(fetch_kma_forecast_rainfall, *grid_key): grid_key
            for grid_key in grid_keys
        }
        for future in as_completed(futures):
            grid_key = futures[future]
            try:
                forecast_by_grid[grid_key] = future.result()
            except Exception as error:
                logger.warning("%s KMA forecast API failed. nx=%s ny=%s error=%s", LOG_PREFIX, *grid_key, error)
                failed_grids.add(grid_key)

    for region, grid in REGION_GRID.items():
        grid_key = (grid["nx"], grid["ny"])
        if grid_key in forecast_by_grid:
            forecast_by_region[region] = forecast_by_grid[grid_key]
        else:
            forecast_by_region[region] = [0.0, 0.0, 0.0]
            failed_regions.add(region)

    return forecast_by_region, failed_regions


def source_from_success(success_count: int) -> str:
    if success_count == 3:
        return "realtime api"
    if success_count == 0:
        return "fallback mock"
    return "partial realtime api"


def data_status_from_success(rainfall_success: bool, drainpipe_success: bool, forecast_success: bool) -> str:
    success_count = int(rainfall_success) + int(drainpipe_success) + int(forecast_success)
    if success_count == 3:
        return "REALTIME"
    if not rainfall_success and not drainpipe_success:
        return "UNAVAILABLE"
    if success_count > 0:
        return "PARTIAL"
    return "FALLBACK"


def build_payload_from_input(payload: dict[str, Any], source: str) -> dict[str, Any]:
    forecast_input = RiskForecastRequest(**payload)
    prediction = build_risk_forecast(forecast_input)
    return {
        "rainfall": forecast_input.rainfall,
        "rainfallUnit": "mm/10min",
        "waterLevel": forecast_input.waterLevel,
        "drainageLevel": forecast_input.drainageLevel,
        "waterLevelRiseRate": forecast_input.waterLevelRiseRate,
        "forecastRainfall1h": forecast_input.forecastRainfall1h,
        "forecastRainfall2h": forecast_input.forecastRainfall2h,
        "forecastRainfall3h": forecast_input.forecastRainfall3h,
        "forecastStatus": forecast_input.forecastStatus,
        "riskScore": prediction.riskScore,
        "riskLabel": prediction.riskLabel,
        "confidence": prediction.confidence,
        "message": prediction.message,
        "reasons": prediction.reasons,
        "points": [point.model_dump() for point in prediction.points],
        "modelVersion": prediction.modelVersion,
        "source": source,
        "timestamp": datetime.now().isoformat(),
    }


def build_region_status(
    region: str,
    rainfall_map: dict[str, dict[str, Any]],
    drainpipe_map: dict[str, dict[str, Any]],
    latest_drainpipe_row: dict[str, Any] | None,
    forecast_map: dict[str, list[float]],
    failed_forecast_regions: set[str],
) -> dict[str, Any]:
    warnings = []

    rainfall_meta = rainfall_map.get(region)
    rainfall_success = rainfall_meta is not None
    if rainfall_meta:
        rainfall = rainfall_meta["rainfall"]
    else:
        rainfall = FALLBACK_PAYLOAD["rainfall"]
        rainfall_meta = {"rainfallStation": "fallback mock", "rainfallObservedAt": None}
        warnings.append("선택 지역의 강우량 관측값이 없어 fallback 값을 사용했습니다.")

    drainpipe_meta = drainpipe_map.get(region)
    drainpipe_success = drainpipe_meta is not None
    if not drainpipe_meta:
        drainpipe_meta = drainpipe_from_fallback_row(latest_drainpipe_row)
        fallback_reason = drainpipe_meta.get("fallbackReason")
        if fallback_reason:
            warnings.append(fallback_reason)

    forecast = forecast_map[region]
    forecast_success = region not in failed_forecast_regions
    forecast_status = "OK" if forecast_success else "FAILED"
    if not forecast_success:
        warnings.append("선택 지역의 기상청 예보 조회에 실패해 예보값을 표시하지 않습니다.")

    success_count = int(rainfall_success) + int(drainpipe_success) + int(forecast_success)
    source = source_from_success(success_count)
    data_status = data_status_from_success(rainfall_success, drainpipe_success, forecast_success)
    water_level = drainpipe_meta["waterLevel"]
    drainage_level = max(0.0, min(100.0, round(100.0 - water_level, 1)))
    payload = build_payload_from_input(
        {
            "rainfall": rainfall,
            "waterLevel": water_level,
            "drainageLevel": drainage_level,
            "waterLevelRiseRate": drainpipe_meta["waterLevelRiseRate"],
            "forecastRainfall1h": forecast[0],
            "forecastRainfall2h": forecast[1],
            "forecastRainfall3h": forecast[2],
            "forecastStatus": forecast_status,
            "source": source,
        },
        source,
    )

    # Confidence represents source completeness, not how high the risk score is.
    payload["confidence"] = {3: 0.95, 2: 0.65, 1: 0.40, 0: 0.0}[success_count]

    if data_status == "UNAVAILABLE":
        payload["riskScore"] = 0
        payload["riskLabel"] = "SAFE"
        payload["confidence"] = 0
        payload["message"] = "해당 지역은 현재 실시간 데이터가 부족하여 AI 위험도 분석을 제공할 수 없습니다."
        payload["points"] = []
    elif data_status == "FALLBACK":
        payload["confidence"] = 0.0

    grid = REGION_GRID[region]
    return {
        **payload,
        "hasData": True,
        "dataStatus": data_status,
        "dataStatusMessage": DATA_STATUS_LABELS[data_status],
        "targetAreaName": region,
        "rainfallStation": rainfall_meta.get("rainfallStation"),
        "rainfallObservedAt": rainfall_meta.get("rainfallObservedAt"),
        "drainpipeStation": drainpipe_meta.get("drainpipeStation"),
        "drainpipeMeasuredAt": drainpipe_meta.get("drainpipeMeasuredAt"),
        "drainpipePosition": drainpipe_meta.get("drainpipePosition"),
        "rawWaterLevel": drainpipe_meta.get("rawWaterLevel"),
        "forecastGrid": grid,
        "warnings": warnings,
        "fallbackReason": drainpipe_meta.get("fallbackReason"),
    }


def build_live_status_payload() -> dict[str, Any]:
    logger.info("%s collecting regional live data...", LOG_PREFIX)
    default_region = TARGET_GU_NAME if TARGET_GU_NAME in REGION_GRID else "강남구"

    try:
        rainfall_map = build_rainfall_map(fetch_rainfall_rows())
    except Exception as error:
        logger.warning("%s Seoul rainfall API failed. Using fallback rainfall. error=%s", LOG_PREFIX, error)
        rainfall_map = {}

    try:
        drainpipe_map, latest_drainpipe_row = build_drainpipe_map(fetch_drainpipe_rows())
    except Exception as error:
        logger.warning("%s Seoul drainpipe API failed. Using fallback water level. error=%s", LOG_PREFIX, error)
        drainpipe_map, latest_drainpipe_row = {}, None

    forecast_map, failed_forecast_regions = build_forecast_map()

    region_status_map = {
        region: build_region_status(
            region,
            rainfall_map,
            drainpipe_map,
            latest_drainpipe_row,
            forecast_map,
            failed_forecast_regions,
        )
        for region in REGION_GRID
    }

    logger.info("%s regional payload built. regions=%s default=%s", LOG_PREFIX, len(region_status_map), default_region)
    logger.info("%s source: %s", LOG_PREFIX, region_status_map[default_region]["source"])
    return {
        "hasData": True,
        "mode": "regional",
        "defaultRegion": default_region,
        "regions": list(REGION_GRID.keys()),
        "regionStatusMap": region_status_map,
        "timestamp": datetime.now().isoformat(),
    }


def send_live_status_to_express(payload: dict[str, Any]) -> None:
    url = f"{EXPRESS_BASE_URL}/api/update-live-status"
    for attempt in range(1, 16):
        try:
            logger.info("%s posting to %s", LOG_PREFIX, url)
            response = requests.post(url, json=payload, timeout=5)
            if response.status_code == 200:
                logger.info("%s update-live-status success", LOG_PREFIX)
                return
            logger.warning(
                "%s update-live-status failed. attempt=%s status=%s body=%s",
                LOG_PREFIX,
                attempt,
                response.status_code,
                response.text,
            )
        except Exception as error:
            logger.warning("%s update-live-status failed. attempt=%s error=%s", LOG_PREFIX, attempt, error)
        time.sleep(2)

    logger.error("%s update-live-status failed after retries", LOG_PREFIX)


def collect_and_predict() -> None:
    payload = build_live_status_payload()
    send_live_status_to_express(payload)


def start_scheduler() -> None:
    if not acquire_scheduler_lock():
        logger.warning(
            "%s another scheduler is already running. port=%s",
            LOG_PREFIX,
            SCHEDULER_LOCK_PORT,
        )
        return

    log_loaded_keys()
    logger.info("%s started", LOG_PREFIX)
    scheduler = BlockingScheduler(timezone="Asia/Seoul")
    scheduler.add_job(collect_and_predict, "interval", seconds=COLLECT_INTERVAL_SECONDS, next_run_time=datetime.now())
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("%s stopped", LOG_PREFIX)


if __name__ == "__main__":
    start_scheduler()
