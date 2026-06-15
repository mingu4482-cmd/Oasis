export type StageKey = 'caution' | 'watch' | 'warning' | 'critical';

export interface Stage {
  key: StageKey;
  label: string;
  color: string;
  bg: string;
  borderColor: string;
  template: string;
}

export interface LogEntry {
  id: number;
  stage: StageKey;
  channel: string;
  preview: string;
  time: string;
}

export const STAGES: Stage[] = [
  {
    key: 'caution',
    label: '관심',
    color: '#1D9E75',
    bg: 'rgba(29,158,117,0.12)',
    borderColor: 'rgba(29,158,117,0.35)',
    template: `[OASIS 관심] {{맨홀ID}} 수위 상승 감지

현재 수위: {{수위}}% / 위치: {{위치}}
날씨: {{날씨}} / 강수량: {{강수량}}mm
상승 속도: +{{속도}}%/분

현장 확인을 준비해 주세요.
추가 상황 발생 시 재알림 예정입니다.

문의: OASIS 관제센터 02-000-0000`,
  },
  {
    key: 'watch',
    label: '주의',
    color: '#e09b2d',
    bg: 'rgba(224,155,45,0.12)',
    borderColor: 'rgba(224,155,45,0.35)',
    template: `[OASIS 주의] {{맨홀ID}} 침수 주의

현재 수위: {{수위}}% / 위치: {{위치}}
날씨: {{날씨}} / 강수량: {{강수량}}mm
상승 속도: +{{속도}}%/분
10분 내 위험 단계 진입 가능 (예측: {{10분후}}%)

차수막 작동 상태를 확인하고
차량 및 물품 이동을 준비해 주세요.

문의: OASIS 관제센터 02-000-0000`,
  },
  {
    key: 'warning',
    label: '위험',
    color: '#d96041',
    bg: 'rgba(217,96,65,0.12)',
    borderColor: 'rgba(217,96,65,0.35)',
    template: `[OASIS 위험] {{맨홀ID}} 임계 수위 도달

현재 수위: {{수위}}% / 위치: {{위치}}
날씨: {{날씨}} / 강수량: {{강수량}}mm
자동 차수막 전개 완료 / 현장 경보 작동 중
5분 후 예측: {{5분후}}%

■ 차량 및 물품 즉시 이동
■ 지하 출입 자제 권고
■ 인근 상가 침수 대비 조치 시작

문의: OASIS 관제센터 02-000-0000`,
  },
  {
    key: 'critical',
    label: '심각',
    color: '#d94545',
    bg: 'rgba(217,69,69,0.12)',
    borderColor: 'rgba(217,69,69,0.35)',
    template: `[OASIS 심각] {{맨홀ID}} 침수 임박 — 긴급 대응 필요

현재 수위: {{수위}}% / 위치: {{위치}}
날씨: {{날씨}} / 강수량: {{강수량}}mm
상승 속도: +{{속도}}%/분 / 10분 후: 범람 예측 ({{10분후}}%)

■■ 지하공간 즉시 출입 통제
■■ 전기설비 보호 조치 즉시 시행
■■ 차량·장비 고지대 이동 완료 확인
■■ 인접 맨홀 동시 모니터링

자동 차수막 전개 완료 / Slack 상황 보고서 발송됨
관제센터 긴급 직통: 02-000-0000`,
  },
];

export const INITIAL_LOGS: LogEntry[] = [
  { id: 1, stage: 'critical', channel: 'SMS+Slack', preview: '[심각] MH-001 침수 임박 긴급 대응 필요', time: '14:31' },
  { id: 2, stage: 'warning',  channel: 'SMS+Slack', preview: '[위험] MH-001 자동 차수막 전개 완료',   time: '14:28' },
  { id: 3, stage: 'warning',  channel: 'SMS',       preview: '[위험] MH-002 임계 수위 도달',          time: '14:25' },
  { id: 4, stage: 'watch',    channel: 'Slack',     preview: '[주의] MH-003 10분 내 침수 가능',       time: '14:20' },
  { id: 5, stage: 'caution',  channel: 'SMS',       preview: '[관심] MH-003 수위 상승 감지',          time: '14:10' },
];

export function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/{{[^}]+}}/g, (m) => String(vars[m] ?? m));
}

export function buildVars(
  manholeId: string,
  location: string,
  waterLevel: number,
  riseRate: number,
  weatherStatus: string,
  rainfall: number
): Record<string, string | number> {
  return {
    '{{맨홀ID}}': manholeId,
    '{{위치}}':   location,
    '{{수위}}':   waterLevel,
    '{{속도}}':   riseRate.toFixed(1),
    '{{날씨}}':   weatherStatus,
    '{{강수량}}': rainfall.toFixed(1),
    '{{5분후}}':  Math.min(100, Math.round(waterLevel + riseRate * 5)),
    '{{10분후}}': Math.min(100, Math.round(waterLevel + riseRate * 10)),
    '{{시간}}':   new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
  };
}
