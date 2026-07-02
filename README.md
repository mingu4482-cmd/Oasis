# OASIS

OASIS는 서울시 강우·하수관로 관측값과 기상청 단기예보를 수집해 자치구별 침수 참고 위험도를 제공하는 관제 애플리케이션입니다. 카카오 지도에서 위험도, 맨홀 수위, 대피소와 경로를 확인하고 별도의 시뮬레이션 화면에서 강우 시나리오를 실행할 수 있습니다.

> 위험도는 공식 재난 경보가 아니라 `OASIS-RiskRule v2.0` 기반 참고 지표입니다.

## 현재 주요 기능

- 서울시 10분 강우량, 하수관로 수위와 기상청 1~3시간 예보 수집
- 10개 모니터링 자치구의 실시간 위험도와 1~3시간 전망
- 카카오 지도 기반 지역 위험도, 맨홀, 대피소와 대피 경로 레이어
- 맨홀 수위에 따른 단색 마커: 0~29 초록, 30~59 노랑, 60 이상 빨강
- 서울 25개 구 좌표 지원 및 선택 자치구 맨홀 필터링
- 실시간 위험도 디스크 캐시와 초기 빈 상태 2초 재조회
- 모든 `REALTIME`·`PARTIAL` 상황별 알림의 OpenAI 생성
- OpenAI 실패 또는 키 미설정 시 규칙 기반 알림 fallback
- 하수관 API 실측값을 초기값으로 사용하는 지역별 침수 시뮬레이션
- 잘못 지오코딩된 맨홀을 서울 범위 좌표로 재보정

## 기술 스택

- Frontend: React 18, TypeScript, Vite, React Router, React Query, Zustand
- Map: Kakao Maps SDK, Kakao Mobility, VWorld 행정경계 API
- API Gateway: Express 5, Axios, PostgreSQL
- AI/Collector: FastAPI, APScheduler, OpenAI Python SDK
- Sensor Backend: Spring Boot 3.5, Java 21, Gradle, MyBatis, PostgreSQL

## 프로젝트 루트

실제 애플리케이션 루트는 다음 경로입니다.

```powershell
cd C:\dev_source\Oasis\Oasis
```

`oasis_spring/`은 별도 Git 저장소이므로 루트 `git status`에서 modified content로 표시될 수 있습니다.

## 환경 변수

루트 `.env.local`:

```dotenv
API_PORT=4000
AI_SERVER_URL=http://localhost:8000
DATABASE_URL=postgresql://...

VITE_API_BASE_URL=/api
VITE_KAKAO_MAP_KEY=...
KAKAO_REST_API_KEY=...

VITE_EXTERNAL_SENSOR_API_BASE_URL=http://localhost:8080
VITE_VWORLD_API_KEY=...
VITE_VWORLD_DOMAIN=http://localhost:5173
```

`ai-server/.env`:

```dotenv
SEOUL_RAINFALL_API_KEY=...
SEOUL_DRAINPIPE_API_KEY=...
SEOUL_OPEN_API_BASE_URL=http://openAPI.seoul.go.kr:8088
SEOUL_RAINFALL_SERVICE=ListRainfallService
SEOUL_DRAINPIPE_SERVICE=DrainpipeMonitoringInfo

KMA_API_KEY=...
KMA_FORECAST_URL=https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst

EXPRESS_BASE_URL=http://localhost:4000
COLLECT_INTERVAL_SECONDS=600
DANGER_WATER_LEVEL_M=1.0
DRAINPIPE_MAX_WORKERS=25
KMA_MAX_WORKERS=4

OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```

Spring Boot는 `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `KAKAO_REST_API_KEY`, `SEOUL_WATER_API_KEY`를 사용합니다. 비밀값은 저장소에 커밋하지 않습니다.

## 설치

```powershell
cd C:\dev_source\Oasis\Oasis
npm.cmd install

cd ai-server
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 실행

프런트엔드, Express, FastAPI, 수집 스케줄러는 터미널 하나에서 실행합니다.

```powershell
cd C:\dev_source\Oasis\Oasis
npm.cmd run dev:all
```

실행 프로세스:

- Vite: `http://localhost:5173`
- Express: `http://localhost:4000`
- FastAPI: `http://localhost:8000`
- Scheduler: 서울시·기상청 수집 후 Express 전송, 기본 10분 주기

Spring 맨홀 API가 필요하면 별도 터미널에서 실행합니다.

```powershell
cd C:\dev_source\Oasis\Oasis\oasis_spring
.\gradlew.bat bootRun
```

## 화면 경로

