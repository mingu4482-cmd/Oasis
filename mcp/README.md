# OASIS MCP — 전체 패키지

도시 침수 대응 자동화 MCP 서버 + 프론트엔드 연동 파일 통합본.

---

## 파일 구성

### 백엔드 MCP 서버 (Python)
| 파일 | 설명 |
|------|------|
| `oasis_mcp_server.py` | FastMCP 서버 본체 (15개 도구) |
| `requirements.txt` | 패키지 목록 |
| `.env.example` | 환경변수 예시 |
| `test_all.py` | 전체 도구 통합 테스트 (AI 모킹) |
| `test_live.py` | 실제 OpenAI + Slack 호출 테스트 |
| `test_slack.py` | Slack Webhook 단독 테스트 |

### 프론트엔드 연동 파일 (React/TypeScript)
| 파일 | 프로젝트 경로 | 설명 |
|------|--------------|------|
| `mcpApi.ts` | `src/shared/api/mcpApi.ts` | MCP API 클라이언트 (새 파일) |
| `AlertCenterPage.tsx` | `src/pages/AlertCenter/AlertCenterPage.tsx` | 경보 관리 — 전채널 경보 발령 |
| `ReportsPage.tsx` | `src/pages/Reports/ReportsPage.tsx` | 보고서 — AI 자동 생성 |
| `SimulationPage.tsx` | `src/pages/Simulation/SimulationPage.tsx` | 시뮬레이션 — MCP 위험도 분석 |

---

## 설치 및 실행

### 1. 백엔드 MCP 서버

```bash
pip install -r requirements.txt
cp .env.example .env
# .env 파일에 키 채우기
python oasis_mcp_server.py
```

정상 실행되면 MCP 엔드포인트는 `http://127.0.0.1:8001/mcp`에 열립니다.
이 주소는 일반 웹페이지나 REST API가 아니라 MCP Streamable HTTP 주소입니다.
stdio 방식의 MCP 클라이언트를 사용할 때는 `.env`에
`MCP_TRANSPORT=stdio`를 설정하세요.

브라우저에서 보고서 자동 생성 화면을 확인하려면 서버 실행 후 아래 주소를
엽니다.

```text
http://127.0.0.1:8001/reports
```

Vite 개발 서버(`localhost:5173`)에서도 아래 주소로 같은 화면을 열 수 있습니다.
이 경우에도 MCP Python 서버는 8001번에서 함께 실행 중이어야 합니다.

```text
http://localhost:5173/mcp/reports.html
```

보고서 화면과 REST 호환 API는 모두 `mcp` 폴더 내부에서 제공되며 기존
프론트엔드 및 백엔드 코드를 수정하지 않습니다.

### 2. 프론트엔드 연동

프론트 프로젝트 `.env`에 추가:
```
VITE_MCP_API_URL=http://localhost:8000
```

파일 배치:
```
mcpApi.ts          →  src/shared/api/mcpApi.ts       (새 파일)
AlertCenterPage.tsx →  src/pages/AlertCenter/          (기존 교체)
ReportsPage.tsx     →  src/pages/Reports/              (기존 교체)
SimulationPage.tsx  →  src/pages/Simulation/           (기존 교체)
```

> ⚠️ MCP 서버 앞에 HTTP REST 래퍼(FastAPI 또는 Express)가 필요합니다.
> 프론트는 `/api/mcp/*` 엔드포인트로 호출하며, MCP 서버가 해당 도구를 실행합니다.

---

## MCP 도구 15개

### 기존 (1차)
| 도구 | 설명 |
|------|------|
| `get_current_status` | 위치 센서 현황 조회 |
| `generate_response_manual` | GPT 기반 Slack 보고서 생성 |
| `send_slack_alert` | Slack Webhook 발송 |
| `run_oasis_alert` | 위 3개 통합 실행 |

### 신규 추가
| 도구 | 연동 화면 | 설명 |
|------|----------|------|
| `get_multi_location_status` | — | 다중 위치 일괄 조회 |
| `assess_flood_risk` | 시뮬레이션, AI 분석 | 복합 위험도 점수 산출 |
| `generate_checklist` | 시뮬레이션, 경보 | 역할별 체크리스트 생성 |
| `send_sms_alert` | 경보 관리 | Solapi SMS 대량 발송 |
| `send_kakao_alert` | 경보 관리 | 카카오 알림톡 발송 |
| `create_incident_report` | 보고서 | Markdown 사고보고서 + AI 요약 |
| `log_incident` | 경보 관리 | SQLite 사건 기록 |
| `get_safe_shelters` | 지도 | 주변 대피소 조회 |
| `get_weather_forecast` | — | 기상청 단기예보 |
| `broadcast_emergency` | 경보 관리 | 전채널 동시 경보 오케스트레이터 |
| `get_incident_history` | 경보 관리, 보고서 | 사건 이력 조회 |

---

## 환경변수 (.env)

| 변수 | 필수 | 용도 |
|------|------|------|
| `OPENAI_API_KEY` | ✅ | AI 보고서·요약 생성 |
| `SLACK_WEBHOOK_URL` | ✅ | Slack 알림 |
| `SOLAPI_API_KEY` | 선택 | SMS 발송 |
| `SOLAPI_API_SECRET` | 선택 | SMS 발송 |
| `SOLAPI_FROM_NUMBER` | 선택 | SMS 발신번호 |
| `KAKAO_API_KEY` | 선택 | 카카오 알림톡 |
| `KAKAO_SENDER_KEY` | 선택 | 카카오 알림톡 |
| `PUBLIC_DATA_KEY` | 선택 | 대피소 조회 |
| `WEATHER_API_KEY` | 선택 | 기상청 예보 |
| `DB_PATH` | 선택 | SQLite 경로 (기본: oasis_incidents.db) |

선택 항목은 없으면 목 데이터로 자동 대체됩니다.
