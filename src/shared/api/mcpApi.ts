const MCP_BASE = import.meta.env.VITE_MCP_API_URL ?? 'http://127.0.0.1:8001/api/mcp';

export interface McpReport {
  report_id: string;
  markdown: string;
  summary: string;
  created_at: string;
}

export interface McpIncident {
  id: string;
  location_id: string;
  location_name: string;
  risk_level: string;
  water_level: number;
  rainfall: number;
  rise_rate: number;
  created_at: string;
}

export interface McpBroadcastResult {
  location: string;
  risk_level: string;
  report_id: string;
  incident_id: string;
  results: {
    slack: { success: boolean; message: string; status_code?: number };
    sms: { sent: number; failed: number; total: number } | null;
    kakao: { sent: number; failed: number; total: number } | null;
  };
  executed_at: string;
}

export interface McpAlertHistoryItem {
  id: number;
  incident_id: string;
  channel: string;
  message: string;
  success: boolean;
  sent_at: string;
}

async function responseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    const message = (data as { message?: string }).message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function getIncidentHistory(): Promise<McpIncident[]> {
  const response = await fetch(`${MCP_BASE}/incident-history?limit=20`);
  const data = await responseJson<{ incidents: McpIncident[] }>(response);
  return data.incidents;
}

export async function createIncidentReport(params: {
  status: Record<string, unknown>;
  checklist?: string[];
}): Promise<McpReport> {
  const response = await fetch(`${MCP_BASE}/create-incident-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, actions_taken: ['MCP 자동 보고서 생성'] }),
  });
  return responseJson<McpReport>(response);
}

export async function getAlertHistory(region?: string): Promise<McpAlertHistoryItem[]> {
  const query = new URLSearchParams({ limit: '50' });
  if (region) query.set('region', region);
  const response = await fetch(`${MCP_BASE}/alert-history?${query.toString()}`);
  const data = await responseJson<{ alerts: McpAlertHistoryItem[] }>(response);
  return data.alerts;
}

export async function broadcastEmergency(params: {
  grade: 'WATCH' | 'WARNING' | 'DANGER';
  regions: string[];
  message: string;
  sms_numbers?: string[];
  kakao_numbers?: string[];
}): Promise<McpBroadcastResult> {
  const response = await fetch(`${MCP_BASE}/broadcast-emergency`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return responseJson<McpBroadcastResult>(response);
}
