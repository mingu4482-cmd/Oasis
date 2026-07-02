from datetime import datetime
from typing import Any

from schemas.risk_schema import (
    PredictionPoint,
    RiskForecastRequest,
    RiskForecastResponse,
    RiskPredictionResponse,
    SensorData,
)
from services.feature_builder import build_sensor_data, clamp


MODEL_VERSION = "OASIS-RiskRule v2.0"

# OASIS 운영 기준 v2.0
# - rainfall: 서울시 RN_10M(mm/10분)을 시간당 강우강도로 환산
# - water level: 관측 수위 / 관측소 위험수위의 백분율
# - rise rate: m/h
# - forecast rainfall: 향후 3시간 시간별 강우량의 합(mm)
WEIGHT_CURRENT_RAINFALL = 0.30
WEIGHT_WATER_LEVEL = 0.35
WEIGHT_LEVEL_RISE = 0.20
WEIGHT_FORECAST_RAINFALL = 0.15

HEAVY_RAINFALL_MM_PER_HOUR = 50.0
EXTREME_RAINFALL_MM_PER_HOUR = 72.0
THREE_HOUR_RAINFALL_MM = 90.0
WARNING_WATER_LEVEL_PERCENT = 80.0
DANGER_WATER_LEVEL_PERCENT = 90.0
RAPID_LEVEL_RISE_M_PER_HOUR = 0.30


def classify_risk(score: float) -> str:
    if score >= 75:
        return "DANGER"
    if score >= 50:
        return "WARNING"
    if score >= 25:
        return "CAUTION"
    return "SAFE"


def normalized_percent(value: float, danger_value: float) -> float:
    if danger_value <= 0:
        return 0.0
    return clamp(value / danger_value * 100.0)


def calculate_rule_score(
    sensor_data: SensorData,
    *,
    rainfall_rate_mm_per_hour: float | None = None,
) -> int:
    """Calculate the documented OASIS v2 reference-risk score.

    Direct /predict callers provide current_rainfall in mm/h. The regional
    scheduler explicitly supplies the hourly rate converted from RN_10M.
    """
    rainfall_rate = (
        sensor_data.current_rainfall
        if rainfall_rate_mm_per_hour is None
        else rainfall_rate_mm_per_hour
    )
    forecast_total = max(sensor_data.forecast_rainfall, 0.0)

    weighted_score = (
        normalized_percent(rainfall_rate, HEAVY_RAINFALL_MM_PER_HOUR)
        * WEIGHT_CURRENT_RAINFALL
        + clamp(sensor_data.current_level)
        * WEIGHT_WATER_LEVEL
        + normalized_percent(sensor_data.level_velocity, RAPID_LEVEL_RISE_M_PER_HOUR)
        * WEIGHT_LEVEL_RISE
        + normalized_percent(forecast_total, THREE_HOUR_RAINFALL_MM)
        * WEIGHT_FORECAST_RAINFALL
    )
    score = round(clamp(weighted_score))

    # A critical single signal must not be diluted by the weighted average.
    if (
        sensor_data.current_level >= DANGER_WATER_LEVEL_PERCENT
        or rainfall_rate >= EXTREME_RAINFALL_MM_PER_HOUR
        or sensor_data.level_velocity >= RAPID_LEVEL_RISE_M_PER_HOUR
        or forecast_total >= THREE_HOUR_RAINFALL_MM
    ):
        return max(score, 75)
    if sensor_data.current_level >= WARNING_WATER_LEVEL_PERCENT:
        return max(score, 50)
    if rainfall_rate >= HEAVY_RAINFALL_MM_PER_HOUR:
        return max(score, 50)
    return score


def predict_sensor_risk(
    sensor_data: SensorData,
    model: Any | None = None,
    drainage_level: float = 100.0,
) -> RiskPredictionResponse:
    # model and drainage_level are retained for API compatibility. The public
    # score now follows one transparent rule set instead of synthetic ML data.
    del model, drainage_level
    score = calculate_rule_score(sensor_data)
    return RiskPredictionResponse(
        riskLevel={"SAFE": 0, "CAUTION": 1, "WARNING": 2, "DANGER": 3}[classify_risk(score)],
        riskLabel=classify_risk(score),
        riskScore=score,
    )


def build_reasons(payload: RiskForecastRequest, risk_score: int) -> list[str]:
    reasons: list[str] = []
    rainfall_rate = payload.rainfall * 6.0
    forecast_total = payload.forecastRainfall1h + payload.forecastRainfall2h + payload.forecastRainfall3h

    if rainfall_rate >= EXTREME_RAINFALL_MM_PER_HOUR:
        reasons.append("10분 강우량을 환산한 시간당 강우강도가 극한호우 기준에 도달했습니다.")
    elif rainfall_rate >= HEAVY_RAINFALL_MM_PER_HOUR:
        reasons.append("10분 강우량을 환산한 시간당 강우강도가 50mm 이상입니다.")
    if payload.waterLevel >= DANGER_WATER_LEVEL_PERCENT:
        reasons.append("하수관로 수위가 관측소 위험수위의 90% 이상입니다.")
    elif payload.waterLevel >= WARNING_WATER_LEVEL_PERCENT:
        reasons.append("하수관로 수위가 관측소 위험수위의 80% 이상입니다.")
    if payload.waterLevelRiseRate >= RAPID_LEVEL_RISE_M_PER_HOUR:
        reasons.append("하수관로 수위가 시간당 0.30m 이상 빠르게 상승하고 있습니다.")
    if forecast_total >= THREE_HOUR_RAINFALL_MM:
        reasons.append("향후 3시간 예상 강우량 합계가 90mm 이상입니다.")
    if not reasons:
        reasons.append("현재 강우·관로 수위·수위 상승속도·3시간 예보를 종합한 참고 위험도입니다.")
    if risk_score >= 75 and len(reasons) < 2:
        reasons.append("단일 고위험 지표가 가중평균에 희석되지 않도록 위험 단계를 강제 상향했습니다.")
    return reasons


def build_risk_forecast(payload: RiskForecastRequest, model: Any | None = None) -> RiskForecastResponse:
    del model
    points: list[PredictionPoint] = []
    scores: list[int] = []

    for hour in range(4):
        sensor_data = build_sensor_data(payload, hour)
        # RN_10M is converted only for the current observation. KMA forecast
        # values for +1h through +3h are already hourly precipitation amounts.
        rainfall_rate = payload.rainfall * 6.0 if hour == 0 else sensor_data.current_rainfall
        score = calculate_rule_score(sensor_data, rainfall_rate_mm_per_hour=rainfall_rate)
        label = classify_risk(score)
        scores.append(score)
        points.append(
            PredictionPoint(
                time="Now" if hour == 0 else f"+{hour}h",
                risk=score,
                rainfall=sensor_data.current_rainfall,
                riskLabel=label,
            )
        )

    risk_score = max(scores)
    return RiskForecastResponse(
        modelVersion=MODEL_VERSION,
        # The scheduler replaces this with collection-quality confidence.
        confidence=0.0,
        riskScore=risk_score,
        riskLabel=classify_risk(risk_score),
        reasons=build_reasons(payload, risk_score),
        message="OASIS 참고 위험도이며 공식 재난 경보가 아닙니다.",
        points=points,
        timestamp=datetime.now().isoformat(),
    )
