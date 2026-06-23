# OASIS

OASIS는 공공 데이터와 AI 예측 모델을 기반으로 지역별 침수 위험도를 모니터링하는 대시보드입니다. React/Vite 프론트엔드, Express API 게이트웨이, FastAPI AI 서버, Python 스케줄러가 함께 동작합니다.

## 주요 기능

- 서울시 강우량 API, 서울시 하수관로 수위 API, 기상청 단기예보 API 기반 실시간 수집
- 지역별 침수 위험도 계산 및 `SAFE`, `CAUTION`, `WARNING`, `DANGER` 등급 표시
- 홈 화면 주요 위험 지역 TOP 3 요약
- AI 위험도 분석 페이지, 지역 선택, 1~3시간 위험도 차트
- `risk_model.pkl` 로드 및 모델 실패 시 fallback scoring
- OpenAI API 기반 상황별 침수 알림 생성
- OpenAI API 키가 없거나 호출 실패 시 rule 기반 fallback 알림 생성
- 안전 경로 페이지와 자동차/도보 경로 조회
- 로그인, 회원가입, 역할 기반 메뉴 표시

## 기술 스택

- Frontend: React, TypeScript, Vite, Recharts, Zustand
- Backend: Express, Node.js, PostgreSQL
- AI Server: FastAPI, scikit-learn, pandas, joblib, OpenAI Python SDK
- Scheduler: APScheduler, requests, python-dotenv
- Dev tooling: concurrently

## 프로젝트 루트

현재 앱 루트는 아래 경로입니다.

```powershell
C:\dev_source\Oasis\Oasis
```

## 환경 변수

프로젝트 루트의 `.env.local`에는 Express 서버, DB, 선택적 경로 API 설정을 저장합니다.

```env
API_PORT=4000
AI_SERVER_URL=http://localhost:8000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE

KAKAO_REST_API_KEY=
TMAP_APP_KEY=
```

AI 서버 폴더의 `ai-server/.env`에는 공공 API와 OpenAI 설정을 저장합니다.

```env
SEOUL_RAINFALL_API_KEY=
SEOUL_DRAINPIPE_API_KEY=
SEOUL_OPEN_API_BASE_URL=http://openAPI.seoul.go.kr:8088
SEOUL_RAINFALL_SERVICE=ListRainfallService
SEOUL_DRAINPIPE_SERVICE=DrainpipeMonitoringInfo

KMA_API_KEY=
KMA_FORECAST_URL=https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst
KMA_NX=61
KMA_NY=125

TARGET_GU_NAME=강남구
TARGET_DRAINPIPE_KEYWORD=강남구
DANGER_WATER_LEVEL_M=1.0

EXPRESS_BASE_URL=http://localhost:4000
COLLECT_INTERVAL_SECONDS=60

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

`.env`, `.env.local` 등 실제 비밀 값 파일은 Git에 커밋하지 않습니다.

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

모델 파일을 다시 생성해야 하면 아래 명령을 사용합니다.

```powershell
cd C:\dev_source\Oasis\Oasis\ai-server
.\.venv\Scripts\python.exe train.py
```

## 개발 서버 실행

프론트엔드, Express, FastAPI, 스케줄러를 한 번에 실행합니다.

```powershell
cd C:\dev_source\Oasis\Oasis
npm.cmd run dev:all
```

개별 실행 스크립트:

- `npm.cmd run dev:fe`: Vite 개발 서버, `http://localhost:5173`
- `npm.cmd run dev:be`: Express API 서버, `http://localhost:4000`
- `npm.cmd run dev:ai`: FastAPI AI 서버, `http://localhost:8000`
- `npm.cmd run dev:scheduler`: 공공 API 수집 및 Express 전송 스케줄러

## Express API

- `GET /api/health`: DB 연결 확인
- `POST /api/auth/signup`: 회원가입
- `POST /api/auth/login`: 로그인
- `POST /api/auth/logout`: 로그아웃
- `POST /api/predict-risk`: FastAPI `/predict` 프록시
- `POST /api/generate-alert`: FastAPI `/generate-alert` 프록시
- `POST /api/update-live-status`: 스케줄러가 보낸 최신 상태 저장
- `GET /api/regions`: 지역 목록 조회
- `GET /api/regional-status`: 전체 지역별 상태 조회
- `GET /api/live-status?region=...`: 선택 지역 실시간 상태 조회
- `GET /api/risk-forecast?region=...`: 선택 지역 예측 시계열 조회
- `GET /api/route/car`: 카카오모빌리티 자동차 경로 조회
- `GET /api/route/walk`: T맵 보행자 경로 조회, 키가 없으면 직선거리 fallback

## FastAPI AI API

- `GET /health`: 모델 로드 상태와 fallback 활성화 상태 확인
- `POST /predict`: 센서/강수 입력값 기반 침수 위험도 예측
- `POST /generate-alert`: 계산된 위험도 결과 기반 상황별 알림 생성

## 데이터 흐름

```text
서울시 강우량 API / 서울시 하수관로 API / 기상청 단기예보 API
        ↓
ai-server/scheduler.py
        ↓
위험도 모델 또는 fallback scoring
        ↓
Express /api/update-live-status
        ↓
React Dashboard / Risk Analysis
  ├─ /api/regions
  ├─ /api/live-status?region=...
  ├─ /api/risk-forecast?region=...
  └─ /api/generate-alert
```

스케줄러가 아직 데이터를 수집하지 못한 경우 API는 `hasData: false`를 반환하고, 프론트엔드는 대기 상태 또는 최소 fallback UI를 표시합니다.

## LLM 상황별 알림

침수 위험도 계산은 기존 예측 모델과 fallback scoring이 담당합니다. LLM은 이미 계산된 `riskScore`, `riskLabel`, 강우량, 하수관로 수위, 예보 강수량을 기반으로 알림 대상, 제목, 메시지, 권장 대응 조치만 생성합니다.

`OPENAI_API_KEY`가 있으면 FastAPI 서버가 OpenAI API를 호출합니다. 키가 없거나 API 호출 또는 JSON 파싱에 실패하면 rule 기반 fallback 알림을 반환합니다.

## 빌드

```powershell
cd C:\dev_source\Oasis\Oasis
npm.cmd run build
```

## 검증에 자주 쓰는 명령

```powershell
node --check server/index.js
python -m py_compile ai-server/main.py
python -m py_compile ai-server/scheduler.py
python -m py_compile ai-server/services/alert_generator.py
npm.cmd run build
```
