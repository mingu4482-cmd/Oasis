"""
OASIS MCP Server
도시 침수 대응 자동화 에이전트

Tools:
  [기존]
  - get_current_status        : 센서 현황 조회
  - generate_response_manual  : AI 대응 보고서 생성
  - send_slack_alert          : Slack 알림 발송
  - run_oasis_alert           : 위 3개 통합 실행

  [신규]
  - get_multi_location_status : 다중 위치 일괄 조회
  - assess_flood_risk         : 복합 위험도 분석
  - generate_checklist        : 대응 체크리스트 생성
  - send_sms_alert            : SMS 긴급 경보 발송 (Solapi)
  - send_kakao_alert          : 카카오 알림톡 발송
  - create_incident_report    : 사고 보고서 PDF 생성
  - log_incident              : 사건 이력 DB 기록
  - get_safe_shelters         : 주변 대피소 조회
  - get_weather_forecast      : 기상청 예보 조회
  - broadcast_emergency       : 전채널 동시 경보
  - get_incident_history      : 사건 이력 조회
"""

from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv
from openai import OpenAI
import requests
import os
import json
import sqlite3
import hashlib
from datetime import datetime
from typing import Optional

try:
    from solapi import SolapiMessageService
    from solapi.model import RequestMessage
except ImportError:
    SolapiMessageService = None
    RequestMessage = None

load_dotenv()

mcp = FastMCP("OASIS MCP Server")

# ── 환경 변수 ──────────────────────────────────────────
OPENAI_API_KEY      = os.getenv("OPENAI_API_KEY")
SLACK_WEBHOOK_URL   = os.getenv("SLACK_WEBHOOK_URL")
SOLAPI_API_KEY      = os.getenv("SOLAPI_API_KEY")         # 솔라피 API Key
SOLAPI_API_SECRET   = os.getenv("SOLAPI_API_SECRET")      # 솔라피 API Secret
SOLAPI_FROM_NUMBER  = os.getenv("SOLAPI_FROM_NUMBER")     # 솔라피에 등록된 발신번호 (01012345678 형식)
KAKAO_API_KEY       = os.getenv("KAKAO_API_KEY")
KAKAO_SENDER_KEY    = os.getenv("KAKAO_SENDER_KEY")
PUBLIC_DATA_KEY     = os.getenv("PUBLIC_DATA_KEY")       # 공공데이터포털 API 키
WEATHER_API_KEY     = os.getenv("WEATHER_API_KEY")       # 기상청 API 키
DB_PATH             = os.getenv("DB_PATH", "oasis_incidents.db")

client = OpenAI(api_key=OPENAI_API_KEY)

# ── 위험도 상수 ────────────────────────────────────────
RISK_THRESHOLDS = {
    "안전":  {"water_level": 30, "rainfall": 10, "rise_rate": 5},
    "주의":  {"water_level": 50, "rainfall": 20, "rise_rate": 10},
    "경계":  {"water_level": 70, "rainfall": 30, "rise_rate": 15},
    "위험":  {"water_level": 85, "rainfall": 40, "rise_rate": 20},
    "심각":  {"water_level": 95, "rainfall": 50, "rise_rate": 25},
}

# ── DB 초기화 ──────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id          TEXT PRIMARY KEY,
            location_id TEXT NOT NULL,
            location_name TEXT,
            risk_level  TEXT,
            water_level REAL,
            rainfall    REAL,
            rise_rate   REAL,
            status      TEXT DEFAULT 'ACTIVE',
            created_at  TEXT,
            resolved_at TEXT,
            notes       TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS alert_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id TEXT,
            channel     TEXT,
            message     TEXT,
            success     INTEGER,
            sent_at     TEXT
        )
    """)
    conn.commit()
    conn.close()

init_db()


# ═══════════════════════════════════════════════════════
# [기존] 1. 현황 조회
# ═══════════════════════════════════════════════════════
@mcp.tool()
def get_current_status(location_id: str) -> dict:
    """
    지정 위치의 현재 침수 센서 데이터를 반환합니다.
    실제 운영 시 InfluxDB / FastAPI 센서 API로 교체하세요.
    """
    # TODO: 실제 센서 API 연동
    # response = requests.get(f"{SENSOR_API_URL}/status/{location_id}")
    # return response.json()

    MOCK_DATA = {
        "gangnam-001": {
            "location_id":    location_id,
            "location_name":  "강남역 1번 출구",
            "risk_level":     "위험",
            "water_level":    85,
            "rainfall":       32,
            "rise_rate":      15,
            "recent_change":  "최근 10분간 수위 15% 상승",
            "lat": 37.4979,
            "lng": 127.0276,
            "updated_at":     datetime.now().isoformat(),
        },
        "seocho-002": {
            "location_id":    location_id,
            "location_name":  "서초구청 앞 사거리",
            "risk_level":     "경계",
            "water_level":    68,
            "rainfall":       25,
            "rise_rate":      8,
            "recent_change":  "최근 30분간 수위 완만히 상승",
            "lat": 37.4837,
            "lng": 127.0324,
            "updated_at":     datetime.now().isoformat(),
        },
    }
    return MOCK_DATA.get(location_id, {
        "location_id":   location_id,
        "location_name": f"위치 {location_id}",
        "risk_level":    "안전",
        "water_level":   20,
        "rainfall":      5,
        "rise_rate":     1,
        "recent_change": "정상 범위",
        "updated_at":    datetime.now().isoformat(),
    })


# ═══════════════════════════════════════════════════════
# [기존] 2. AI 대응 보고서 생성
# ═══════════════════════════════════════════════════════
@mcp.tool()
def generate_response_manual(status: dict) -> str:
    """
    센서 현황 데이터를 받아 GPT로 Slack용 대응 보고서를 생성합니다.
    """
    prompt = f"""
