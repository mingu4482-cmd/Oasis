# OASIS MCP Server

도시 침수 대응 업무 자동화 MCP 서버. 알림 발송, 보고서 생성, 체크리스트, 대피소 안내까지 침수 대응 전 과정을 도구화했습니다.

## 설치

```bash
pip install -r requirements.txt
cp .env.example .env   # 값 채우기
```

## 실행

```bash
python oasis_mcp_server.py
```

Claude Desktop 등 MCP 클라이언트의 `mcp.json`에 등록해서 사용합니다.

## 테스트

```bash
python test_all.py      # 전체 도구 통합 테스트 (AI 응답은 모킹)
python test_slack.py    # Slack Webhook 단독 연결 확인
```

## 도구 목록 (15개)

### 기존 (1차 구현)
| 도구 | 설명 |
|------|------|
| `get_current_status` | 위치별 센서 현황 조회 |
| `generate_response_manual` | GPT 기반 Slack 보고서 생성 |
| `send_slack_alert` | Slack Webhook 발송 |
| `run_oasis_alert` | 위 3개를 순서대로 실행하는 단일 진입점 |

### 신규 추가
| 도구 | 설명 |
|------|------|
| `get_multi_location_status` | 여러 위치 일괄 조회, 위험도순 정렬 |
| `assess_flood_risk` | 수위·강수량·상승속도·토양포화도·상류위험 가중합산 위험도 산출 |
| `generate_checklist` | 위험단계 × 대상역할(현장요원/관제센터/시민)별 체크리스트 생성 |
| `send_sms_alert` | 솔라피(Solapi) 기반 SMS 대량 발송 |
| `send_kakao_alert` | 카카오 비즈메시지 발송 |
| `create_incident_report` | Markdown 사고보고서 + AI 3줄 요약 생성 |
| `log_incident` | SQLite에 사건 기록 (중복 시 업데이트) |
| `get_safe_shelters` | 공공데이터포털 연동 주변 대피소 조회 (거리순) |
| `get_weather_forecast` | 기상청 단기예보로 3시간 강수 전망 + 위험도 평가 |
| `broadcast_emergency` | **오케스트레이터** — 현황조회→체크리스트→보고서→Slack/SMS/카카오 동시발송→DB기록을 한 번에 실행 |
| `get_incident_history` | 사건 이력 조회 (위치/상태 필터) |

## 핵심 흐름

```
센서 데이터
    │
    ▼
assess_flood_risk (위험도 산출)
    │
    ▼
get_current_status ──┬──▶ generate_checklist (역할별 체크리스트)
                      ├──▶ generate_response_manual (AI 보고서)
                      └──▶ get_weather_forecast (예보 확인)
    │
    ▼
broadcast_emergency
    ├──▶ send_slack_alert
    ├──▶ send_sms_alert
    ├──▶ send_kakao_alert
    ├──▶ create_incident_report
    └──▶ log_incident
```

가장 빠르게 전체 대응을 트리거하려면 `broadcast_emergency` 하나만 호출하면 됩니다.

## 환경변수 (.env)

| 변수 | 필수 여부 | 용도 |
|------|----------|------|
| `OPENAI_API_KEY` | 필수 | AI 보고서/요약 생성 |
| `SLACK_WEBHOOK_URL` | 필수 | Slack 알림 |
| `SOLAPI_API_KEY` / `SOLAPI_API_SECRET` / `SOLAPI_FROM_NUMBER` | 선택 | SMS 발송 (없으면 해당 기능만 비활성화) |
| `KAKAO_API_KEY` / `KAKAO_SENDER_KEY` | 선택 | 카카오 알림 |
| `PUBLIC_DATA_KEY` | 선택 | 대피소 조회 (없으면 목 데이터) |
| `WEATHER_API_KEY` | 선택 | 기상 예보 (없으면 목 데이터) |
| `DB_PATH` | 선택 | SQLite 파일 경로 (기본: oasis_incidents.db) |

키가 없는 항목은 목(mock) 데이터로 동작하므로 데모/테스트에 지장이 없습니다.

## 실제 연동 시 교체 지점

`get_current_status`는 현재 목 데이터입니다. 실제 운영 환경에서는 OASIS 백엔드의 InfluxDB/FastAPI 센서 API를 호출하도록 교체하세요 (주석으로 표시되어 있습니다).
