# OASIS 프로젝트 구조

이 문서는 `C:\dev_source\Oasis\Oasis`의 현재 코드 구조를 설명합니다.

## 전체 구조

```text
Oasis/
├─ ai-server/                  # FastAPI, 위험도 규칙, OpenAI 알림, 수집 스케줄러
│  ├─ main.py
│  ├─ scheduler.py
│  ├─ schemas/
│  │  └─ risk_schema.py
│  ├─ services/
│  │  ├─ feature_builder.py
│  │  ├─ risk_predictor.py
│  │  └─ alert_generator.py
│  ├─ data/                    # 최신 지역 위험도 런타임 캐시(ignored)
│  ├─ models/                  # 레거시 실험 모델 파일
│  ├─ train.py                 # 레거시 모델 생성 스크립트
│  ├─ requirements.txt
│  └─ .env.example
├─ oasis_spring/               # 별도 Git 저장소인 Spring 센서 백엔드
├─ server/
│  └─ index.js                 # Express API 게이트웨이
├─ public/
├─ sim/                        # 레거시 SWMM 목 서버
├─ src/
│  ├─ app/
│  ├─ assets/
│  ├─ features/
│  ├─ pages/
│  └─ shared/
├─ .env.local.example
├─ .gitignore
├─ index.html
├─ package.json
├─ README.md
├─ structure.md
├─ tsconfig.json
└─ vite.config.ts
```

## 런타임 구성

```text
브라우저 :5173
   │
   ├─ /api ─────────────── Express :4000
   │                          ├─ FastAPI :8000
   │                          ├─ PostgreSQL
   │                          ├─ Kakao/VWorld API
   │                          └─ 지역 위험도 메모리·파일 캐시
   │
   └─ 맨홀 API ─────────── Spring Boot :8080

Python Scheduler
   ├─ 서울시 강우량 API
   ├─ 서울시 하수관로 API
   ├─ 기상청 단기예보 API
   └─ Express /api/update-live-status
```

## 루트 파일

- `package.json`: Vite, Express, FastAPI, Scheduler 통합 실행 스크립트
- `vite.config.ts`: React 빌드와 `/api` Express 프록시
- `index.html`: React 진입 HTML과 Cesium 기본 경로 설정
- `.env.local`: Express, DB, 지도와 외부 API 런타임 설정
- `.gitignore`: 비밀 파일, 빌드 결과, Python 캐시, 위험도 런타임 캐시 제외
- `README.md`: 설치·실행·운영 기준
- `structure.md`: 코드 구조와 데이터 흐름

## 실행 스크립트

| 스크립트 | 역할 |
| --- | --- |
| `npm.cmd run dev:all` | FE, Express, FastAPI, Scheduler 동시 실행 |
| `npm.cmd run dev:fe` | Vite 개발 서버 |
| `npm.cmd run dev:be` | `node --watch` Express 서버 |
| `npm.cmd run dev:ai` | FastAPI 8000 |
| `npm.cmd run dev:scheduler` | 공공 API 수집 스케줄러 |
| `npm.cmd run build` | TypeScript 검사와 Vite 빌드 |

Spring은 `oasis_spring/gradlew.bat bootRun`으로 별도 실행합니다.

## ai-server

### `main.py`

- FastAPI 애플리케이션
- `GET /health`
- `POST /predict`: 투명한 위험도 규칙 호출
- `POST /generate-alert`: OpenAI 상황별 알림 생성
- 런타임 Random Forest 모델을 로드하지 않음

### `services/risk_predictor.py`

- `OASIS-RiskRule v2.0`
- SAFE/CAUTION/WARNING/DANGER 분류
- 강우, 관로 수위, 상승속도, 예보 강우 가중치 계산
- 단일 고위험 신호의 강제 승격
- 현재부터 3시간 후까지의 포인트 생성

### `services/feature_builder.py`

- 지역 상태 요청을 현재/+1h/+2h/+3h 센서 특징으로 변환
- 예상 수위와 남은 예보 강우량 생성

### `services/alert_generator.py`

- 계산된 위험점수는 변경하지 않고 알림 문구만 생성
- REALTIME/PARTIAL 모든 위험 단계에서 OpenAI 사용
- 키 누락, API 실패, JSON 오류 시 규칙 기반 fallback
- 생성 시각은 모델 응답이 아니라 서버 현재 시각 사용

### `scheduler.py`

- 서울시 10분 강우량 수집
- 서울시 25개 구 하수관로 조회
- 기상청 격자별 단기예보 조회
- 하수관·기상청 요청 병렬화
- 지역별 위험도 계산 후 Express에 전송
- APScheduler 10분 주기와 UDP 기반 중복 실행 잠금
- Windows UTF-8 출력 설정

### 레거시 파일

- `train.py`, `models/risk_model.pkl`: 과거 실험용 Random Forest 자산
- 현재 실시간 위험도 산정에는 사용하지 않음

## server

### `server/index.js`

- Express API 게이트웨이
- FastAPI `/predict`, `/generate-alert` 프록시
- 스케줄러의 지역 상태 수신
- 최신 지역 위험도를 메모리와 `ai-server/data/latest-regional-status.json`에 저장
- 재시작 시 캐시 즉시 복원
- PostgreSQL 회원가입·로그인
- VWorld 서울 자치구 경계 프록시
- Kakao 자동차 경로, 보행 경로, 대피소 API

주요 상태:

- `latestRegionalStatus`: 자치구별 전체 상태
- `latestLiveStatus`: 기본 지역 현재 상태
- `latestRiskForecast`: 기본 지역 전망

## oasis_spring

Spring Boot 센서 백엔드이며 루트 저장소와 별도의 Git 상태를 가집니다.

### 주요 구성