너는 도시 침수 재난 대응 AI 에이전트야.

아래 데이터를 보고 Slack에 보낼 긴급 대응 보고서를 작성해줘.

위치: {status.get("location_name", "알 수 없음")}
위험 단계: {status.get("risk_level", "-")}
현재 수위: {status.get("water_level", 0)}%
시간당 강수량: {status.get("rainfall", 0)}mm
수위 상승 속도: {status.get("rise_rate", 0)}%/10min
최근 변화: {status.get("recent_change", "-")}

형식:
🚨 제목 (위험 단계 포함)
📊 실시간 상황 브리핑 (3줄 이내)
📋 즉각 대응 체크리스트 3개 (번호 목록)
⏰ 조치 기한: 상황에 맞게 명시

마지막 줄: 'OASIS MCP AI 에이전트가 자동 생성했습니다. ({datetime.now().strftime("%Y-%m-%d %H:%M")})'
"""
    response = client.responses.create(
        model="gpt-4.1-mini",
        input=prompt
    )
    return response.output_text


# ═══════════════════════════════════════════════════════
# [기존] 3. Slack 알림 발송
# ═══════════════════════════════════════════════════════
@mcp.tool()
def send_slack_alert(message: str, channel: Optional[str] = None) -> dict:
    """
    Slack Webhook으로 메시지를 전송합니다.
    channel 파라미터로 채널 오버라이드 가능 (Incoming Webhook 설정 필요).
    """
    if not SLACK_WEBHOOK_URL:
        return {"success": False, "message": "SLACK_WEBHOOK_URL이 .env에 없습니다."}

    payload = {"text": message}
    if channel:
        payload["channel"] = channel

    response = requests.post(SLACK_WEBHOOK_URL, json=payload, timeout=10)
    success = response.status_code == 200

    _log_alert("system", "slack", message, success)

    return {
        "success":     success,
        "status_code": response.status_code,
        "message":     "Slack 전송 완료" if success else response.text,
    }


# ═══════════════════════════════════════════════════════
# [기존] 4. 통합 경보 실행
# ═══════════════════════════════════════════════════════
@mcp.tool()
def run_oasis_alert(location_id: str) -> dict:
    """
    get_current_status → generate_response_manual → send_slack_alert
    를 순서대로 실행하는 단일 진입점 툴.
    """
    status       = get_current_status(location_id)
    manual       = generate_response_manual(status)
    slack_result = send_slack_alert(manual)

    return {
        "status":       status,
        "manual":       manual,
        "slack_result": slack_result,
    }


# ═══════════════════════════════════════════════════════
# [신규] 5. 다중 위치 일괄 조회
# ═══════════════════════════════════════════════════════
@mcp.tool()
def get_multi_location_status(location_ids: list[str]) -> dict:
    """
    여러 위치 ID를 한 번에 조회해 요약 리포트를 반환합니다.
    위험도 높은 순으로 정렬됩니다.

    Args:
        location_ids: 조회할 위치 ID 리스트 (예: ["gangnam-001", "seocho-002"])

    Returns:
        locations: 각 위치 상태 리스트 (위험도 내림차순)
        summary: 전체 통계 (총 위치 수, 위험 단계별 카운트, 최고 위험 위치)
    """
    RISK_ORDER = {"심각": 5, "위험": 4, "경계": 3, "주의": 2, "안전": 1}

    statuses = [get_current_status(loc_id) for loc_id in location_ids]
    statuses.sort(key=lambda s: RISK_ORDER.get(s.get("risk_level", "안전"), 0), reverse=True)

    risk_count = {}
    for s in statuses:
        level = s.get("risk_level", "안전")
        risk_count[level] = risk_count.get(level, 0) + 1

    return {
        "locations": statuses,
        "summary": {
            "total":          len(statuses),
            "risk_breakdown": risk_count,
            "highest_risk":   statuses[0] if statuses else None,
            "checked_at":     datetime.now().isoformat(),
        },
    }


# ═══════════════════════════════════════════════════════
# [신규] 6. 복합 위험도 분석
# ═══════════════════════════════════════════════════════
@mcp.tool()
def assess_flood_risk(
    water_level: float,
    rainfall: float,
    rise_rate: float,
    soil_saturation: float = 50.0,
    upstream_risk: float = 0.0,
) -> dict:
    """
    수위·강수량·상승속도·토양포화도·상류위험도를 종합해 침수 위험도를 산출합니다.

    Args:
        water_level:     현재 수위 (%, 0~100)
        rainfall:        시간당 강수량 (mm)
        rise_rate:       수위 상승 속도 (%/10min)
        soil_saturation: 토양 포화도 (%, 기본 50)
        upstream_risk:   상류 위험 지수 (0~100, 기본 0)

    Returns:
        risk_score: 종합 위험 점수 (0~100)
        risk_level: 위험 단계 (안전/주의/경계/위험/심각)
        action:     권장 행동 요령
        factors:    각 요인별 기여도
    """
    w_water    = water_level    * 0.40
    w_rainfall = min(rainfall / 50 * 100, 100) * 0.25
    w_rise     = min(rise_rate / 25 * 100, 100) * 0.20
    w_soil     = soil_saturation * 0.10
    w_upstream = upstream_risk   * 0.05

    score = w_water + w_rainfall + w_rise + w_soil + w_upstream
    score = round(min(score, 100), 1)

    if score >= 85:
        level, action = "심각", "즉시 대피 명령 발령 및 도로 통제"
    elif score >= 70:
        level, action = "위험", "대피 권고 및 배수펌프 최대 가동"
    elif score >= 55:
        level, action = "경계", "현장 순찰 강화 및 배수펌프 가동 준비"
    elif score >= 40:
        level, action = "주의", "지속 모니터링 및 대응팀 대기"
    else:
        level, action = "안전", "정상 모니터링 유지"

    return {
        "risk_score": score,
        "risk_level": level,
        "action":     action,
        "factors": {
            "water_level":     round(w_water, 1),
            "rainfall":        round(w_rainfall, 1),
            "rise_rate":       round(w_rise, 1),
            "soil_saturation": round(w_soil, 1),
            "upstream_risk":   round(w_upstream, 1),
        },
    }


# ═══════════════════════════════════════════════════════
# [신규] 7. 대응 체크리스트 생성
# ═══════════════════════════════════════════════════════
@mcp.tool()
def generate_checklist(
    risk_level: str,
    location_name: str,
    target_role: str = "현장요원",
) -> dict:
    """
    위험 단계와 대상 역할에 맞는 대응 체크리스트를 생성합니다.

    Args:
        risk_level:   위험 단계 (안전/주의/경계/위험/심각)
        location_name: 위치명
        target_role:  체크리스트 대상 (현장요원/관제센터/시민, 기본: 현장요원)

    Returns:
        checklist: 단계별 체크리스트 항목 리스트
        priority:  우선순위 액션 3개
        deadline:  각 단계 기한
    """
    CHECKLISTS = {
        "심각": {
            "현장요원": [
                "□ 즉시 대피 명령 방송 실시",
                "□ 도로 통제 바리케이드 설치",
                "□ 비상 배수펌프 풀 가동 (3대 이상)",
                "□ 119 구조대 출동 요청",
                "□ 지하공간 잠금 조치 확인",
                "□ 맨홀 역류 방지 차단 설치",
                "□ 인명피해 여부 즉시 보고",
            ],
            "관제센터": [
                "□ 재난안전본부 즉시 보고",
                "□ 전 채널 긴급 경보 발령",
                "□ CCTV 24시간 집중 모니터링",
                "□ 유관기관 (소방·경찰·구청) 공조 연락",
                "□ 언론사 재난 브리핑 자료 준비",
                "□ 피해 현황 실시간 대시보드 갱신",
            ],
            "시민": [
                "□ 즉시 고지대로 대피",
                "□ 지하주차장·지하도 진입 금지",
                "□ 119/120 신고 준비",
                "□ 재난문자 확인 및 가족 연락",
            ],
        },
        "위험": {
            "현장요원": [
                "□ 대피 권고 방송 실시",
                "□ 배수펌프 최대 출력 가동",
                "□ 저지대 차량 이동 안내",
                "□ 배수구 막힘 여부 점검",
                "□ 수위 5분 단위 보고",
            ],
            "관제센터": [
                "□ 구청·소방서 선제 연락",
                "□ 경보 레벨 '위험'으로 격상",
                "□ 현장 CCTV 집중 관찰",
                "□ Slack/SMS 경보 발송",
            ],
            "시민": [
                "□ 대피 준비 (필수품 챙기기)",
                "□ 지하공간 이용 자제",
                "□ 재난문자 주의 모니터링",
            ],
        },
        "경계": {
            "현장요원": [
                "□ 배수펌프 가동 준비 완료",
                "□ 현장 순찰 주기 30분으로 단축",
                "□ 주요 배수구 사전 점검",
                "□ 대응팀 집합 및 대기",
            ],
            "관제센터": [
                "□ 경보 레벨 '경계' 설정",
                "□ 주의 알림 Slack 발송",
                "□ 예보 데이터 30분 단위 점검",
            ],
            "시민": [
                "□ 침수 취약 지역 이동 자제",
                "□ 재난문자 수신 설정 확인",
            ],
        },
        "주의": {
            "현장요원": [
                "□ 수위 지속 모니터링",
                "□ 배수펌프 점검",
                "□ 위험 지역 사전 순찰",
            ],
            "관제센터": [
                "□ 모니터링 주기 강화",
                "□ 기상 예보 확인",
            ],
            "시민": ["□ 기상 정보 확인"],
        },
        "안전": {
            "현장요원": ["□ 정기 점검 유지"],
            "관제센터": ["□ 정상 모니터링"],
            "시민": ["□ 기상 정보 확인"],
        },
    }

    DEADLINES = {
        "심각": "즉시 (0~10분)",
        "위험": "10분 이내",
        "경계": "30분 이내",
        "주의": "1시간 이내",
        "안전": "다음 정기 점검 시",
    }

    items = CHECKLISTS.get(risk_level, CHECKLISTS["안전"]).get(
        target_role, ["□ 상황 모니터링 유지"]
    )

    return {
        "location":  location_name,
        "risk_level": risk_level,
        "target_role": target_role,
        "deadline":  DEADLINES.get(risk_level, "-"),
        "checklist": items,
        "priority":  items[:3],
        "generated_at": datetime.now().isoformat(),
    }


# ═══════════════════════════════════════════════════════
# [신규] 8. SMS 긴급 경보 발송 (Solapi)
# ═══════════════════════════════════════════════════════
@mcp.tool()
def send_sms_alert(
    phone_numbers: list[str],
    location_name: str,
    risk_level: str,
    message: Optional[str] = None,
) -> dict:
    """
    Solapi를 통해 긴급 SMS를 대량 발송합니다.
    공식 SDK(solapi)가 설치되어 있으면 SDK로, 없으면 REST API(HMAC 서명)로 직접 호출합니다.

    Args:
        phone_numbers: 수신자 전화번호 리스트 (예: ["01012345678"], 하이픈 없는 형식)
        location_name: 침수 위치명
        risk_level:    위험 단계
        message:       커스텀 메시지 (None이면 자동 생성)

    Returns:
        sent:   성공 발송 수
        failed: 실패 발송 수
        results: 번호별 발송 결과
    """
    if not all([SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_FROM_NUMBER]):
        return {
            "success": False,
            "message": "Solapi 환경 변수(SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_FROM_NUMBER)가 설정되지 않았습니다.",
        }

    RISK_EMOJI = {"심각": "🆘", "위험": "🚨", "경계": "⚠️", "주의": "📢", "안전": "✅"}
    emoji = RISK_EMOJI.get(risk_level, "🚨")
    default_msg = (
        f"{emoji} [OASIS 침수경보] {location_name} 현재 {risk_level} 단계입니다. "
        f"침수 위험 지역 접근을 삼가고 안전한 곳으로 이동하세요. "
        f"문의: 120 ({datetime.now().strftime('%H:%M')})"
    )
    sms_body = message or default_msg

    results = []
    sent, failed = 0, 0

    if SolapiMessageService is not None:
        # ── SDK 방식 (권장) ──────────────────────────────
        service = SolapiMessageService(api_key=SOLAPI_API_KEY, api_secret=SOLAPI_API_SECRET)
        for number in phone_numbers:
            try:
                msg = RequestMessage(from_=SOLAPI_FROM_NUMBER, to=number, text=sms_body)
                resp = service.send(msg)
                success = resp.group_info.count.registered_success > 0
                results.append({"number": number[-4:] + "****", "success": success})
                if success:
                    sent += 1
                else:
                    failed += 1
                _log_alert("system", "sms", sms_body, success)
            except Exception as e:
                results.append({"number": number[-4:] + "****", "success": False, "error": str(e)})
                failed += 1
    else:
        # ── REST API 직접 호출 방식 (SDK 미설치 시 폴백) ──
        import hmac
        import time
        import uuid as uuid_lib

        for number in phone_numbers:
            try:
                date = datetime.utcnow().isoformat()
                salt = uuid_lib.uuid4().hex
                signature = hmac.new(
                    SOLAPI_API_SECRET.encode(), (date + salt).encode(), hashlib.sha256
                ).hexdigest()

                resp = requests.post(
                    "https://api.solapi.com/messages/v4/send",
                    headers={
                        "Authorization": f"HMAC-SHA256 apiKey={SOLAPI_API_KEY}, date={date}, salt={salt}, signature={signature}",
                        "Content-Type": "application/json",
                    },
                    json={"message": {"from": SOLAPI_FROM_NUMBER, "to": number, "text": sms_body}},
                    timeout=10,
                )
                success = resp.status_code == 200
                results.append({"number": number[-4:] + "****", "success": success})
                if success:
                    sent += 1
                else:
                    failed += 1
                _log_alert("system", "sms", sms_body, success)
            except Exception as e:
                results.append({"number": number[-4:] + "****", "success": False, "error": str(e)})
                failed += 1

    return {
        "sent":    sent,
        "failed":  failed,
        "total":   len(phone_numbers),
        "message": sms_body,
        "results": results,
    }


# ═══════════════════════════════════════════════════════
# [신규] 9. 카카오 알림톡 발송
# ═══════════════════════════════════════════════════════
@mcp.tool()
def send_kakao_alert(
    phone_numbers: list[str],
    location_name: str,
    risk_level: str,
    checklist: Optional[list[str]] = None,
) -> dict:
    """
    카카오 알림톡으로 대피 안내를 발송합니다.
    (카카오 비즈메시지 API 사용)

    Args:
        phone_numbers: 수신자 전화번호 리스트
        location_name: 침수 위치명
        risk_level:    위험 단계
        checklist:     포함할 체크리스트 항목 (선택)

    Returns:
        sent:   성공 발송 수
        failed: 실패 발송 수
    """
    if not KAKAO_API_KEY or not KAKAO_SENDER_KEY:
        return {
            "success": False,
            "message": "KAKAO_API_KEY 또는 KAKAO_SENDER_KEY가 설정되지 않았습니다.",
        }

    checklist_text = ""
    if checklist:
        checklist_text = "\n".join(f"  {item}" for item in checklist[:3])

    template_message = (
        f"[OASIS 침수경보]\n\n"
        f"📍 위치: {location_name}\n"
        f"⚠️ 위험 단계: {risk_level}\n"
        f"🕐 발령 시각: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
        f"\n대응 조치:\n{checklist_text or '안전한 곳으로 이동하세요.'}\n\n"
        f"자세한 안내: oasis.kr/safe-route"
    )

    results = []
    sent, failed = 0, 0

    for number in phone_numbers:
        try:
            resp = requests.post(
                "https://kapi.kakao.com/v1/api/talk/friends/message/default/send",
                headers={"Authorization": f"Bearer {KAKAO_API_KEY}"},
                json={
                    "receiver_uuids": [number],
                    "template_object": {
                        "object_type": "text",
                        "text": template_message,
                        "link": {"web_url": "https://oasis.kr/safe-route"},
                    },
                },
                timeout=10,
            )
            success = resp.status_code == 200
            results.append({"number": number[-4:] + "****", "success": success})
            if success:
                sent += 1
            else:
                failed += 1
        except Exception as e:
            results.append({"number": number[-4:] + "****", "success": False, "error": str(e)})
            failed += 1

    return {"sent": sent, "failed": failed, "total": len(phone_numbers)}


# ═══════════════════════════════════════════════════════
# [신규] 10. 사고 보고서 생성 (JSON 구조 + Markdown)
# ═══════════════════════════════════════════════════════
@mcp.tool()
def create_incident_report(
    status: dict,
    checklist: Optional[list[str]] = None,
    actions_taken: Optional[list[str]] = None,
) -> dict:
    """
    침수 사고 공식 보고서를 생성합니다.
    Markdown 형식으로 반환되며 PDF 변환에 사용할 수 있습니다.

    Args:
        status:         센서 현황 데이터 (get_current_status 결과)
        checklist:      수행한 체크리스트 항목
        actions_taken:  실제 취한 조치 내역

    Returns:
        report_id:  보고서 고유 ID
        markdown:   Markdown 보고서 전문
        summary:    AI 생성 3줄 요약
    """
    now = datetime.now()
    report_id = f"RPT-{now.strftime('%Y%m%d')}-{hashlib.md5(status.get('location_id','').encode()).hexdigest()[:6].upper()}"

    checklist_md = "\n".join(f"- {item}" for item in (checklist or []))
    actions_md   = "\n".join(f"- {a}" for a in (actions_taken or []))

    markdown = f"""# OASIS 침수 대응 보고서
