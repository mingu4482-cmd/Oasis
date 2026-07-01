# OASIS

OASIS는 공공 데이터와 AI 예측 모델을 기반으로 지역별 침수 위험도를 모니터링하는 대시보드입니다. React/Vite 프론트엔드, Express API 게이트웨이, FastAPI AI 서버, Python 스케줄러, Spring Boot 센서/SWMM 백엔드가 함께 동작합니다.

## 주요 기능

- 서울시 강우량 API, 서울시 하수관로 수위 API, 기상청 단기예보 API 기반 실시간 수집
- 지역별 침수 위험도 계산 및 `SAFE`, `CAUTION`, `WARNING`, `DANGER` 등급 표시
- 홈 화면 주요 위험 지역 TOP 3 요약
- AI 위험도 분석 페이지, 지역 선택, 1~3시간 위험도 차트
- 카카오 지도 기반 지역별 위험도·맨홀·대피 경로 통합 레이어와 VWorld 자치구 경계
- 구 선택 시 해당 구의 맨홀과 대피소만 표시하고 기존 다른 구의 경로 선택 초기화
- `risk_model.pkl` 로드 및 모델 실패 시 fallback scoring
- OpenAI API 기반 상황별 침수 알림 생성
- OpenAI API 키가 없거나 호출 실패 시 rule 기반 fallback 알림 생성
- 안전 경로 페이지, 대피소 목록, 자동차/도보 경로 조회
- 카카오 지도 SDK 기반 통합 지도와 대피소 지도, VWorld/Cesium 기반 침수 시뮬레이션 화면
- Spring Boot 8080 백엔드가 제공하는 맨홀 수위와 SWMM 테스트 API 연동 화면
- 로그인, 회원가입, 역할 기반 메뉴 표시

## 기술 스택

- Frontend: React, TypeScript, Vite, Recharts, Zustand
- Backend: Express, Node.js, PostgreSQL
- Sensor/SWMM Backend: Spring Boot 3.5, Java 21, Gradle, MyBatis, PostgreSQL
- AI Server: FastAPI, scikit-learn, pandas, joblib, OpenAI Python SDK
- Scheduler: APScheduler, requests, python-dotenv
- Maps/Simulation: react-kakao-maps-sdk, Kakao Mobility, Tmap, VWorld WebGL, Cesium, 외부 센서/SWMM API
- Dev tooling: concurrently

## 프로젝트 루트

현재 앱 루트는 아래 경로입니다.

```powershell
C:\dev_source\Oasis\Oasis
```

## 환경 변수

프로젝트 루트의 `.env.local`에는 Express 서버, DB, 프론트엔드, 선택적 경로 API 설정을 저장합니다.

```env
API_PORT=4000
AI_SERVER_URL=http://localhost:8000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE

VITE_API_BASE_URL=/api
VITE_KAKAO_MAP_KEY=
VITE_EXTERNAL_SENSOR_API_BASE_URL=http://localhost:8080
VITE_SWMM_API_BASE_URL=http://localhost:8080

KAKAO_REST_API_KEY=
TMAP_APP_KEY=
VWORLD_API_KEY=
VWORLD_DOMAIN=localhost
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
KMA_RATE_LIMIT_COOLDOWN_SECONDS=900
KMA_REQUEST_INTERVAL_SECONDS=1.2

TARGET_GU_NAME=강남구
TARGET_DRAINPIPE_KEYWORD=강남구
DANGER_WATER_LEVEL_M=1.0

EXPRESS_BASE_URL=http://localhost:4000
COLLECT_INTERVAL_SECONDS=600
SCHEDULER_LOCK_PORT=49171

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

`.env`, `.env.local` 등 실제 비밀 값 파일은 Git에 커밋하지 않습니다.

Spring Boot 설정은 `oasis_spring/src/main/resources/application.yml`에서 관리합니다. 이 파일에는 PostgreSQL 연결 정보, MyBatis mapper 경로, 커넥션 풀 설정이 들어가므로 실제 비밀 값은 환경 변수나 로컬 전용 설정으로 분리하는 것을 권장합니다.

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

Spring Boot 백엔드는 Gradle Wrapper로 실행합니다.

```powershell
cd C:\dev_source\Oasis\Oasis\oasis_spring
.\gradlew.bat bootRun
```

## 개발 서버 실행

프론트엔드, Express, FastAPI, 스케줄러를 한 번에 실행합니다.

```powershell
cd C:\dev_source\Oasis\Oasis
npm.cmd run dev:all
```

`dev:all`은 한 번만 실행합니다. 기존 4000/5173/8000 포트 프로세스가 남아 있으면 먼저 종료하세요. 스케줄러는 `SCHEDULER_LOCK_PORT`를 사용해 중복 실행을 자동 차단합니다.

개별 실행 스크립트:

- `npm.cmd run dev:fe`: Vite 개발 서버, `http://localhost:5173`
- `npm.cmd run dev:be`: Express API 서버, `http://localhost:4000`
- `npm.cmd run dev:ai`: FastAPI AI 서버, `http://localhost:8000`
- `npm.cmd run dev:scheduler`: 공공 API 수집 및 Express 전송 스케줄러

`/map`, `/simulation`의 맨홀/시뮬레이션 데이터는 Spring Boot 백엔드를 직접 호출합니다. 기본값은 둘 다 `http://localhost:8080`이며, 필요하면 `.env.local`에서 `VITE_EXTERNAL_SENSOR_API_BASE_URL`, `VITE_SWMM_API_BASE_URL`로 분리합니다. `dev:all`은 Spring Boot를 포함하지 않으므로 센서/SWMM 화면까지 확인하려면 `oasis_spring`의 `bootRun`을 별도 터미널에서 실행합니다.