| 경로 | 기능 |
| --- | --- |
| `/` | `/map`으로 이동 |
| `/map` | 통합 지도 관제 |
| `/risk-analysis` | 실시간 AI 위험도와 1~3시간 전망, 상황별 알림 |
| `/simulation` | 맨홀별 더미 수위 누적과 지역별 AI 위험도 시뮬레이션 |
| `/alerts` | 경보 관리 |
| `/reports` | 보고서 관리 |
| `/login`, `/signup` | 인증 화면 |
| `/dashboard`, `/digital-twin`, `/safe-route` | `/map`으로 이동 |

## 위험도 기준

`OASIS-RiskRule v2.0`은 다음 네 항목을 사용합니다.

```text
10분 강우량 환산 강우강도 30%
하수관로 위험수위 백분율 35%
수위 상승속도 20%
향후 예보 강우량 15%
```

단계:

- `SAFE`: 0~24
- `CAUTION`: 25~49
- `WARNING`: 50~74
- `DANGER`: 75~100

강제 승격 기준:

- 관로 수위 80% 이상: 최소 `WARNING`
- 관로 수위 90% 이상: `DANGER`
- 환산 강우강도 50mm/h 이상: 최소 `WARNING`
- 환산 강우강도 72mm/h 이상: `DANGER`
- 수위 상승속도 0.30m/h 이상: `DANGER`
- 예보 강우 합계 90mm 이상: `DANGER`

`drainageLevel`은 수위에서 파생된 값이므로 위험도 가중치에 중복 반영하지 않습니다. `confidence`는 위험점수가 아니라 강우·관로·예보 수집 성공 개수로 계산합니다.

## 실시간 데이터 흐름

```text
서울시 강우량 API ─┐
서울시 하수관로 API ├─ ai-server/scheduler.py
기상청 단기예보 API ┘          │
                                ├─ OASIS-RiskRule v2.0
                                └─ POST /api/update-live-status
                                           │
Express 메모리 + ai-server/data/latest-regional-status.json
                                           │
React Query → 지도 관제 / 위험도 분석
```

Express는 최신 지역 상태를 런타임 캐시에 저장하고 재시작 시 즉시 복원합니다. 캐시가 없는 최초 실행에서는 프런트엔드가 2초 간격으로 재조회합니다. 하수관과 기상청 조회는 병렬 수집합니다.

## 시뮬레이션 흐름

```text
Spring GET /api/manholes
        │
        ├─ 맨홀별 현재 수위를 초기값으로 사용
        ├─ 맨홀 ID별 유입·배수 민감도로 더미 수위 누적
        ├─ 자치구별 최대 수위 산출
        └─ 지역별 POST /api/predict-risk
                    │
                    └─ 지도 위험도 말풍선 + AI 위험도 카드
```

같은 강우 조건이어도 초기 수위와 맨홀별 민감도가 다르므로 지역별 결과가 달라집니다.

## 맨홀 좌표 보정

Spring `/api/manholes`는 `locations`와 최신 `sensor_logs`를 조인합니다. 동명 시설이 타 지역으로 지오코딩된 경우 Spring 재시작 후 다음 엔드포인트를 한 번 호출합니다.

```text
GET http://localhost:8080/api/geo-update
```

보정 로직은 `서울특별시 + 시설명`으로 검색하고 서울 경계 안 좌표만 저장하며, 이미 정상인 좌표는 건너뜁니다.

## 주요 API

Express:

- `GET /api/health`
- `GET /api/regions`
- `GET /api/regional-status`
- `GET /api/live-status?region=강남구`
- `GET /api/risk-forecast?region=강남구`
- `POST /api/predict-risk`
- `POST /api/generate-alert`
- `POST /api/update-live-status`
- `GET /api/vworld/seoul-districts`
- `GET /api/route/car`, `GET /api/route/walk`
- `GET /api/shelters`

FastAPI:

- `GET /health`
- `POST /predict`
- `POST /generate-alert`

Spring:

- `GET /api/manholes`
- `GET /api/geo-update`
- `GET /api/sensors/latest`
- `GET /api/test/swmm?rainfall=...` (레거시 테스트 엔드포인트)

## 검증

```powershell
cd C:\dev_source\Oasis\Oasis
npm.cmd run build
node --check server/index.js
python -m py_compile ai-server/main.py ai-server/scheduler.py ai-server/services/risk_predictor.py ai-server/services/alert_generator.py

cd oasis_spring
.\gradlew.bat build -x test
```

Vite 청크 크기 경고와 Git의 LF/CRLF 안내는 빌드 실패가 아닙니다.