**보고서 ID**: {report_id}
**작성 일시**: {now.strftime('%Y년 %m월 %d일 %H:%M')}
**작성 주체**: OASIS MCP AI 에이전트 (자동 생성)

---

## 1. 사고 개요

| 항목 | 내용 |
|------|------|
| 발생 위치 | {status.get('location_name', '-')} |
| 위치 ID | {status.get('location_id', '-')} |
| 위험 단계 | **{status.get('risk_level', '-')}** |
| 발생 시각 | {status.get('updated_at', now.isoformat())} |

## 2. 센서 데이터

| 지표 | 수치 |
|------|------|
| 현재 수위 | {status.get('water_level', '-')}% |
| 시간당 강수량 | {status.get('rainfall', '-')}mm/h |
| 수위 상승 속도 | {status.get('rise_rate', '-')}%/10min |
| 최근 변화 | {status.get('recent_change', '-')} |

## 3. 대응 체크리스트

{checklist_md or '- 기록 없음'}

## 4. 조치 내역

{actions_md or '- 기록 없음'}

## 5. 종합 평가 및 권고

> 이 섹션은 AI가 자동 생성한 내용으로, 담당자 검토 후 확정하시기 바랍니다.

---
*본 보고서는 OASIS MCP AI 에이전트에 의해 자동 생성되었습니다.*
*보고서 ID: {report_id} | 생성 시각: {now.strftime('%Y-%m-%d %H:%M:%S')}*
"""

    prompt = f"""