- `ManholeController`: `GET /api/manholes`
- `SensorLogController`: 최신 센서 로그
- `GeoUpdateController`: `GET /api/geo-update`
- `SeoulWaterLevelService`: 서울시 하수관로 수집과 DB 적재
- `KakaoGeoService`: 서울 한정 맨홀 좌표 검색
- `SensorLogMapper.xml`: locations와 최신 sensor_logs 조인

### 맨홀 좌표 보정

- 시설명 앞에 `서울특별시`를 추가해 검색
- 카카오 검색 결과 중 서울 경계 내부 좌표만 채택
- 이미 정상인 좌표는 건너뛰고 잘못된 좌표만 업데이트

### 레거시 SWMM

- `GET /api/test/swmm?rainfall=...` 엔드포인트는 남아 있음
- 현재 React 시뮬레이션 화면은 이 엔드포인트 대신 맨홀 API와 위험도 API를 사용

## src/app

- `src/main.tsx`: React DOM 진입점
- `App.tsx`: RouterProvider 렌더링
- `router.tsx`: 현재 라우팅
- `providers.tsx`: React Query 등 전역 provider

### 라우팅

| URL | 컴포넌트/동작 |
| --- | --- |
| `/` | `/map` redirect |
| `/map` | `MapViewPage` |
| `/risk-analysis` | `RiskAnalysisPage` |
| `/simulation` | `SimulationPage` |
| `/alerts` | `AlertCenterPage` |
| `/reports` | `ReportsPage` |
| `/login` | `LoginPage` |
| `/signup` | `SignupPage` |
| `/dashboard`, `/digital-twin`, `/safe-route` | `/map` redirect |

## src/features

### `kakao-map/RegionRiskMapPanel.tsx`

- 카카오 지도와 서울 범위 제한
- 모니터링 지역 위험도 말풍선
- 선택 지역·다중 지역 기준 맨홀 필터링
- VWorld 경계가 없을 때 가장 가까운 자치구 중심으로 fallback 분류
- 맨홀 단색 마커와 수위 상세 정보
- 시뮬레이션의 지역별 위험도 override 지원
- 대피소와 대피 경로 레이어

### `flood-prediction/`

- `AiPredictionPanel.tsx`: 실시간 위험도, 강우, 관로, 예보 UI
- `RiskPredictionChart.tsx`: 현재~3시간 위험도 차트
- 빈 상태에서는 지역 상태를 2초 간격으로 재조회

### `safe-route/`

- 대피소, 현재 위치, 반경 필터와 선택 경로 Zustand store
- 통합 지도에서 자동차/보행 경로 표시

### 기타

- `alert-system/`: 이벤트 타임라인
- `sensor-monitor/`: 센서 상태 패널

## src/pages

### `MapView/MapViewPage.tsx`

- 전체 화면 지도 관제
- 선택 지역 위험도, 실시간 관측값과 단기예보
- 지역 위험도·하수관로·대피 경로 레이어 토글
- 빈 데이터 상태 2초 재조회, 정상 상태 30초 재조회

### `RiskAnalysis/RiskAnalysisPage.tsx`

- URL `region`과 전역 선택 지역 동기화
- 지역 현재 위험도와 1~3시간 차트
- REALTIME/PARTIAL 상태의 OpenAI 상황별 알림
- 데이터 부족 시 분석 불가 표시

### `Simulation/SimulationPage.tsx`

- Spring 맨홀 API 실측 수위를 초기값으로 사용
- 선택 지역의 맨홀만 지도에 표시
- 맨홀 ID별 유입·배수 민감도로 더미 수위 누적
- 자치구별 최대 수위와 별도 AI 위험도 요청
- 지역별 위험도 말풍선과 최고 위험 지역 카드

### 기타 페이지

- `AlertCenterPage`: 경보 관리
- `ReportsPage`: 보고서 관리
- `LoginPage`, `SignupPage`: 인증

## src/shared

### `api/`

- `client.ts`: Express `/api` Axios client
- `aiApi.ts`: 위험도, 지역 상태, OpenAI 알림 API
- `externalApi.ts`: Spring 센서 API 기본 주소
- `vworldApi.ts`: VWorld 경계 응답 변환
- `authApi.ts`: 인증 API

### `store/`

- `dashboardStore.ts`: 전역 `selectedRegion`
- `authStore.ts`: 인증 상태

### `constants/regionCoordinates.ts`

- 서울 25개 구 중심 좌표
- 위험도 모니터링 대상 10개 구 목록
- 지도와 시뮬레이션의 지역 좌표 lookup

## 핵심 데이터 계약

`selectedRegion`은 지도, 위험도 분석, URL deep link와 관측 패널의 공통 지역 계약입니다. 시뮬레이션은 별도의 `selectedRegions` 배열을 지도에 전달해 다중 지역을 지원합니다.

지역 상태 주요 필드:

```text
rainfall, rainfallUnit
waterLevel, drainageLevel, waterLevelRiseRate
forecastRainfall1h/2h/3h, forecastStatus
riskScore, riskLabel, confidence
dataStatus, dataStatusMessage, source
points, reasons, message, timestamp
```

`dataStatus`:

- `REALTIME`: 강우·관로·예보 모두 성공
- `PARTIAL`: 일부 성공
- `UNAVAILABLE`: 핵심 실측 부족
- `FALLBACK`: fallback 상태

## 유지보수 검증

```powershell
npm.cmd run build
node --check server/index.js
python -m py_compile ai-server/main.py ai-server/scheduler.py ai-server/services/risk_predictor.py ai-server/services/alert_generator.py

cd oasis_spring
.\gradlew.bat build -x test
```

LF/CRLF 안내와 Vite 청크 크기 경고는 별도 오류가 없는 한 빌드 실패가 아닙니다.
