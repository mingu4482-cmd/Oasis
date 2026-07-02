"""FastMCP 서버에 OASIS 보고서용 HTTP 경로를 추가한다."""

from pathlib import Path
from typing import Any

import anyio
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, Response

BASE_DIR = Path(__file__).resolve().parent
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}


def _json(data: Any, status: int = 200) -> JSONResponse:
    return JSONResponse(data, status_code=status, headers=CORS)


def register_http_routes(server: Any, tools: dict[str, Any]) -> None:
    @server.custom_route("/health", methods=["GET"])
    async def health(_: Request) -> Response:
        return _json({"status": "ok", "service": "OASIS MCP", "tools": 16})

    @server.custom_route("/reports", methods=["GET"])
    async def reports(_: Request) -> Response:
        return HTMLResponse((BASE_DIR / "reports.html").read_text(encoding="utf-8"))

    @server.custom_route("/api/mcp/incident-history", methods=["GET", "OPTIONS"])
    async def history(request: Request) -> Response:
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=CORS)
        query = request.query_params
        result = await anyio.to_thread.run_sync(lambda: tools["get_incident_history"](
            location_id=query.get("location_id"),
            limit=int(query.get("limit", "20")),
            status_filter=query.get("status_filter"),
        ))
        return _json(result)

    @server.custom_route("/api/mcp/alert-history", methods=["GET", "OPTIONS"])
    async def alert_history(request: Request) -> Response:
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=CORS)
        query = request.query_params
        result = await anyio.to_thread.run_sync(lambda: tools["get_alert_history"](
            region=query.get("region"),
            channel=query.get("channel"),
            limit=int(query.get("limit", "50")),
        ))
        return _json(result)

    @server.custom_route("/api/mcp/create-incident-report", methods=["POST", "OPTIONS"])
    async def create_report(request: Request) -> Response:
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=CORS)
        try:
            body = await request.json()
            result = await anyio.to_thread.run_sync(lambda: tools["create_incident_report"](
                status=body.get("status") or {},
                checklist=body.get("checklist"),
                actions_taken=body.get("actions_taken"),
            ))
            return _json(result)
        except Exception as exc:
            return _json({"success": False, "message": str(exc)}, 500)

    @server.custom_route("/api/mcp/broadcast-emergency", methods=["POST", "OPTIONS"])
    async def broadcast_emergency(request: Request) -> Response:
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=CORS)
        try:
            body = await request.json()
            regions = body.get("regions") or []
            location_name = ", ".join(regions) if isinstance(regions, list) else str(regions)
            result = await anyio.to_thread.run_sync(lambda: tools["broadcast_emergency"](
                location_id=location_name or "강남구",
                message=body.get("message"),
                risk_level_override=body.get("grade"),
                location_name_override=location_name or None,
                sms_numbers=body.get("sms_numbers"),
                kakao_numbers=body.get("kakao_numbers"),
                target_roles=body.get("target_roles") or ["현장요원", "관제센터", "시민"],
            ))
            return _json(result)
        except Exception as exc:
            return _json({"success": False, "message": str(exc)}, 500)

    @server.custom_route("/api/mcp/generate-checklist", methods=["POST", "OPTIONS"])
    async def checklist(request: Request) -> Response:
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=CORS)
        body = await request.json()
        result = tools["generate_checklist"](
            risk_level=body.get("risk_level", "주의"),
            location_name=body.get("location_name", "강남역 1번 출구"),
            target_role=body.get("target_role", "현장요원"),
        )
        return _json(result)

    @server.custom_route("/api/mcp/assess-flood-risk", methods=["POST", "OPTIONS"])
    async def assess(request: Request) -> Response:
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=CORS)
        body = await request.json()
        result = tools["assess_flood_risk"](
            water_level=float(body.get("water_level", 0)),
            rainfall=float(body.get("rainfall", 0)),
            rise_rate=float(body.get("rise_rate", 0)),
            soil_saturation=float(body.get("soil_saturation", 50)),
            upstream_risk=float(body.get("upstream_risk", 0)),
        )
        return _json(result)

    @server.custom_route("/api/mcp/safe-shelters", methods=["GET", "OPTIONS"])
    async def shelters(request: Request) -> Response:
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=CORS)
        query = request.query_params
        result = await anyio.to_thread.run_sync(lambda: tools["get_safe_shelters"](
            lat=float(query.get("lat", "37.4979")),
            lng=float(query.get("lng", "127.0276")),
            radius_km=float(query.get("radius_km", "2")),
        ))
        return _json(result)
