from pydantic import BaseModel, Field


RiskLabel = str


class SensorData(BaseModel):
    current_level: float
    level_velocity: float
    current_rainfall: float
    forecast_rainfall: float


class RiskPredictionResponse(BaseModel):
    riskLevel: int
    riskLabel: RiskLabel
    riskScore: int


class RiskForecastRequest(BaseModel):
    rainfall: float = Field(ge=0)
    waterLevel: float = Field(ge=0, le=100)
    drainageLevel: float = Field(ge=0, le=100)
    waterLevelRiseRate: float = Field(ge=0)
    forecastRainfall1h: float = Field(ge=0)
    forecastRainfall2h: float = Field(ge=0)
    forecastRainfall3h: float = Field(ge=0)


class PredictionPoint(BaseModel):
    time: str
    risk: int
    rainfall: float
    riskLabel: RiskLabel


class RiskForecastResponse(BaseModel):
    modelVersion: str
    confidence: float
    riskScore: int
    riskLabel: RiskLabel
    reasons: list[str]
    points: list[PredictionPoint]
    timestamp: str


class GenerateAlertRequest(BaseModel):
    region: str
    riskScore: float = Field(ge=0, le=100)
    riskLabel: str
    rainfall: float = Field(ge=0)
    waterLevel: float = Field(ge=0, le=100)
    waterLevelRiseRate: float = Field(ge=0)
    forecastRainfall1h: float = Field(ge=0)
    source: str | None = None


class GenerateAlertResponse(BaseModel):
    alertLevel: str
    targetGroup: list[str]
    title: str
    message: str
    actions: list[str]
    createdAt: str
    source: str = "fallback"
