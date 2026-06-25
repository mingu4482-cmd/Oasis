from fastapi import FastAPI
from pydantic import BaseModel
import random

app = FastAPI()

# Spring이 파이썬으로 보낼 데이터 형식 (강우량)
class SimulationRequest(BaseModel):
    rainfall: float

@app.post("/run-swmm")
async def run_swmm_simulation(req: SimulationRequest):
    print(f"🌧️ Spring에서 강우량 {req.rainfall}mm/h 요청 들어옴!")
    
    # 나중에는 여기에 진짜 pyswmm 엔진을 연결해서 .inp 파일을 돌릴 거야.
    # 지금은 강우량에 비례해서 가상의 맨홀 수위를 계산하는 모의 로직!
    base_level = req.rainfall * 0.5
    
    # 우리가 지도에 띄웠던 3개 지역의 수위 데이터 (약간의 랜덤값 추가)
    result_data = [
        {"locationId": 1, "waterLevel": round(base_level + random.uniform(0, 5), 1)},
        {"locationId": 10001, "waterLevel": round(base_level * 0.8 + random.uniform(0, 3), 1)},
        {"locationId": 10002, "waterLevel": round(base_level * 1.2 + random.uniform(0, 7), 1)}
    ]
    
    return {"status": "success", "data": result_data}

# 서버 실행: uvicorn swmm_server:app --reload --port 8000