# OASIS 프로젝트 구조

OASIS는 공공 API 기반 침수 위험도 수집, AI 예측, 상황별 알림 생성, 지도/대피 경로 화면을 제공하는 React + Express + FastAPI 프로젝트입니다. 실제 앱 루트는 `C:\dev_source\Oasis\Oasis`입니다.

## 루트 파일

- `.env.local`: Express 서버, DB, 선택적 경로 API 환경 변수
- `.editorconfig`: UTF-8, CRLF 등 편집기 기본 설정
- `.gitignore`: Git 추적 제외 설정
- `index.html`: Vite SPA 진입 HTML
- `package.json`: npm 의존성 및 개발 스크립트
- `package-lock.json`: npm 의존성 잠금 파일
- `README.md`: 설치, 실행, API 사용 안내
- `structure.md`: 현재 프로젝트 구조 문서
- `tsconfig.json`: TypeScript 설정
- `vite.config.ts`: Vite 설정 및 `/api` 프록시 설정

## 실행 스크립트

- `api`: `node server/index.js`
- `dev`: Vite 개발 서버
- `dev:fe`: Vite 개발 서버
- `dev:be`: Express API 서버
- `dev:ai`: FastAPI AI 서버
- `dev:scheduler`: Python 스케줄러
- `dev:all`: `concurrently`로 프론트엔드, Express, FastAPI, 스케줄러 동시 실행
- `build`: TypeScript 검사 후 Vite production build
- `preview`: Vite preview 서버 실행

## 디렉터리 개요

```text
Oasis/
├─ ai-server/
│  ├─ models/
│  │  └─ risk_model.pkl
│  ├─ schemas/
│  │  └─ risk_schema.py
│  ├─ services/
│  │  ├─ alert_generator.py
│  │  ├─ feature_builder.py
│  │  └─ risk_predictor.py
│  ├─ .env.example
│  ├─ main.py
│  ├─ requirements.txt
│  ├─ scheduler.py
│  └─ train.py
├─ public/
│  └─ index.html
├─ server/
│  └─ index.js
├─ src/
│  ├─ app/
│  ├─ assets/
│  ├─ features/
│  ├─ pages/
│  ├─ shared/
│  ├─ main.tsx
│  └─ vite-env.d.ts
├─ index.html
├─ package.json
├─ README.md
├─ structure.md
├─ tsconfig.json
└─ vite.config.ts
```

## ai-server

FastAPI AI 서버와 Python 스케줄러가 있는 영역입니다.

- `main.py`
  - `.env` 로드
  - `models/risk_model.pkl` 로드
  - `GET /health`
  - `POST /predict`
  - `POST /generate-alert`
- `scheduler.py`
  - 서울시 강우량 API 수집
  - 서울시 하수관로 수위 API 수집
  - 기상청 단기예보 API 수집
  - 지역별 수위 상승 속도 및 위험도 payload 생성
  - Express `POST /api/update-live-status`로 전송
- `schemas/risk_schema.py`
  - 위험도 예측 요청/응답 타입
  - 예측 시계열 타입
  - 상황별 알림 요청/응답 타입
- `services/risk_predictor.py`
  - 모델 기반 예측
  - fallback scoring
  - `SAFE`, `CAUTION`, `WARNING`, `DANGER` 분류
- `services/feature_builder.py`
  - 모델 입력 feature 생성
  - 예측 시계열용 센서 데이터 생성
- `services/alert_generator.py`
  - `OPENAI_API_KEY`, `OPENAI_MODEL` 기반 LLM 알림 생성
  - OpenAI 실패 또는 키 없음 시 rule 기반 fallback 알림 생성
- `train.py`
  - 테스트용 `risk_model.pkl` 생성 스크립트
- `.env.example`
  - 서울시, 기상청, Express 전송, OpenAI 알림 설정 예시

## server

Express API 게이트웨이입니다.

- PostgreSQL 사용자 테이블 보장
- 회원가입, 로그인, 로그아웃 처리
- FastAPI `/predict`를 `/api/predict-risk`로 프록시
- FastAPI `/generate-alert`를 `/api/generate-alert`로 프록시
- 스케줄러가 보낸 최신 지역별 상태를 메모리에 저장
- `/api/regions`, `/api/regional-status`, `/api/live-status`, `/api/risk-forecast` 제공
- 카카오모빌리티 자동차 경로와 T맵 도보 경로 API 제공
- 도보 경로 API 키가 없으면 직선거리 fallback 반환

## src/app

- `App.tsx`: 라우터를 렌더링하는 앱 루트
- `providers.tsx`: React Query 등 전역 Provider 설정
- `router.tsx`: 라우트 정의

라우트:

| path | page |
| --- | --- |
| `/` | `/dashboard`로 redirect |
| `/dashboard` | `DashboardPage` |
| `/map` | `MapViewPage` |
| `/digital-twin` | `DigitalTwinPage` |
| `/risk-analysis` | `RiskAnalysisPage` |
| `/alerts` | `AlertCenterPage` |
| `/reports` | `ReportsPage` |
| `/safe-route` | `SafeRoutePage` |
| `/login` | `LoginPage` |
| `/signup` | `SignupPage` |

## src/features

- `alert-system/IncidentTimeline.tsx`: 최근 침수/경보 이벤트 타임라인
- `flood-prediction/AiPredictionPanel.tsx`: 선택 지역 실시간 수집값과 AI 위험도 표시
- `flood-prediction/RiskPredictionChart.tsx`: `/api/risk-forecast` 기반 위험도 차트
- `flood-prediction/mockData.ts`: 센서/지도/이벤트 최소 fallback 데이터
- `kakao-map/KakaoMapPanel.tsx`: 대시보드 지도형 요약 패널
- `safe-route/`
  - `ShelterMapPanel.tsx`: 대피소 지도 패널
  - `ShelterList.tsx`: 대피소 목록과 경로 안내 UI
  - `safeRouteStore.ts`: 현재 위치, 대피소 선택, 경로 조회 상태
  - `mockData.ts`: 대피소 fallback 데이터
- `sensor-monitor/SensorStatusPanel.tsx`: 센서 상태 요약

## src/pages

- `Dashboard/DashboardPage.tsx`
  - 주요 지표
  - 주요 위험 지역 TOP 3
  - 지도, 이벤트, 센서 요약
- `RiskAnalysis/RiskAnalysisPage.tsx`
  - 실시간 AI 위험도 패널
  - 위험도 차트
  - OpenAI 또는 fallback 기반 상황별 알림 카드
- `SafeRoute/SafeRoutePage.tsx`
  - 대피소 선택
  - 자동차/도보 경로 안내
- `MapView/MapViewPage.tsx`
  - 통합 지도 화면
- `DigitalTwin/DigitalTwinPage.tsx`
  - 침수 깊이 시각화 화면
- `AlertCenter/AlertCenterPage.tsx`
  - 경보 관리 화면
- `Reports/ReportsPage.tsx`
  - 보고서 대기열 화면
- `Login/LoginPage.tsx`, `Signup/SignupPage.tsx`
  - 인증 화면

## src/shared

- `api/client.ts`: Axios 기본 클라이언트, 기본 baseURL은 `/api`
- `api/aiApi.ts`: 위험도 예측, 지역 상태, 위험도 차트, 상황별 알림 API
- `api/authApi.ts`: 로그인, 회원가입, 로그아웃 API
- `components/AppShell.tsx`: 상단바, 사이드바, 공통 레이아웃
- `components/MetricTile.tsx`: 지표 카드
- `components/RoleGuard.tsx`: 역할 기반 접근 제어
- `hooks/useRealtimeClock.ts`: 실시간 시계 hook
- `store/authStore.ts`: 인증 상태 저장
- `store/dashboardStore.ts`: 선택 지역과 대시보드 fallback 상태
- `types/domain.ts`: 공통 도메인 타입

## 데이터 흐름

```text
서울시 강우량 API
서울시 하수관로 수위 API
기상청 단기예보 API
        ↓
ai-server/scheduler.py
        ↓
risk_predictor.py
        ↓
Express /api/update-live-status
        ↓
React
  ├─ DashboardPage
  ├─ RiskAnalysisPage
  └─ RiskPredictionChart
```

상황별 알림 흐름:

```text
React RiskAnalysisPage
        ↓
Express /api/generate-alert
        ↓
FastAPI /generate-alert
        ↓
alert_generator.py
  ├─ OpenAI API 사용 가능: source=openai
  └─ 키 없음/실패: source=fallback
```

## 유지 중인 핵심 API

Express:

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/predict-risk`
- `POST /api/generate-alert`
- `POST /api/update-live-status`
- `GET /api/regions`
- `GET /api/regional-status`
- `GET /api/live-status?region=...`
- `GET /api/risk-forecast?region=...`
- `GET /api/route/car`
- `GET /api/route/walk`

FastAPI:

- `GET /health`
- `POST /predict`
- `POST /generate-alert`

## 정리된 항목

현재 구조에서는 MCP 서버, 수동 시뮬레이션 UI/API, AIHub, 부산 API, 기상청 AWS 관련 코드가 제거되어 있습니다. LLM 기능은 `OPENAI_API_KEY` 기반 상황별 알림 생성에만 사용됩니다.