다음 침수 사고 데이터를 3줄로 요약해줘.
위치: {status.get('location_name')}
위험 단계: {status.get('risk_level')}
수위: {status.get('water_level')}%, 강수량: {status.get('rainfall')}mm/h
상승 속도: {status.get('rise_rate')}%/10min
요약은 간결하고 공문서 어투로 작성해줘.
"""
    summary_resp = client.responses.create(model="gpt-4.1-mini", input=prompt)
    summary = summary_resp.output_text.strip()

    return {
        "report_id": report_id,
        "markdown":  markdown,
        "summary":   summary,
        "created_at": now.isoformat(),
    }


# ═══════════════════════════════════════════════════════
# [신규] 11. 사건 이력 DB 기록
# ═══════════════════════════════════════════════════════
@mcp.tool()
def log_incident(
    location_id: str,
    status: dict,
    notes: Optional[str] = None,
) -> dict:
    """
    침수 사건을 SQLite DB에 기록합니다.
    중복 사건은 업데이트 처리됩니다.

    Args:
        location_id: 위치 ID
        status:      센서 현황 데이터
        notes:       추가 메모

    Returns:
        incident_id: 사건 고유 ID
        action:      'created' 또는 'updated'
    """
    now = datetime.now().isoformat()
    incident_id = f"INC-{location_id}-{datetime.now().strftime('%Y%m%d')}"

    conn = sqlite3.connect(DB_PATH)
    existing = conn.execute(
        "SELECT id FROM incidents WHERE id = ?", (incident_id,)
    ).fetchone()

    if existing:
        conn.execute(
            """UPDATE incidents SET
                risk_level=?, water_level=?, rainfall=?, rise_rate=?, notes=?
               WHERE id=?""",
            (
                status.get("risk_level"),
                status.get("water_level"),
                status.get("rainfall"),
                status.get("rise_rate"),
                notes,
                incident_id,
            ),
        )
        action = "updated"
    else:
        conn.execute(
            """INSERT INTO incidents
               (id, location_id, location_name, risk_level, water_level, rainfall, rise_rate, status, created_at, notes)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                incident_id,
                location_id,
                status.get("location_name"),
                status.get("risk_level"),
                status.get("water_level"),
                status.get("rainfall"),
                status.get("rise_rate"),
                "ACTIVE",
                now,
                notes,
            ),
        )
        action = "created"

    conn.commit()
    conn.close()
    return {"incident_id": incident_id, "action": action, "recorded_at": now}


