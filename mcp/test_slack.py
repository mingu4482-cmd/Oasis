"""
Slack Webhook 연결 단독 테스트.
.env에 SLACK_WEBHOOK_URL을 설정한 뒤 실행하세요.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SLACK_WEBHOOK_URL")

if not url:
    print("❌ SLACK_WEBHOOK_URL이 .env에 설정되지 않았습니다.")
    exit(1)

message = """
🚨 [OASIS 테스트 알림]

Slack Webhook 연결 테스트입니다.
이 메시지가 보이면 Webhook 연결 성공입니다.
"""

response = requests.post(url, json={"text": message}, timeout=10)

print(response.status_code)
print(response.text)
