# OASIS 프로젝트 구조

OASIS는 침수 위험도 예측 대시보드입니다. 프론트엔드, Express API 서버, FastAPI AI 서버, Python 스케줄러가 분리되어 있고, 개발 중에는 `npm.cmd run dev:all`로 한 번에 실행합니다.

## 루트 파일

- `.env.local`: Express 서버와 DB 접속 환경 변수
- `.gitignore`: Git 추적 제외 설정
- `index.html`: Vite SPA 진입 HTML
- `package.json`: npm 의존성 및 개발 스크립트
- `package-lock.json`: npm 의존성 잠금 파일
- `README.md`: 설치, 실행, API 사용 안내
- `structure.md`: 프로젝트 구조 문서
- `tsconfig.json`: TypeScript 설정
- `vite.config.ts`: Vite 설정 및 `/api` 프록시 설정

## 실행 스크립트

`package.json`의 주요 스크립트입니다.

- `dev:fe`: `vite --host 0.0.0.0`
- `dev:be`: `node server/index.js`
- `dev:ai`: `cd ai-server && uvicorn main:app --port 8000`
- `dev:scheduler`: `cd ai-server && .\.venv\Scripts\python.exe scheduler.py`
- `dev:all`: `concurrently`로 위 4개 프로세스를 동시에 실행
- `build`: TypeScript 검사 후 Vite production build
- `preview`: Vite preview 서버 실행

## 주요 디렉터리

```text
Oasis/
├─ ai-server/
├─ server/
├─ src/
├─ index.html
├─ package.json
├─ README.md
├─ structure.md
├─ tsconfig.json
└─ vite.config.ts
```

## ai-server/

FastAPI AI 서버와 외부 API 수집 스케줄러가 있는 디렉터리입니다.

- `.env`: 기상청/하수관로 API 키와 수집 설정
- `main.py`: FastAPI 서버 진입점
  - `GET /health`: 모델 로드 상태 확인
  - `POST /predict`: 침수 위험도 예측
  - `riskScore`: 그래프에 사용할 0~100 위험도 점수
- `scheduler.py`: APScheduler 기반 수집 프로세스
  - 기상청 현재 강수량과 단기예보 강수량 수집
  - 하수관로 수위 데이터 수집
  - 수위 상승 속도 계산
  - 현재, +1h, +2h, +3h 예측 그래프 포인트 생성
  - Express `POST /api/update-live-status`로 최신 결과 전송
- `train.py`: 테스트용 위험도 모델 생성 스크립트
- `requirements.txt`: Python 의존성 목록
- `models/risk_model.pkl`: joblib으로 저장된 위험도 예측 모델

## server/

Express 기반 API 서버입니다. 프론트엔드와 AI 서버 사이의 게이트웨이 역할을 하고, 인증과 DB 접근도 담당합니다.

- `index.js`
  - PostgreSQL 연결 및 사용자 테이블 보장
  - 회원가입, 로그인, 로그아웃 API
  - `POST /api/predict-risk`: FastAPI `/predict`로 예측 요청 전달
  - `POST /api/update-live-status`: 스케줄러가 보낸 최신 실시간 상태 저장
  - `GET /api/live-status`: 대시보드 실시간 상태 조회
  - `GET /api/risk-forecast`: 침수 위험도 그래프용 예측 시계열 조회

## src/

React TypeScript 프론트엔드입니다.

```text
src/
├─ app/
├─ assets/
├─ features/
├─ pages/
├─ shared/
├─ main.tsx
└─ vite-env.d.ts
```

### src/app/

- `App.tsx`: 앱 루트 컴포넌트
- `providers.tsx`: 전역 Provider 설정
- `router.tsx`: React Router 라우팅 설정

### src/assets/

- `styles/global.css`: 전역 스타일

### src/features/

기능 단위 UI와 비즈니스 로직입니다.

- `alert-system/IncidentTimeline.tsx`: 최근 이벤트 타임라인
- `flood-prediction/AiPredictionPanel.tsx`: 수동/실시간 AI 침수 위험도 분석 패널
- `flood-prediction/RiskPredictionChart.tsx`: `/api/risk-forecast` 기반 1~3시간 침수 위험도 그래프
- `flood-prediction/mockData.ts`: 초기 화면 fallback 데이터
- `kakao-map/KakaoMapPanel.tsx`: 지도 패널
- `mcp-automation/McpAutomationPanel.tsx`: 자동화 패널
- `sensor-monitor/SensorStatusPanel.tsx`: 센서 상태 패널

### src/pages/

라우트 단위 페이지입니다.

- `AlertCenter/AlertCenterPage.tsx`
- `Dashboard/DashboardPage.tsx`
- `DigitalTwin/DigitalTwinPage.tsx`
- `Login/LoginPage.tsx`
- `MapView/MapViewPage.tsx`
- `Reports/ReportsPage.tsx`
- `SafeRoute/SafeRoutePage.tsx`
- `Signup/SignupPage.tsx`

### src/shared/

공통 API, 컴포넌트, 상태, 타입입니다.

- `api/client.ts`: Axios 클라이언트 설정
- `api/aiApi.ts`: AI 예측 및 위험도 그래프 API 클라이언트
- `api/authApi.ts`: 인증 API 클라이언트
- `components/AppShell.tsx`: 공통 앱 레이아웃
- `components/MetricTile.tsx`: 지표 카드
- `components/RoleGuard.tsx`: 역할 기반 접근 제어
- `hooks/useRealtimeClock.ts`: 실시간 시계 hook
- `store/authStore.ts`: 인증 상태
- `store/dashboardStore.ts`: 대시보드 fallback 상태
- `types/domain.ts`: 도메인 타입 정의

## 서버 포트

| 서비스 | 포트 | 설명 |
| --- | ---: | --- |
| Vite frontend | 5173 | React 개발 서버 |
| Express API | 4000 | API 게이트웨이 및 인증 서버 |
| FastAPI AI | 8000 | 침수 위험도 예측 서버 |
| Scheduler | 별도 포트 없음 | 외부 API 수집 후 Express로 전송 |

## 데이터 흐름

```text
기상청 API / 하수관로 API
        ↓
ai-server/scheduler.py
        ↓
FastAPI AI 모델 예측
        ↓
Express /api/update-live-status
        ↓
React Dashboard
  ├─ /api/live-status
  └─ /api/risk-forecast
```

## 실시간 침수 위험도 그래프

`RiskPredictionChart.tsx`는 더 이상 고정 더미 데이터만 사용하지 않습니다.

1. 컴포넌트 마운트 시 `/api/risk-forecast`를 호출합니다.
2. 30초마다 최신 예측 시계열을 다시 조회합니다.
3. 스케줄러 데이터가 아직 없으면 `mockData.ts`의 fallback 그래프를 표시합니다.
4. 스케줄러가 첫 수집에 성공하면 실제 API 기반 그래프로 전환됩니다.

예상 응답 형태:

```json
{
  "modelVersion": "OASIS-FloodNet v1.0",
  "confidence": 0.87,
  "points": [
    { "time": "현재", "risk": 62, "rainfall": 18, "riskLabel": "WARNING" },
    { "time": "+1h", "risk": 74, "rainfall": 27, "riskLabel": "WARNING" },
    { "time": "+2h", "risk": 81, "rainfall": 34, "riskLabel": "DANGER" },
    { "time": "+3h", "risk": 68, "rainfall": 22, "riskLabel": "WARNING" }
  ],
  "timestamp": "2026-06-17T11:00:00.000000"
}
```
