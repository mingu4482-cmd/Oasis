"""
실제 API를 호출하는 라이브 테스트.
.env에 OPENAI_API_KEY, SLACK_WEBHOOK_URL이 채워져 있어야 합니다.
모킹 없이 실제로 OpenAI에 요청을 보내고, 실제로 Slack에 메시지를 보냅니다.
"""

from oasis_mcp_server import (
    get_current_status,
    generate_response_manual,
    send_slack_alert,
    run_oasis_alert,
)

print("1) 센서 현황 조회")
status = get_current_status("gangnam-001")
print(status)

print("\n2) OpenAI로 실제 보고서 생성 중...")
manual = generate_response_manual(status)
print("--- 생성된 보고서 ---")
print(manual)

print("\n3) Slack으로 실제 발송 중...")
result = send_slack_alert(manual)
print("발송 결과:", result)

print("\n위 1~3 과정을 한 번에 실행하는 run_oasis_alert 테스트")
full = run_oasis_alert("gangnam-001")
print("Slack 발송 성공 여부:", full["slack_result"]["success"])