# ═══════════════════════════════════════════════════════
# [신규] 12. 주변 대피소 조회
# ═══════════════════════════════════════════════════════
@mcp.tool()
def get_safe_shelters(
    lat: float,
    lng: float,
    radius_km: float = 2.0,
) -> dict:
    """
    지정 좌표 반경 내 대피소 목록을 조회합니다.
    행정안전부 공공데이터포털 API 사용.

    Args:
        lat:        위도
        lng:        경도
        radius_km:  탐색 반경 (km, 기본 2.0)

    Returns:
        shelters: 대피소 목록 (거리순 정렬)
        count:    조회된 대피소 수
    """
    if not PUBLIC_DATA_KEY:
        # 공공데이터 키 없을 때 목 데이터 반환
        return {
            "shelters": [
                {
                    "name":     "강남구민회관",
                    "address":  "서울 강남구 삼성로 212",
                    "lat":      37.5088,
                    "lng":      127.0612,
                    "capacity": 500,
                    "distance_km": 0.85,
                    "type":     "임시대피소",
                },
                {
                    "name":     "대치초등학교",
                    "address":  "서울 강남구 대치동 316",
                    "lat":      37.4952,
                    "lng":      127.0606,
                    "capacity": 300,
                    "distance_km": 1.2,
                    "type":     "임시대피소",
                },
            ],
            "count":   2,
            "note":    "PUBLIC_DATA_KEY 미설정 — 목 데이터 반환",
            "radius_km": radius_km,
        }

    try:
        resp = requests.get(
            "https://apis.data.go.kr/1741000/EmergencyShelter/getEmergencyShelterList",
            params={
                "serviceKey": PUBLIC_DATA_KEY,
                "numOfRows":  10,
                "pageNo":     1,
                "type":       "json",
            },
            timeout=10,
        )
        data = resp.json()
        items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])

        def haversine(lat1, lng1, lat2, lng2):
            import math
            R = 6371
            dlat = math.radians(lat2 - lat1)
            dlng = math.radians(lng2 - lng1)
            a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
            return R * 2 * math.asin(math.sqrt(a))

        shelters = []
        for item in items:
            s_lat = float(item.get("lat", 0))
            s_lng = float(item.get("lon", 0))
            dist  = haversine(lat, lng, s_lat, s_lng)
            if dist <= radius_km:
                shelters.append({
                    "name":        item.get("rn_adres", "알 수 없음"),
                    "address":     item.get("rn_adres", "-"),
                    "lat":         s_lat,
                    "lng":         s_lng,
                    "capacity":    int(item.get("shelt_cap", 0)),
                    "distance_km": round(dist, 2),
                    "type":        item.get("shelt_se_nm", "대피소"),
                })

        shelters.sort(key=lambda x: x["distance_km"])
        return {"shelters": shelters, "count": len(shelters), "radius_km": radius_km}

    except Exception as e:
        return {"success": False, "message": f"API 오류: {str(e)}"}


