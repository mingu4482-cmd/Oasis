import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import joblib
import os
from pathlib import Path

# 1. 저장할 경로 셋팅 (ai-server/models 폴더가 없으면 만듦)
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(exist_ok=True)
MODEL_PATH = MODEL_DIR / "risk_model.pkl"

# 2. 가상 데이터 5,000개 다시 생성
np.random.seed(42)
num_samples = 5000
current_level = np.random.uniform(10, 90, num_samples)
level_velocity = np.random.uniform(-1, 5, num_samples)
current_rainfall = np.random.uniform(0, 50, num_samples)
forecast_rainfall = np.random.uniform(0, 100, num_samples)

risk_score = (current_level * 0.4) + (level_velocity * 10) + (current_rainfall * 0.5) + (forecast_rainfall * 0.2)

risk_level = [0 if s < 40 else 1 if s < 60 else 2 if s < 80 else 3 for s in risk_score]

df = pd.DataFrame({
    'current_level': current_level,
    'level_velocity': level_velocity,
    'current_rainfall': current_rainfall,
    'forecast_rainfall': forecast_rainfall,
    'risk_level': risk_level
})

# 3. 모델 다시 학습시키고 저장
X = df[['current_level', 'level_velocity', 'current_rainfall', 'forecast_rainfall']]
y = df['risk_level']

print("🧠 AI 모델을 다시 학습시키는 중...")
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X, y)

joblib.dump(model, MODEL_PATH)
print(f"✅ 복구 완료! 모델 파일이 안전하게 생성되었습니다: {MODEL_PATH}")