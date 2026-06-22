# OASIS

OASIS는 실시간 침수 위험도 예측 대시보드입니다. React/Vite 프론트엔드, Express API 서버, FastAPI 기반 AI 예측 서버, Python 스케줄러가 함께 동작합니다.

## 기술 스택

- Frontend: React, TypeScript, Vite, Recharts, Zustand
- Backend: Express, Node.js, PostgreSQL
- AI Server: FastAPI, scikit-learn, pandas, joblib
- Scheduler: APScheduler, requests, python-dotenv
- Dev tooling: concurrently

## 사전 준비

- Node.js 20 이상 권장
- Python 3.10 이상 권장
- Supabase PostgreSQL 또는 호환 PostgreSQL 접속 정보
- 기상청 API 키
- 하수관로/수위 공공 API 키
- AI 모델 파일: `ai-server/models/risk_model.pkl`

## 환경 변수

프로젝트 루트의 `.env.local`에 Express 서버와 DB 설정을 저장합니다.

```env
API_PORT=4000
AI_SERVER_URL=http://localhost:8000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

AI 서버 폴더의 `ai-server/.env`에 외부 API 설정을 저장합니다.

```env
WEATHER_API_KEY=your_weather_api_key
SEWER_API_KEY=your_sewer_api_key
WEATHER_NX=60
WEATHER_NY=127
SEWER_SERVICE_NAME=DrainpipeMonitoringInfo
SEWER_STATION_ID=
SEWER_MAX_LEVEL=100
```

## 설치

Windows PowerShell에서 `npm`이 실행 정책 때문에 막히면 `npm.cmd`를 사용하세요.

```powershell
cd C:\dev_source\Oasis\Oasis
npm.cmd install
```

Python 의존성을 설치합니다.

```powershell
cd C:\dev_source\Oasis\Oasis\ai-server
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

모델 파일이 없으면 테스트용 모델을 생성합니다.

```powershell
cd C:\dev_source\Oasis\Oasis\ai-server
.\.venv\Scripts\python.exe train.py
```

## 개발 서버 실행

터미널 하나에서 프론트엔드, Express, FastAPI, 스케줄러를 모두 실행합니다.

```powershell
cd C:\dev_source\Oasis\Oasis
npm.cmd run dev:all
```

`concurrently`가 각 서버 로그에 `[dev:fe]`, `[dev:be]`, `[dev:ai]`, `[dev:scheduler]` 라벨을 붙여 출력합니다.

실행되는 스크립트:

- `dev:fe`: Vite 개발 서버, `http://localhost:5173`
- `dev:be`: Express API 서버, `http://localhost:4000`
- `dev:ai`: FastAPI AI 서버, `http://localhost:8000`
- `dev:scheduler`: 외부 API 수집 및 AI 예측 스케줄러

## 주요 API

Express API:

- `GET /api/health`: DB 연결 확인
- `POST /api/auth/signup`: 회원가입
- `POST /api/auth/login`: 로그인
- `POST /api/auth/logout`: 로그아웃
- `POST /api/predict-risk`: Express를 통해 FastAPI AI 서버에 침수 위험도 예측 요청
- `POST /api/update-live-status`: Python 스케줄러가 최신 수집/예측 결과를 Express에 저장
- `GET /api/live-status`: 프론트엔드가 최신 실시간 상태 조회
- `GET /api/risk-forecast`: 프론트엔드 침수 위험도 그래프가 현재~3시간 예측 포인트 조회

FastAPI AI API:

- `GET /health`: AI 모델 로드 상태 확인
- `POST /predict`: 센서/강수 입력값 기반 위험도 예측

## 데이터 흐름

1. `ai-server/scheduler.py`가 기상청 API와 하수관로 API에서 데이터를 수집합니다.
2. 수집값으로 `current_level`, `level_velocity`, `current_rainfall`, `forecast_rainfall`을 계산합니다.
3. FastAPI AI 모델이 위험도 라벨과 점수를 예측합니다.
4. 스케줄러가 현재, +1h, +2h, +3h 침수 위험도 그래프 포인트를 생성합니다.
5. Express의 `/api/update-live-status`가 최신 결과를 메모리에 저장합니다.
6. React 대시보드는 `/api/live-status`와 `/api/risk-forecast`를 polling해서 화면을 갱신합니다.

스케줄러가 아직 첫 데이터를 수집하지 못한 경우 API는 `ready: false`를 반환하며, 프론트엔드는 기존 샘플 데이터를 fallback으로 표시합니다.

## 빌드

```powershell
cd C:\dev_source\Oasis\Oasis
npm.cmd run build
```

## 참고

- 실시간 그래프가 실제값으로 바뀌려면 `ai-server/.env`의 API 키가 유효해야 하고 `dev:scheduler`가 첫 수집에 성공해야 합니다.
- `DATABASE_URL`이 없거나 DB 접속이 실패하면 Express 서버 초기화가 실패합니다.
- PowerShell에서 `npm`이 막히면 `npm.cmd`를 사용하세요.