# ═══════════════════════════════════════════════════════
# [신규] 13. 기상청 단기 예보 조회
# ═══════════════════════════════════════════════════════
@mcp.tool()
def get_weather_forecast(
    nx: int = 61,
    ny: int = 125,
) -> dict:
    """
    기상청 단기예보 API로 3시간 이내 강수 예보를 조회합니다.
    기본 좌표는 서울 강남구 격자 (nx=61, ny=125)입니다.

    Args:
        nx: 기상청 격자 X 좌표 (기본 61: 강남구)
        ny: 기상청 격자 Y 좌표 (기본 125: 강남구)

    Returns:
        forecast:      1시간 단위 예보 리스트
        max_rainfall:  예보 기간 최대 강수량
        flood_risk:    강수 기반 침수 위험 평가
    """
    if not WEATHER_API_KEY:
        return {
            "forecast": [
                {"time": "+1h", "rainfall": 12.5, "sky": "흐림",  "wind": 3.2},
                {"time": "+2h", "rainfall": 28.0, "sky": "비",    "wind": 4.1},
                {"time": "+3h", "rainfall": 35.5, "sky": "폭우",  "wind": 5.8},
            ],
            "max_rainfall": 35.5,
            "flood_risk":   "경계",
            "note":         "WEATHER_API_KEY 미설정 — 목 데이터 반환",
        }

    now = datetime.now()
    base_date = now.strftime("%Y%m%d")
    base_time = f"{(now.hour - now.hour % 3):02d}00"

    try:
        resp = requests.get(
            "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst",
            params={
                "serviceKey": WEATHER_API_KEY,
                "numOfRows":  50,
                "pageNo":     1,
                "dataType":   "JSON",
                "base_date":  base_date,
                "base_time":  base_time,
                "nx":         nx,
                "ny":         ny,
            },
            timeout=10,
        )
        items = resp.json()["response"]["body"]["items"]["item"]

        pcp_items = [i for i in items if i["category"] == "PCP"]
        forecast  = []
        for i, item in enumerate(pcp_items[:3]):
            val = item.get("fcstValue", "0")
            mm  = 0.0 if val in ["강수없음", "-"] else float(str(val).replace("mm", ""))
            forecast.append({"time": f"+{i+1}h", "rainfall": mm})

        max_rainfall = max((f["rainfall"] for f in forecast), default=0)
        if max_rainfall >= 30:
            flood_risk = "위험"
        elif max_rainfall >= 20:
            flood_risk = "경계"
        elif max_rainfall >= 10:
            flood_risk = "주의"
        else:
            flood_risk = "안전"

        return {"forecast": forecast, "max_rainfall": max_rainfall, "flood_risk": flood_risk}

    except Exception as e:
        return {"success": False, "message": f"기상청 API 오류: {str(e)}"}


