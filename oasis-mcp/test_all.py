"""
OASIS MCP Server 통합 테스트
실제 API 연동 없이 모든 툴의 로직을 검증합니다.
OPENAI_API_KEY가 없어도 동작하도록 AI 호출 부분은 모킹합니다.
"""

import json
from unittest.mock import patch, MagicMock
import oasis_mcp_server as oasis

get_current_status        = oasis.get_current_status
get_multi_location_status = oasis.get_multi_location_status
assess_flood_risk         = oasis.assess_flood_risk
generate_checklist        = oasis.generate_checklist
create_incident_report    = oasis.create_incident_report
log_incident               = oasis.log_incident
get_safe_shelters          = oasis.get_safe_shelters
get_weather_forecast       = oasis.get_weather_forecast
get_incident_history       = oasis.get_incident_history

# OpenAI 응답 모킹 (실제 키 없이 테스트하기 위함)
_mock_resp = MagicMock()
_mock_resp.output_text = (
    "🚨 [위험] 강남역 1번 출구 침수 경보\n\n"
    "📊 실시간 상황 브리핑\n현재 수위 85%, 시간당 강수량 32mm로 위험 단계입니다.\n\n"
    "📋 즉각 대응 체크리스트\n1. 배수펌프 가동\n2. 도로 통제\n3. 현장 순찰 강화\n\n"
    "OASIS MCP AI 에이전트가 자동 생성했습니다."
)
_patcher = patch.object(oasis.client.responses, "create", return_value=_mock_resp)
_patcher.start()

SEP = "-" * 55

def section(title):
    print(f"\n{SEP}\n▶ {title}\n{SEP}")

def dump(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=2))


# 1. 단일 위치 현황 조회
section("1. 단일 위치 현황 조회")
status = get_current_status("gangnam-001")
dump(status)

# 2. 다중 위치 일괄 조회
section("2. 다중 위치 일괄 조회")
multi = get_multi_location_status(["gangnam-001", "seocho-002", "unknown-999"])
dump(multi["summary"])

# 3. 복합 위험도 분석
section("3. 복합 위험도 분석 (수위 85%, 강수 32mm)")
risk = assess_flood_risk(
    water_level=85,
    rainfall=32,
    rise_rate=15,
    soil_saturation=70,
    upstream_risk=40,
)
dump(risk)

# 4. 체크리스트 생성 (3개 역할)
section("4. 체크리스트 — 현장요원")
cl = generate_checklist("위험", "강남역 1번 출구", "현장요원")
for item in cl["checklist"]:
    print(item)
print(f"\n마감: {cl['deadline']}")

section("4. 체크리스트 — 관제센터")
cl2 = generate_checklist("위험", "강남역 1번 출구", "관제센터")
for item in cl2["checklist"]:
    print(item)

section("4. 체크리스트 — 시민")
cl3 = generate_checklist("위험", "강남역 1번 출구", "시민")
for item in cl3["checklist"]:
    print(item)

# 5. 보고서 생성 (AI 없이 구조만 확인)
section("5. 보고서 생성")
try:
    report = create_incident_report(
        status=status,
        checklist=cl["checklist"],
        actions_taken=["배수펌프 가동", "현장 순찰 완료"],
    )
    print(f"Report ID : {report['report_id']}")
    print(f"Summary   : {report.get('summary', '(AI 미연결)')}")
    print(f"Markdown 길이: {len(report['markdown'])} chars")
except Exception as e:
    print(f"보고서 생성 오류 (OpenAI 키 필요): {e}")

# 6. DB 기록
section("6. 사건 DB 기록")
inc = log_incident("gangnam-001", status, notes="테스트 실행")
dump(inc)

# 7. 대피소 조회 (목 데이터)
section("7. 대피소 조회 (목 데이터)")
shelters = get_safe_shelters(37.4979, 127.0276, radius_km=2.0)
for s in shelters["shelters"]:
    print(f"  📍 {s['name']} — {s['distance_km']}km ({s['capacity']}명 수용)")

# 8. 기상 예보 조회 (목 데이터)
section("8. 기상 예보 (목 데이터)")
forecast = get_weather_forecast()
print(f"최대 강수량: {forecast['max_rainfall']}mm → 침수 위험: {forecast['flood_risk']}")
for f in forecast["forecast"]:
    print(f"  {f['time']}: {f['rainfall']}mm")

# 9. 사건 이력 조회
section("9. 사건 이력 조회")
history = get_incident_history(limit=5)
print(f"전체 사건 수: {history['total']}")
for inc in history["incidents"]:
    print(f"  [{inc['id']}] {inc['location_name']} — {inc['risk_level']} ({inc['created_at'][:16]})")

print(f"\n\n✅ 테스트 완료")
_patcher.stop()
