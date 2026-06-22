from schemas.risk_schema import SensorData, SimulationRiskRequest


def clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(value, maximum))


def build_sensor_data(payload: SimulationRiskRequest, hour: int = 0) -> SensorData:
    hourly_rainfall = [
        payload.forecastRainfall1h,
        payload.forecastRainfall2h,
        payload.forecastRainfall3h,
    ]
    current_rainfall = payload.rainfall if hour == 0 else hourly_rainfall[hour - 1]
    forecast_rainfall = sum(hourly_rainfall[hour:]) if hour < 3 else 0.0
    projected_level = clamp(payload.waterLevel + payload.waterLevelRiseRate * hour)

    return SensorData(
        current_level=projected_level,
        level_velocity=payload.waterLevelRiseRate,
        current_rainfall=current_rainfall,
        forecast_rainfall=forecast_rainfall,
    )


def build_model_features(sensor_data: SensorData) -> dict[str, float]:
    return {
        "current_level": sensor_data.current_level,
        "level_velocity": sensor_data.level_velocity,
        "current_rainfall": sensor_data.current_rainfall,
        "forecast_rainfall": sensor_data.forecast_rainfall,
    }