# ═══════════════════════════════════════════════════════
# [신규] 14. 전채널 동시 경보 (오케스트레이터)
# ═══════════════════════════════════════════════════════
@mcp.tool()
def broadcast_emergency(
    location_id: str,
    sms_numbers: Optional[list[str]] = None,
    kakao_numbers: Optional[list[str]] = None,
    slack_channel: Optional[str] = None,
    target_roles: Optional[list[str]] = None,
) -> dict:
    """
    침수 발생 시 Slack·SMS·카카오를 동시에 발송하는 통합 경보 툴.
    체크리스트 생성 → 보고서 작성 → 전채널 발송 → DB 기록을 한 번에 실행합니다.

    Args:
        location_id:    위치 ID
        sms_numbers:    SMS 수신 번호 리스트 (None이면 SMS 생략)
        kakao_numbers:  카카오 수신 번호 리스트 (None이면 카카오 생략)
        slack_channel:  Slack 채널 오버라이드 (None이면 기본 채널)
        target_roles:   체크리스트 대상 역할 리스트 (기본: 현장요원, 관제센터)

    Returns:
        results: 채널별 발송 결과
        report:  생성된 보고서 ID
        checklist: 발송된 체크리스트
    """
    roles = target_roles or ["현장요원", "관제센터"]

    # 1. 현황 조회
    status = get_current_status(location_id)
    risk_level = status.get("risk_level", "안전")
    location_name = status.get("location_name", location_id)

    # 2. 체크리스트 생성 (모든 역할)
    checklists = {}
    for role in roles:
        cl = generate_checklist(risk_level, location_name, role)
        checklists[role] = cl["checklist"]

    # 3. Slack 보고서 생성 및 발송
    slack_msg = generate_response_manual(status)
    slack_result = send_slack_alert(slack_msg, slack_channel)

    # 4. SMS 발송
    sms_result = None
    if sms_numbers:
        sms_result = send_sms_alert(sms_numbers, location_name, risk_level)

    # 5. 카카오 발송
    kakao_result = None
    if kakao_numbers:
        all_items = checklists.get("시민", checklists.get("현장요원", []))
        kakao_result = send_kakao_alert(kakao_numbers, location_name, risk_level, all_items)

    # 6. 보고서 생성
    all_checklist_items = [item for items in checklists.values() for item in items]
    report = create_incident_report(status, all_checklist_items)

    # 7. DB 기록
    incident = log_incident(location_id, status, notes=f"broadcast_emergency 자동 실행")

    return {
        "location":     location_name,
        "risk_level":   risk_level,
        "report_id":    report["report_id"],
        "incident_id":  incident["incident_id"],
        "checklists":   checklists,
        "results": {
            "slack":  slack_result,
            "sms":    sms_result,
            "kakao":  kakao_result,
        },
        "executed_at": datetime.now().isoformat(),
    }


