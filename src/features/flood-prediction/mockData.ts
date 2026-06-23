import { DashboardState, MapLayer } from '../../shared/types/domain';

export const mockDashboard: DashboardState = {
  alertLevel: 'WARNING',
  selectedRegion: '강남구',
  sensorSummary: {
    total: 164,
    online: 151,
    warning: 9,
    offline: 4,
  },
  activeIncidents: [
    {
      id: 'INC-2406-018',
      district: '강남구 대치동',
      severity: 'DANGER',
      summary: '저지대 빗물받이 수위 급상승',
      reportedAt: '11:02',
    },
    {
      id: 'INC-2406-017',
      district: '서초구 반포동',
      severity: 'WARNING',
      summary: '교차로 배수 지연 감지',
      reportedAt: '10:54',
    },
    {
      id: 'INC-2406-016',
      district: '마포구 합정동',
      severity: 'WATCH',
      summary: '시간당 강수량 증가 추세',
      reportedAt: '10:41',
    },
  ],
};

export const mapLayers: MapLayer[] = [
  {
    id: 'flood-heatmap',
    name: '침수 위험 히트맵',
    source: 'AI 예측 API',
    refresh: '5분',
    enabled: true,
  },
  {
    id: 'drainage',
    name: '맨홀/배수구 상태',
    source: '공공데이터 API',
    refresh: '10분',
    enabled: true,
  },
  {
    id: 'rain-radar',
    name: '강수량 레이더',
    source: '기상청 API',
    refresh: '10분',
    enabled: true,
  },
  {
    id: 'shelter',
    name: '안전 대피소',
    source: '행안부 공공데이터',
    refresh: '1일',
    enabled: false,
  },
  {
    id: 'cctv',
    name: 'CCTV 영상 링크',
    source: '교통 공공 API',
    refresh: '수동',
    enabled: false,
  },
  {
    id: 'safe-route',
    name: '안전 경로',
    source: '카카오 길찾기 API',
    refresh: '요청 시',
    enabled: true,
  },
];
