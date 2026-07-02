import { useState } from 'react';
import { Download, FileCheck2, Loader2, X } from 'lucide-react';
import {
  createIncidentReport,
  McpReport,
} from '../../shared/api/mcpApi';
import { fetchLiveStatus } from '../../shared/api/aiApi';
import { useDashboardStore } from '../../shared/store/dashboardStore';

const reports = ['침수 위험 예측 요약', '현장 대응 체크리스트', '센서 이상 탐지 로그', '시민 알림 발송 이력'];
const seoulDistricts = [
  '강남구', '서초구', '관악구', '동작구', '영등포구',
  '구로구', '양천구', '마포구', '성동구', '광진구',
];

export function ReportsPage() {
  const selectedDistrict = useDashboardStore((state) => state.selectedRegion);
  const setSelectedDistrict = useDashboardStore((state) => state.setSelectedRegion);
  const simulationSensorLogs = useDashboardStore((state) => state.simulationSensorLogs);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [report, setReport] = useState<McpReport | null>(null);
  const [error, setError] = useState('');

  const generate = async (index: number) => {
    if (index > 2 || loadingIndex !== null) return;
    setLoadingIndex(index);
    setError('');
    try {
      const districtLogs = simulationSensorLogs.filter((log) => log.region === selectedDistrict);
      let status: Record<string, unknown>;
      if (index === 2) {
        if (districtLogs.length === 0) throw new Error(`${selectedDistrict} 시뮬레이션 이상 로그가 없습니다.`);
        const latest = districtLogs[0];
        status = {
          location_id: selectedDistrict,
          location_name: selectedDistrict,
          risk_level: '센서 이상',
          water_level: Math.max(...districtLogs.map((log) => log.waterLevel)),
          rainfall: latest.rainfall,
          rise_rate: '-',
          recent_change: `${districtLogs.length}건의 수위 90% 이상 센서 감지`,
          data_source: '침수 시뮬레이션',
          updated_at: latest.detectedAt,
        };
      } else {
        const live = await fetchLiveStatus(selectedDistrict);
        status = {
          location_id: selectedDistrict,
          location_name: live.targetAreaName ?? selectedDistrict,
          risk_level: live.hasData ? (live.riskLabel ?? '확인 필요') : '데이터 없음',
          risk_score: live.riskScore ?? 0,
          water_level: live.waterLevel ?? '-',
          rainfall: live.rainfall ?? '-',
          rise_rate: live.waterLevelRiseRate ?? '-',
          forecast_rainfall_1h: live.forecastRainfall1h ?? '-',
          recent_change: live.dataStatusMessage ?? live.message ?? '-',
          data_source: live.source ?? '-',
          updated_at: live.timestamp ?? new Date().toISOString(),
        };
      }
      setReport(await createIncidentReport({
        status,
        checklist: index === 2
          ? districtLogs.map((log) => `□ ${log.sensorName}: 수위 ${log.waterLevel}% / 강우 ${log.rainfall}mm/h / ${new Date(log.detectedAt).toLocaleString('ko-KR')}`)
          : index === 1
          ? ['□ 배수펌프 가동', '□ 도로 통제', '□ 현장 순찰', '□ 유관기관 연락']
          : undefined,
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '보고서 생성 실패');
    } finally {
      setLoadingIndex(null);
    }
  };

  const download = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${report.report_id}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-layout">
      <section className="panel report-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">보고서</span>
            <h2>자동 생성 대기열</h2>
          </div>
          <button className="primary-icon-button" type="button" aria-label="보고서 다운로드" onClick={download} disabled={!report}>
            <Download size={16} aria-hidden="true" />
          </button>
        </div>
        <select value={selectedDistrict} onChange={(event) => setSelectedDistrict(event.target.value)} style={{ width: '100%', marginBottom: 14, padding: '8px 12px', borderRadius: 8 }} aria-label="서울 자치구 선택">
          {seoulDistricts.map((district) => <option key={district} value={district}>{district}</option>)}
        </select>
        {error && <div style={{ marginBottom: 12, padding: 10, color: '#991b1b', background: '#fef2f2', borderRadius: 8 }}>{error}</div>}
        <div className="report-grid">
          {reports.map((report, index) => (
            <article key={report} className="report-item" role={index < 3 ? 'button' : undefined} tabIndex={index < 3 ? 0 : undefined}
              onClick={() => generate(index)} onKeyDown={(event) => event.key === 'Enter' && generate(index)}
              style={{ cursor: index < 3 ? 'pointer' : 'not-allowed', opacity: index < 3 ? 1 : 0.6 }}>
              {loadingIndex === index ? <Loader2 className="spin-icon" size={20} /> : <FileCheck2 size={20} aria-hidden="true" />}
              <strong>{report}</strong>
              <span>{loadingIndex === index ? '생성 중...' : index === 2 ? `${simulationSensorLogs.filter((log) => log.region === selectedDistrict).length}건 수집됨 · 클릭` : index < 2 ? '생성 가능 · 클릭' : '데이터 수집 중'}</span>
            </article>
          ))}
        </div>
      </section>
      {report && (
        <div onClick={() => setReport(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#0008', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <section onClick={(event) => event.stopPropagation()} style={{ width: 'min(820px, 100%)', maxHeight: '88vh', overflow: 'auto', background: '#fff', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><strong>{report.report_id}</strong><button onClick={download} style={{ marginLeft: 'auto' }}>다운로드</button><button onClick={() => setReport(null)} aria-label="닫기"><X size={16} /></button></div>
            <p style={{ padding: 12, background: '#eef8f5', whiteSpace: 'pre-wrap' }}>{report.summary}</p>
            <pre style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 12 }}>{report.markdown}</pre>
          </section>
        </div>
      )}
    </div>
  );
}
