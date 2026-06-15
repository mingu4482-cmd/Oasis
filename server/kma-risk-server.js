const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

loadLocalEnv();

const PORT = Number(process.env.PORT || 4000);
const KMA_APIHUB_URL = 'https://apihub.kma.go.kr/api/typ01/url/kma_sfctm2.php';

const STATIONS = [
  { id: 108, name: '서울', latitude: 37.5714, longitude: 126.9658 },
  { id: 112, name: '인천', latitude: 37.4777, longitude: 126.6249 },
  { id: 119, name: '수원', latitude: 37.2575, longitude: 126.9830 },
  { id: 202, name: '양평', latitude: 37.4886, longitude: 127.4945 },
  { id: 203, name: '이천', latitude: 37.2639, longitude: 127.4842 },
];

function loadLocalEnv() {
  ['.env.local', '.env'].forEach((fileName) => {
    const filePath = path.resolve(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  });
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(payload));
}

function latestObservationTime(now = new Date()) {
  const target = new Date(now);
  if (target.getMinutes() < 20) {
    target.setHours(target.getHours() - 1);
  }
  target.setMinutes(0, 0, 0);

  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  const hh = String(target.getHours()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}00`;
}

function distanceKm(a, b) {
  const toRad = (deg) => deg * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function nearestStation(latitude, longitude) {
  const current = { latitude, longitude };
  return STATIONS
    .map((station) => ({ ...station, distanceKm: distanceKm(current, station) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
}

function getKmaText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`KMA API HTTP ${response.statusCode}: ${body}`));
          return;
        }
        resolve(body);
      });
    }).on('error', reject);
  });
}

function parseSurfaceObservation(rawText) {
  let header = [];
  const rows = [];

  rawText.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('#')) {
      const columns = trimmed.replace(/^#+/, '').trim().split(/\s+/);
      if (columns[0] === 'YYMMDDHHMI') {
        header = columns;
      }
      return;
    }

    rows.push(trimmed.split(/\s+/));
  });

  if (!rows.length) {
    throw new Error(`기상청 관측 데이터 행을 찾지 못했습니다. 응답: ${rawText.slice(0, 300)}`);
  }

  const row = rows[0];
  const value = (column) => {
    const index = header.indexOf(column);
    if (index === -1 || index >= row.length) return null;
    const raw = row[index];
    if (raw === '-9' || raw === '-9.0' || raw === '-99' || raw === '-99.0') return null;
    return raw;
  };

  const numberValue = (column) => {
    const raw = value(column);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    observedAt: value('YYMMDDHHMI'),
    rainfall: numberValue('RN') ?? 0,
    temperature: numberValue('TA'),
    humidity: numberValue('HM'),
  };
}

function calculateRisk({ rainfall, waterLevel, riseRate }) {
  const predicted10Min = waterLevel + riseRate * 10;

  if (rainfall >= 50 || waterLevel >= 95 || predicted10Min >= 100) {
    return { riskLevel: 'critical', reason: '강수량 50mm 이상 또는 10분 내 수위 100% 도달 가능성이 있습니다.' };
  }
  if (rainfall >= 30 || waterLevel >= 85 || predicted10Min >= 95) {
    return { riskLevel: 'warning', reason: '강수량 30mm 이상 또는 수위가 위험 구간에 접근했습니다.' };
  }
  if (rainfall >= 15 || waterLevel >= 70 || predicted10Min >= 85) {
    return { riskLevel: 'watch', reason: '강수량 15mm 이상 또는 수위 상승 추세가 뚜렷합니다.' };
  }
  return { riskLevel: 'caution', reason: '현재는 낮은 단계지만 관측값을 계속 확인해야 합니다.' };
}

async function handleWeatherRisk(req, res, requestUrl) {
  const authKey = process.env.KMA_APIHUB_AUTH_KEY;
  if (!authKey) {
    json(res, 500, {
      message: '서버 환경변수 KMA_APIHUB_AUTH_KEY가 없습니다. API Hub authKey를 설정한 뒤 서버를 다시 실행하세요.',
    });
    return;
  }

  const latitude = Number(requestUrl.searchParams.get('lat'));
  const longitude = Number(requestUrl.searchParams.get('lng'));
  const waterLevel = Number(requestUrl.searchParams.get('waterLevel') || 0);
  const riseRate = Number(requestUrl.searchParams.get('riseRate') || 0);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    json(res, 400, { message: 'lat, lng 좌표가 필요합니다.' });
    return;
  }

  const station = nearestStation(latitude, longitude);
  const tm = requestUrl.searchParams.get('tm') || latestObservationTime();
  const kmaUrl = new URL(KMA_APIHUB_URL);
  kmaUrl.searchParams.set('tm', tm);
  kmaUrl.searchParams.set('stn', String(station.id));
  kmaUrl.searchParams.set('help', '0');
  kmaUrl.searchParams.set('authKey', authKey);

  try {
    const rawText = await getKmaText(kmaUrl);
    const observed = parseSurfaceObservation(rawText);
    const risk = calculateRisk({
      rainfall: observed.rainfall,
      waterLevel: Number.isFinite(waterLevel) ? waterLevel : 0,
      riseRate: Number.isFinite(riseRate) ? riseRate : 0,
    });

    json(res, 200, {
      latitude,
      longitude,
      stationId: station.id,
      stationName: station.name,
      observedAt: observed.observedAt,
      rainfall: observed.rainfall,
      temperature: observed.temperature,
      humidity: observed.humidity,
      ...risk,
    });
  } catch (error) {
    json(res, 502, {
      message: error instanceof Error ? error.message : '기상청 API 호출 중 오류가 발생했습니다.',
    });
  }
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/api/weather/risk') {
    handleWeatherRisk(req, res, requestUrl);
    return;
  }

  json(res, 404, { message: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`KMA risk server listening on http://localhost:${PORT}`);
});
