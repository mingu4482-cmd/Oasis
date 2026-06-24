from datetime import datetime
from typing import Any

import pandas as pd

from schemas.risk_schema import (
    PredictionPoint,
    RiskPredictionResponse,
    RiskForecastRequest,
    RiskForecastResponse,
    SensorData,
)
from services.feature_builder import build_model_features, build_sensor_data, clamp


MODEL_VERSION = "OASIS-FloodNet v1.0"
MODEL_CLASS_SCORES = {
    0: 20,
    1: 50,
    2: 70,
    3: 90,
}

LOW_RISK_MESSAGE = "강우량과 수위가 낮아 현재 침수 위험은 낮은 상태입니다."
LOW_CONFIDENCE_SAFE_MESSAGE = "예보 데이터가 부족하지만 현재 강우량과 수위가 낮아 즉시 위험은 낮습니다."


def classify_risk(score: float) -> str:
    if score >= 80:
        return "DANGER"
    if score >= 60:
        return "WARNING"
    if score >= 40:
        return "CAUTION"
    return "SAFE"


def fallback_score(sensor_data: SensorData, drainage_level: float = 100.0) -> int:
    drainage_risk = max(0.0, 100.0 - drainage_level)
    score = (
        sensor_data.current_rainfall * 0.65
        + sensor_data.current_level * 0.45
        + drainage_risk * 0.35
        + sensor_data.level_velocity * 4.0
        + sensor_data.forecast_rainfall * 0.45
    )
    return round(clamp(score))


def is_low_observed_risk(payload: RiskForecastRequest) -> bool:
    return (
        payload.rainfall < 1
        and payload.waterLevel < 30
        and payload.forecastRainfall1h < 10
        and payload.forecastRainfall2h < 10
        and payload.forecastRainfall3h < 10
        and payload.waterLevelRiseRate < 1
    )


def has_low_risk_override_blocker(payload: RiskForecastRequest) -> bool:
    return (
        payload.waterLevel >= 60
        or payload.waterLevelRiseRate >= 3
        or payload.forecastRainfall1h >= 30
        or payload.forecastRainfall2h >= 30
        or payload.forecastRainfall3h >= 30
    )


def is_low_risk_with_untrusted_forecast(payload: RiskForecastRequest) -> bool:
    source = (payload.source or "").lower()
    return (
        payload.rainfall < 1
        and payload.waterLevel < 40
        and payload.waterLevelRiseRate <= 0
        and (payload.forecastStatus == "FAILED" or "fallback" in source)
    )


def has_safety_override_blocker(payload: RiskForecastRequest) -> bool:
    return (
        payload.waterLevel >= 60
        or payload.waterLevelRiseRate >= 3
        or payload.rainfall >= 20
        or payload.forecastRainfall1h >= 30
        or payload.forecastRainfall2h >= 30
        or payload.forecastRainfall3h >= 30
    )


def predict_sensor_risk(sensor_data: SensorData, model: Any | None = None, drainage_level: float = 100.0) -> RiskPredictionResponse:
    formula_score = fallback_score(sensor_data, drainage_level)
    score = formula_score
    risk_level = -1

    if model is not None:
        try:
            features = pd.DataFrame([build_model_features(sensor_data)])
            risk_level = int(model.predict(features)[0])
            model_score = MODEL_CLASS_SCORES.get(risk_level, formula_score)
            blended_score = round(clamp((formula_score * 0.75) + (model_score * 0.25)))
            score = max(formula_score, blended_score)
        except Exception:
            risk_level = -1
            score = formula_score

    return RiskPredictionResponse(
        riskLevel=risk_level,
        riskLabel=classify_risk(score),
        riskScore=score,
    )


def build_reasons(payload: RiskForecastRequest, risk_score: int) -> list[str]:
    reasons: list[str] = []
    if payload.rainfall >= 30:
        reasons.append("최근 강수량이 높습니다.")
    if max(payload.forecastRainfall1h, payload.forecastRainfall2h, payload.forecastRainfall3h) >= 35:
        reasons.append("단기 예보 강수량이 높아 추가 유입이 예상됩니다.")
    if payload.waterLevel >= 70:
        reasons.append("하수관로 수위가 위험 기준에 근접했습니다.")
    if payload.drainageLevel <= 70:
        reasons.append("배수 상태가 낮아 침수 지연 배출 가능성이 있습니다.")
    if payload.waterLevelRiseRate >= 3:
        reasons.append("수위 상승 속도가 빠릅니다.")
    if not reasons:
        reasons.append("현재 입력값 기준으로 즉각적인 고위험 요인은 제한적입니다.")
    if risk_score >= 80 and len(reasons) < 3:
        reasons.append("복합 요인으로 종합 위험도가 높게 산정되었습니다.")
    return reasons


def build_risk_forecast(payload: RiskForecastRequest, model: Any | None = None) -> RiskForecastResponse:
    points: list[PredictionPoint] = []
    scores: list[int] = []

    for hour in range(4):
        sensor_data = build_sensor_data(payload, hour)
        prediction = predict_sensor_risk(sensor_data, model, payload.drainageLevel)
        scores.append(prediction.riskScore)
        points.append(
            PredictionPoint(
                time="Now" if hour == 0 else f"+{hour}h",
                risk=prediction.riskScore,
                rainfall=sensor_data.current_rainfall,
                riskLabel=prediction.riskLabel,
            )
        )

    low_risk_override = is_low_observed_risk(payload) and not has_low_risk_override_blocker(payload)
    untrusted_forecast_low_risk = is_low_risk_with_untrusted_forecast(payload) and not has_safety_override_blocker(payload)
    if low_risk_override:
        points = [
            PredictionPoint(
                time=point.time,
                risk=min(point.risk, 25),
                rainfall=point.rainfall,
                riskLabel="SAFE",
            )
            for point in points
        ]
        scores = [point.risk for point in points]
    elif untrusted_forecast_low_risk:
        points = [
            PredictionPoint(
                time=point.time,
                risk=min(point.risk, 30),
                rainfall=point.rainfall,
                riskLabel="SAFE" if min(point.risk, 30) < 25 else "CAUTION",
            )
            for point in points
        ]
        scores = [point.risk for point in points]

    risk_score = max(scores)
    if low_risk_override:
        risk_label = "SAFE"
        message = LOW_RISK_MESSAGE
    elif untrusted_forecast_low_risk:
        risk_label = "SAFE" if risk_score < 25 else "CAUTION"
        message = LOW_CONFIDENCE_SAFE_MESSAGE
    else:
        risk_label = classify_risk(risk_score)
        message = None
    confidence = round(min(0.95, 0.62 + risk_score / 300), 2)

    return RiskForecastResponse(
        modelVersion=MODEL_VERSION,
        confidence=confidence,
        riskScore=risk_score,
        riskLabel=risk_label,
        reasons=[message] if message else build_reasons(payload, risk_score),
        message=message,
        points=points,
        timestamp=datetime.now().isoformat(),
    )
