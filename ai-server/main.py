import logging
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from schemas.risk_schema import GenerateAlertRequest, SensorData
from services.alert_generator import generate_alert
from services.risk_predictor import predict_sensor_risk


def configure_utf8_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")


configure_utf8_stdio()
logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger("oasis-ai-server")

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="OASIS AI Risk Prediction Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4000",
        "http://127.0.0.1:4000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {
        "ok": True,
        "calculationMethod": "OASIS-RiskRule v2.0",
        "officialWarning": False,
    }


@app.post("/predict")
def predict_risk(sensor_data: SensorData):
    prediction = predict_sensor_risk(sensor_data)
    return prediction.model_dump()


@app.post("/generate-alert")
def create_alert(payload: GenerateAlertRequest):
    alert = generate_alert(payload)
    return alert.model_dump()