# ═══════════════════════════════════════════════════════
# [신규] 15. 사건 이력 조회
# ═══════════════════════════════════════════════════════
@mcp.tool()
def get_incident_history(
    location_id: Optional[str] = None,
    limit: int = 20,
    status_filter: Optional[str] = None,
) -> dict:
    """
    기록된 침수 사건 이력을 조회합니다.

    Args:
        location_id:    특정 위치 필터 (None이면 전체)
        limit:          최대 조회 건수 (기본 20)
        status_filter:  상태 필터 ('ACTIVE' 또는 'RESOLVED', None이면 전체)

    Returns:
        incidents: 사건 목록 (최신순)
        total:     전체 건수
    """
    conn = sqlite3.connect(DB_PATH)
    query = "SELECT * FROM incidents WHERE 1=1"
    params = []

    if location_id:
        query += " AND location_id = ?"
        params.append(location_id)
    if status_filter:
        query += " AND status = ?"
        params.append(status_filter)

    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    cols = [d[1] for d in conn.execute("PRAGMA table_info(incidents)").fetchall()]
    conn.close()

    incidents = [dict(zip(cols, row)) for row in rows]
    return {"incidents": incidents, "total": len(incidents)}


# ── 내부 헬퍼 ──────────────────────────────────────────
def _log_alert(incident_id: str, channel: str, message: str, success: bool):
    """발송 이력을 DB에 기록하는 내부 함수."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO alert_logs (incident_id, channel, message, success, sent_at) VALUES (?,?,?,?,?)",
        (incident_id, channel, message[:500], int(success), datetime.now().isoformat()),
    )
    conn.commit()
    conn.close()


# ── 진입점 ────────────────────────────────────────────
if __name__ == "__main__":
    mcp.run()