로컬 SWMM 목 서버가 필요하면 별도 터미널에서 실행합니다.

```powershell
cd C:\dev_source\Oasis\Oasis\sim
python -m uvicorn swmm_server:app --reload --port 8000
```

현재 Spring `GET /api/test/swmm`은 내부에서 Python SWMM 목 서버의 `POST http://localhost:8000/run-swmm`을 호출합니다. FastAPI AI 서버도 기본 포트가 8000이므로, 둘을 동시에 사용할 때는 한쪽 포트를 조정해야 합니다.

## Express API

- `GET /api/health`: DB 연결 확인
- `GET /api/vworld/seoul-districts`: VWorld 서울 자치구 경계 조회. 키가 없거나 upstream 실패 시 빈 경계 응답
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
- `GET /api/route/walk`: T맵 보행자 경로 조회, 키가 없으면 OSRM 또는 직선거리 fallback
- `GET /api/shelters`: `locations` 테이블 기반 대피소 목록 조회

Vite 개발 서버는 `/api`를 Express `http://127.0.0.1:4000`으로, `/vworld-api`를 `https://api.vworld.kr`로 프록시합니다.

## FastAPI AI API

- `GET /health`: 모델 로드 상태와 fallback 활성화 상태 확인
- `POST /predict`: 센서/강수 입력값 기반 침수 위험도 예측
- `POST /generate-alert`: 계산된 위험도 결과 기반 상황별 알림 생성

## Spring Boot Sensor/SWMM API

- `GET /api/manholes`: `locations`와 최신 `sensor_logs`를 조인한 맨홀 좌표/수위 목록 조회
- `GET /api/sensors/latest`: 지역별 최신 센서 로그 조회
- `GET /api/test/swmm?rainfall=...`: Spring에서 Python SWMM 목 서버로 강우량을 전달하고 결과 반환
- `GET /api/geo-update`: `locations` 주소를 카카오 로컬 검색으로 좌표 변환해 DB 업데이트

Spring Boot 서버는 서울시 하수관로 수위 API를 시작 시 1회, 이후 10분마다 수집해 `locations`, `sensor_logs` 테이블에 저장합니다.

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

지도/대피 경로 흐름:

```text
React MapView / RegionRiskMapPanel
        ↓
Express /api/vworld/seoul-districts
Express /api/shelters, /api/route/car, /api/route/walk
        ↓
PostgreSQL locations / Kakao Mobility / Tmap / OSRM fallback
```

통합 지도/시뮬레이션 흐름:

```text
React MapViewPage / SimulationPage
        ↓
Spring Boot 센서/SWMM 백엔드
  ├─ MapViewPage: GET {VITE_EXTERNAL_SENSOR_API_BASE_URL}/api/manholes
  └─ SimulationPage: GET {VITE_SWMM_API_BASE_URL}/api/test/swmm?rainfall=...
        ↓
PostgreSQL sensor_logs/locations 또는 Python SWMM 목 서버
        ↓
Kakao 지도 또는 VWorld/Cesium 화면 시각화
```

스케줄러가 아직 데이터를 수집하지 못한 경우 API는 `hasData: false`를 반환하고, 프론트엔드는 대기 상태 또는 최소 fallback UI를 표시합니다.

## 화면 기능

- 기본 진입(`/`): 통합 지도 `/map`으로 이동합니다.
- 홈(`/dashboard`): 실시간 위험도 요약, 주요 위험 지역 TOP 3, 지역별 위험도 지도형 요약, 이벤트 타임라인, 센서 상태를 표시합니다.
- AI 위험도 분석(`/risk-analysis`): 지역별 실시간 수집값, 1~3시간 위험도 차트, 상황별 침수 알림을 제공합니다.
- 통합 지도(`/map`): 선택 구의 위험도·맨홀·대피소·경로를 한 지도에서 전환하며 1~7레벨 확대/축소를 지원합니다.
- 안전 경로(`/safe-route`): 현재 `/dashboard`로 이동하며 실제 대피 경로 기능은 통합 지도 레이어에서 제공합니다.
- 디지털 트윈(`/digital-twin`): 현재 `/dashboard`로 이동합니다.
- 시뮬레이션(`/simulation`): VWorld WebGL/Cesium 화면에서 Spring `/api/test/swmm` 결과에 따른 침수 구역 시뮬레이션을 실행합니다.
- 경보 관리(`/alerts`)와 보고서(`/reports`): 경보 이력과 보고서 대기열을 확인합니다.

대시보드와 통합 지도는 `useDashboardStore().selectedRegion`을 공유합니다. 지도 마커나 지역 선택 메뉴에서 구를 변경하면 위험도 분석, 맨홀, 대피소와 경로가 같은 구 기준으로 동기화됩니다.

## LLM 상황별 알림

침수 위험도 계산은 기존 예측 모델과 fallback scoring이 담당합니다. LLM은 이미 계산된 `riskScore`, `riskLabel`, 강우량, 하수관로 수위, 예보 강수량을 기반으로 알림 대상, 제목, 메시지, 권장 대응 조치만 생성합니다.

`OPENAI_API_KEY`가 있으면 FastAPI 서버가 OpenAI API를 호출합니다. 키가 없거나 API 호출 또는 JSON 파싱에 실패하면 rule 기반 fallback 알림을 반환합니다.

## 빌드

```powershell
cd C:\dev_source\Oasis\Oasis
npm.cmd run build

cd C:\dev_source\Oasis\Oasis\oasis_spring
.\gradlew.bat build
```

## 검증에 자주 쓰는 명령

```powershell
node --check server/index.js
python -m py_compile ai-server/main.py
python -m py_compile ai-server/scheduler.py
python -m py_compile ai-server/services/alert_generator.py
npm.cmd run build
cd oasis_spring
.\gradlew.bat test
```
