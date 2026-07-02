import json
import logging
import os
from datetime import datetime
from typing import Any

from schemas.risk_schema import GenerateAlertRequest, GenerateAlertResponse


logger = logging.getLogger("oasis-ai-alert-generator")

ALERT_RULES = {
    "SAFE": {
        "alertLevel": "정상",
        "targetGroup": [],
        "title": "{region} 침수 위험 정상",
        "message": "현재 침수 위험은 낮은 상태입니다.",
        "actions": ["지속 모니터링"],
    },
    "CAUTION": {
        "alertLevel": "관심",
        "targetGroup": ["관제 담당자"],
        "title": "{region} 침수 위험 관심 단계",
        "message": "침수 위험이 다소 증가했습니다. 지속적인 모니터링이 필요합니다.",
        "actions": ["강우량 및 하수관로 수위 변화 확인", "취약 지역 모니터링 유지"],
    },
    "WARNING": {
        "alertLevel": "주의",
        "targetGroup": ["운영자", "유지보수팀"],
        "title": "{region} 침수 위험 주의 경보",
        "message": "침수 위험이 높아지고 있습니다. 배수 시설 점검과 현장 확인이 필요합니다.",
        "actions": ["배수 시설 점검", "현장 순찰 강화", "저지대 도로 상황 확인"],
    },
    "DANGER": {
        "alertLevel": "긴급",
        "targetGroup": ["관리자", "상황실", "지자체 담당자"],
        "title": "{region} 침수 위험 긴급 경보",
        "message": "침수 위험이 매우 높습니다. 즉시 대응이 필요합니다.",
        "actions": ["긴급 대응 체계 가동", "도로 통제 검토", "주민 안내 준비", "배수 펌프 가동 상태 확인"],
    },
}


def fallback_alert(payload: GenerateAlertRequest) -> GenerateAlertResponse:
    rule = ALERT_RULES.get(payload.riskLabel, ALERT_RULES["CAUTION"])
    return GenerateAlertResponse(
        alertLevel=rule["alertLevel"],
        targetGroup=rule["targetGroup"],
        title=rule["title"].format(region=payload.region),
        message=rule["message"],
        actions=rule["actions"],
        createdAt=datetime.now().isoformat(),
        source="fallback",
    )


def build_prompt(payload: GenerateAlertRequest) -> str:
    return (
        "너는 도시침수 관제 시스템의 알림 문구 생성 도우미다.\n"
        "입력으로 주어진 riskScore와 riskLabel은 이미 예측모델이 계산한 결과다.\n"
        "위험도를 새로 계산하거나 등급을 바꾸지 마라.\n"
        "입력값을 바탕으로 알림 제목, 알림 대상, 메시지, 대응 조치만 생성하라.\n"
        "공공기관 관제 대시보드에 어울리는 간결하고 공식적인 한국어를 사용하라.\n"
        "과장된 표현은 피하고, 입력값에 근거한 대응 문구만 생성하라.\n"
        "응답은 반드시 JSON 객체만 반환하라.\n\n"
        f"입력 데이터:\n{payload.model_dump_json(ensure_ascii=False)}\n\n"
        "반환 JSON schema:\n"
        '{"alertLevel": string, "targetGroup": string[], "title": string, '
        '"message": string, "actions": string[], "source": "openai"}'
    )


def extract_response_text(response: Any) -> str:
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    output = getattr(response, "output", None)
    if isinstance(output, list):
        chunks = []
        for item in output:
            for content in getattr(item, "content", []) or []:
                text = getattr(content, "text", None)
                if text:
                    chunks.append(text)
        if chunks:
            return "\n".join(chunks)

    return ""


def normalize_openai_alert(data: dict[str, Any]) -> GenerateAlertResponse:
    return GenerateAlertResponse(
        alertLevel=str(data.get("alertLevel", "")).strip() or "관심",
        targetGroup=[str(item) for item in data.get("targetGroup", []) if str(item).strip()],
        title=str(data.get("title", "")).strip() or "침수 위험 알림",
        message=str(data.get("message", "")).strip() or "침수 위험 상태를 확인하세요.",
        actions=[str(item) for item in data.get("actions", []) if str(item).strip()] or ["상황 모니터링"],
        createdAt=datetime.now().isoformat(),
        source="openai",
    )


def generate_alert(payload: GenerateAlertRequest) -> GenerateAlertResponse:
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if not api_key:
        return fallback_alert(payload)

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        response = client.responses.create(
            model=model,
            input=build_prompt(payload),
            text={"format": {"type": "json_object"}},
        )
        response_text = extract_response_text(response)
        data = json.loads(response_text)
        if not isinstance(data, dict):
            raise ValueError("OpenAI alert response is not a JSON object")
        return normalize_openai_alert(data)
    except Exception as error:
        logger.warning("OpenAI alert generation failed. Using fallback alert. error=%s", error)
        return fallback_alert(payload)
