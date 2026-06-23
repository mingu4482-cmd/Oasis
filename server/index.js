import express from 'express';
import axios from 'axios';
import { Pool } from 'pg';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = Number(process.env.API_PORT ?? 4000);
const aiServerUrl = process.env.AI_SERVER_URL ?? 'http://localhost:8000';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(express.json());

let latestLiveStatus = null;
let latestRiskForecast = null;
let latestRegionalStatus = null;

function getDefaultRegion() {
  return latestRegionalStatus?.defaultRegion ?? latestRegionalStatus?.regions?.[0] ?? null;
}

function getRegionalStatus(region) {
  if (!latestRegionalStatus?.regionStatusMap) {
    return null;
  }

  const defaultRegion = getDefaultRegion();
  const selectedRegion = region || defaultRegion;
  return latestRegionalStatus.regionStatusMap[selectedRegion] ?? latestRegionalStatus.regionStatusMap[defaultRegion] ?? null;
}

function toLiveStatus(payload) {
  return {
    hasData: true,
    targetAreaName: payload.targetAreaName,
    rainfall: payload.rainfall,
    waterLevel: payload.waterLevel,
    drainageLevel: payload.drainageLevel,
    waterLevelRiseRate: payload.waterLevelRiseRate,
    forecastRainfall1h: payload.forecastRainfall1h,
    forecastRainfall2h: payload.forecastRainfall2h,
    forecastRainfall3h: payload.forecastRainfall3h,
    riskScore: payload.riskScore,
    riskLabel: payload.riskLabel,
    confidence: payload.confidence,
    source: payload.source ?? payload.dataSource ?? 'realtime api',
    timestamp: payload.timestamp ?? new Date().toISOString(),
    rainfallStation: payload.rainfallStation,
    rainfallObservedAt: payload.rainfallObservedAt,
    drainpipeStation: payload.drainpipeStation,
    drainpipeMeasuredAt: payload.drainpipeMeasuredAt,
    drainpipePosition: payload.drainpipePosition,
    rawWaterLevel: payload.rawWaterLevel,
    forecastGrid: payload.forecastGrid,
    fallbackReason: payload.fallbackReason,
    warnings: payload.warnings ?? [],
  };
}

function toRiskForecast(payload) {
  return {
    hasData: true,
    region: payload.targetAreaName,
    riskScore: payload.riskScore,
    riskLabel: payload.riskLabel,
    modelVersion: payload.modelVersion ?? 'OASIS-FloodNet v1.0',
    confidence: payload.confidence ?? 0,
    points: payload.points ?? [],
    source: payload.source ?? payload.dataSource ?? 'realtime api',
    timestamp: payload.timestamp ?? new Date().toISOString(),
    targetAreaName: payload.targetAreaName,
  };
}

function fallbackGeneratedAlert(payload) {
  const rules = {
    SAFE: {
      alertLevel: '정상',
      targetGroup: [],
      title: `${payload.region} 침수 위험 정상`,
      message: '현재 침수 위험은 낮은 상태입니다.',
      actions: ['지속 모니터링'],
    },
    CAUTION: {
      alertLevel: '관심',
      targetGroup: ['관제 담당자'],
      title: `${payload.region} 침수 위험 관심 단계`,
      message: '침수 위험이 다소 증가했습니다. 지속적인 모니터링이 필요합니다.',
      actions: ['강우량 및 하수관로 수위 변화 확인', '취약 지역 모니터링 유지'],
    },
    WARNING: {
      alertLevel: '주의',
      targetGroup: ['운영자', '유지보수팀'],
      title: `${payload.region} 침수 위험 주의 경보`,
      message: '침수 위험이 높아지고 있습니다. 배수 시설 점검과 현장 확인이 필요합니다.',
      actions: ['배수 시설 점검', '현장 순찰 강화', '저지대 도로 상황 확인'],
    },
    DANGER: {
      alertLevel: '긴급',
      targetGroup: ['관리자', '상황실', '지자체 담당자'],
      title: `${payload.region} 침수 위험 긴급 경보`,
      message: '침수 위험이 매우 높습니다. 즉시 대응이 필요합니다.',
      actions: ['긴급 대응 체계 가동', '도로 통제 검토', '주민 안내 준비', '배수 펌프 가동 상태 확인'],
    },
  };
  const rule = rules[payload.riskLabel] ?? rules.CAUTION;
  return {
    ...rule,
    createdAt: new Date().toISOString(),
    source: 'fallback',
  };
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) {
    return false;
  }

  const candidate = Buffer.from(scryptSync(password, salt, 64).toString('hex'), 'hex');
  const saved = Buffer.from(hash, 'hex');
  return saved.length === candidate.length && timingSafeEqual(saved, candidate);
}

function serializeUser(row) {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    phone: row.phone ?? '',
    organization: row.organization ?? '',
    department: row.department ?? '',
    address: row.address ?? '',
    emergencyContact: row.emergency_contact ?? '',
    memo: row.memo ?? '',
  };
}

async function ensureUsersTable() {
  await pool.query('create extension if not exists pgcrypto');
  await pool.query(`
    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      role text not null check (role in ('ADMIN', 'USER')),
      name text not null,
      email text not null unique,
      phone text not null,
      password_hash text not null,
      organization text,
      department text,
      address text,
      emergency_contact text,
      memo text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  const columns = [
    ['role', "text not null default 'USER'"],
    ['name', 'text'],
    ['email', 'text'],
    ['phone', 'text'],
    ['password_hash', 'text'],
    ['organization', 'text'],
    ['department', 'text'],
    ['address', 'text'],
    ['emergency_contact', 'text'],
    ['memo', 'text'],
    ['created_at', 'timestamptz not null default now()'],
    ['updated_at', 'timestamptz not null default now()'],
  ];

  for (const [name, definition] of columns) {
    await pool.query(`alter table users add column if not exists ${name} ${definition}`);
  }

  await pool.query('create unique index if not exists users_email_unique on users (email)');
}

function validateSignup(body) {
  const required = ['role', 'name', 'email', 'phone', 'password'];
  const missing = required.filter((field) => !String(body[field] ?? '').trim());

  if (missing.length > 0) {
    return `${missing.join(', ')} 항목은 필수입니다.`;
  }

  if (!['ADMIN', 'USER'].includes(body.role)) {
    return '회원 유형이 올바르지 않습니다.';
  }

  return null;
}

app.get('/api/health', async (_request, response) => {
  await pool.query('select 1');
  response.json({ ok: true });
});

app.post('/api/auth/signup', async (request, response) => {
  const error = validateSignup(request.body);
  if (error) {
    response.status(400).json({ message: error });
    return;
  }

  const {
    role,
    name,
    email,
    phone,
    password,
    organization = '',
    department = '',
    address = '',
    emergencyContact = '',
    memo = '',
  } = request.body;

  try {
    await ensureUsersTable();
    const result = await pool.query(
      `
        insert into users (
          role, name, email, phone, password_hash,
          organization, department, address, emergency_contact, memo
        )
        values ($1, $2, lower($3), $4, $5, $6, $7, $8, $9, $10)
        returning id, role, name, email, phone, organization, department, address, emergency_contact, memo
      `,
      [
        role,
        name.trim(),
        email.trim(),
        phone.trim(),
        hashPassword(password),
        organization.trim(),
        department.trim(),
        address.trim(),
        emergencyContact.trim(),
        memo.trim(),
      ],
    );

    response.status(201).json({ user: serializeUser(result.rows[0]) });
  } catch (signupError) {
    if (signupError.code === '23505') {
      response.status(409).json({ message: '이미 가입된 이메일입니다.' });
      return;
    }

    console.error(signupError);
    response.status(500).json({ message: '회원가입 처리 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/login', async (request, response) => {
  const { email, password } = request.body;

  if (!email || !password) {
    response.status(400).json({ message: '이메일과 비밀번호를 입력하세요.' });
    return;
  }

  try {
    await ensureUsersTable();
    const result = await pool.query(
      `
        select id, role, name, email, phone, password_hash,
               organization, department, address, emergency_contact, memo
        from users
        where email = lower($1)
        limit 1
      `,
      [email.trim()],
    );

    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      response.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    response.json({ user: serializeUser(user) });
  } catch (loginError) {
    console.error(loginError);
    response.status(500).json({ message: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/logout', (_request, response) => {
  response.json({ ok: true });
});

app.post('/api/predict-risk', async (request, response) => {
  try {
    const aiResponse = await axios.post(`${aiServerUrl}/predict`, request.body, {
      timeout: 5000,
    });

    response.json(aiResponse.data);
  } catch (predictError) {
    console.error('Failed to request AI risk prediction');

    if (predictError.response) {
      console.error(predictError.response.data);
    } else {
      console.error(predictError.message);
    }

    response.status(500).json({
      message: 'Failed to communicate with the AI risk prediction server.',
    });
  }
});

app.post('/api/generate-alert', async (request, response) => {
  try {
    const aiResponse = await axios.post(`${aiServerUrl}/generate-alert`, request.body, {
      timeout: 10000,
    });

    response.json(aiResponse.data);
  } catch (alertError) {
    console.error('Failed to request AI alert generation');

    if (alertError.response) {
      console.error(alertError.response.data);
    } else {
      console.error(alertError.message);
    }

    response.json(fallbackGeneratedAlert(request.body));
  }
});

app.post('/api/update-live-status', (request, response) => {
  try {
    const payload = request.body;

    if (payload.mode === 'regional' && payload.regionStatusMap) {
      latestRegionalStatus = {
        hasData: true,
        mode: 'regional',
        defaultRegion: payload.defaultRegion,
        regions: payload.regions ?? Object.keys(payload.regionStatusMap),
        regionStatusMap: payload.regionStatusMap,
        timestamp: payload.timestamp ?? new Date().toISOString(),
      };

      const defaultStatus = getRegionalStatus(payload.defaultRegion);
      if (defaultStatus) {
        latestLiveStatus = toLiveStatus(defaultStatus);
        latestRiskForecast = toRiskForecast(defaultStatus);
      }

      console.log('Regional live status updated from AI scheduler:', {
        defaultRegion: latestRegionalStatus.defaultRegion,
        regions: latestRegionalStatus.regions,
      });
      response.json({ ok: true, mode: 'regional' });
      return;
    }

    latestLiveStatus = toLiveStatus(payload);
    latestRiskForecast = toRiskForecast(payload);
    console.log('Live status updated from AI scheduler:', {
      targetAreaName: latestLiveStatus.targetAreaName,
      source: latestLiveStatus.source,
      timestamp: latestLiveStatus.timestamp,
    });
    response.json({ ok: true });
  } catch (error) {
    console.error('Failed to update live status');
    console.error(error);
    response.status(500).json({ message: 'Failed to update live status' });
  }
});

app.get('/api/regions', (_request, response) => {
  if (latestRegionalStatus) {
    response.json({
      hasData: true,
      defaultRegion: latestRegionalStatus.defaultRegion,
      regions: latestRegionalStatus.regions,
      timestamp: latestRegionalStatus.timestamp,
    });
    return;
  }

  response.json({
    hasData: false,
    defaultRegion: '강남구',
    regions: ['강남구', '서초구', '관악구', '동작구', '영등포구', '구로구', '양천구', '마포구', '성동구', '광진구'],
    timestamp: null,
  });
});

app.get('/api/regional-status', (_request, response) => {
  if (latestRegionalStatus?.regionStatusMap) {
    response.json(latestRegionalStatus);
    return;
  }

  response.json({
    hasData: false,
    mode: 'regional',
    defaultRegion: '강남구',
    regions: [],
    regionStatusMap: {},
    timestamp: null,
  });
});

app.get('/api/live-status', (request, response, next) => {
  const region = request.query.region?.toString();
  const regionalStatus = getRegionalStatus(region);

  if (regionalStatus) {
    response.json(toLiveStatus(regionalStatus));
    return;
  }

  if (!region) {
    next();
    return;
  }

  response.json({
    hasData: false,
    message: '아직 수집된 실시간 데이터가 없습니다.',
    source: 'realtime api waiting',
    timestamp: null,
  });
});

app.get('/api/risk-forecast', (request, response, next) => {
  const region = request.query.region?.toString();
  const regionalStatus = getRegionalStatus(region);

  if (regionalStatus) {
    response.json(toRiskForecast(regionalStatus));
    return;
  }

  if (!region) {
    next();
    return;
  }

  response.json({
    hasData: false,
    message: 'No risk forecast data available',
    source: 'realtime api waiting',
    timestamp: null,
    points: [],
  });
});

app.get('/api/live-status', (_request, response) => {
  if (latestLiveStatus) {
    response.json(latestLiveStatus);
  } else {
    response.json({
      hasData: false,
      message: '아직 수집된 실시간 데이터가 없습니다.',
      source: 'realtime api waiting',
      timestamp: null,
    });
  }
});

app.get('/api/risk-forecast', (_request, response) => {
  if (latestRiskForecast) {
    response.json(latestRiskForecast);
  } else {
    response.json({
      hasData: false,
      message: 'No risk forecast data available',
      source: 'realtime api waiting',
      timestamp: null,
      points: [],
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 안전 경로 — 카카오 길찾기 (자동차 / 도보)
// ─────────────────────────────────────────────────────────────────────────

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const TMAP_APP_KEY = process.env.TMAP_APP_KEY;

function validateRouteQuery(query) {
  const { originLat, originLng, destLat, destLng } = query;
  if (!originLat || !originLng || !destLat || !destLng) {
    return '출발지(originLat, originLng)와 목적지(destLat, destLng) 좌표가 필요합니다.';
  }
  return null;
}

// 자동차 길찾기 — 카카오모빌리티 Directions API
app.get('/api/route/car', async (request, response) => {
  const error = validateRouteQuery(request.query);
  if (error) {
    response.status(400).json({ message: error });
    return;
  }

  if (!KAKAO_REST_API_KEY) {
    response.status(500).json({ message: 'KAKAO_REST_API_KEY가 서버에 설정되지 않았습니다.' });
    return;
  }

  const { originLat, originLng, destLat, destLng } = request.query;

  try {
    const url = new URL('https://apis-navi.kakaomobility.com/v1/directions');
    url.searchParams.set('origin', `${originLng},${originLat}`);
    url.searchParams.set('destination', `${destLng},${destLat}`);
    url.searchParams.set('priority', 'RECOMMEND');

    const kakaoResponse = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
    });

    const data = await kakaoResponse.json();

    if (!kakaoResponse.ok) {
      console.error('[kakao directions]', data);
      response.status(kakaoResponse.status).json({ message: '자동차 경로 조회에 실패했습니다.', detail: data });
      return;
    }

    const route = data.routes?.[0];
    if (!route || route.result_code !== 0) {
      response.status(404).json({ message: '경로를 찾을 수 없습니다.' });
      return;
    }

    // 모든 section의 모든 road를 이어붙여 좌표 배열로 변환
    const path = [];
    for (const section of route.sections ?? []) {
      for (const road of section.roads ?? []) {
        const vertexes = road.vertexes ?? [];
        for (let i = 0; i < vertexes.length; i += 2) {
          path.push({ lng: vertexes[i], lat: vertexes[i + 1] });
        }
      }
    }

    const steps = [];
    for (const section of route.sections ?? []) {
      for (const guide of section.guides ?? []) {
        if (!guide.guidance) continue;
        steps.push({
          guidance: guide.guidance,
          name: guide.name ?? '',
          distanceM: guide.distance ?? 0,
          type: guide.type ?? 0,
          lat: guide.y,
          lng: guide.x,
        });
      }
    }

    response.json({
      mode: 'CAR',
      distanceM: route.summary.distance,
      durationSec: route.summary.duration,
      path,
      steps,
    });
  } catch (fetchError) {
    console.error(fetchError);
    response.status(500).json({ message: '자동차 경로 조회 중 오류가 발생했습니다.' });
  }
});

// 도보 길찾기 — T맵 보행자 → 실패 시 OSRM fallback
app.get('/api/route/walk', async (request, response) => {
  const error = validateRouteQuery(request.query);
  if (error) {
    response.status(400).json({ message: error });
    return;
  }

  const { originLat, originLng, destLat, destLng } = request.query;
  const oLat = Number(originLat), oLng = Number(originLng);
  const dLat = Number(destLat),   dLng = Number(destLng);

  // T맵 키가 있으면 먼저 시도
  if (TMAP_APP_KEY) {
    try {
      const tmapRes = await fetch(
        `https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&appKey=${encodeURIComponent(TMAP_APP_KEY)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', appKey: TMAP_APP_KEY },
          body: JSON.stringify({
            startX: String(oLng), startY: String(oLat),
            endX: String(dLng),   endY: String(dLat),
            reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO',
            startName: '출발지', endName: '도착지',
          }),
        },
      );

      if (tmapRes.ok) {
        const data = await tmapRes.json();
        const path = [], steps = [];
        let totalDistanceM = 0, totalDurationSec = 0;

        for (const feature of data.features ?? []) {
          const { geometry, properties } = feature;
          if (properties.totalDistance !== undefined) {
            totalDistanceM = properties.totalDistance;
            totalDurationSec = properties.totalTime;
          }
          if (geometry.type === 'LineString') {
            for (const coord of geometry.coordinates) path.push({ lng: coord[0], lat: coord[1] });
          }
          if (geometry.type === 'Point' && properties.description) {
            steps.push({
              guidance: properties.description,
              name: properties.streetName ?? '',
              distanceM: properties.distance ?? 0,
              type: properties.turnType ?? 0,
              lat: geometry.coordinates[1],
              lng: geometry.coordinates[0],
            });
          }
        }
        response.json({ mode: 'WALK', distanceM: Math.round(totalDistanceM), durationSec: totalDurationSec, path, steps });
        return;
      }

      console.warn('[tmap walk] 실패, OSRM으로 전환:', tmapRes.status);
    } catch (tmapError) {
      console.warn('[tmap walk] 오류, OSRM으로 전환:', tmapError.message);
    }
  }

  // OSRM fallback
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson&steps=true`;
    const osrmRes = await fetch(osrmUrl);
    const osrmData = await osrmRes.json();

    if (osrmData.code !== 'Ok' || !osrmData.routes?.length) {
      response.status(404).json({ message: '도보 경로를 찾을 수 없습니다.' });
      return;
    }

    const route = osrmData.routes[0];
    const path = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    const steps = [];

    for (const leg of route.legs ?? []) {
      for (const step of leg.steps ?? []) {
        const { maneuver, name, distance } = step;
        const mod = maneuver.modifier ?? '';
        let type = 11, guidance = name || '직진';
        if (maneuver.type === 'depart')       { type = 200; guidance = '출발지'; }
        else if (maneuver.type === 'arrive')  { type = 201; guidance = '목적지 도착'; }
        else if (mod.includes('left'))        { type = 12;  guidance = `좌회전${name ? ` — ${name}` : ''}`; }
        else if (mod.includes('right'))       { type = 13;  guidance = `우회전${name ? ` — ${name}` : ''}`; }
        else if (mod.includes('uturn'))       { type = 17;  guidance = 'U턴'; }
        else if (name)                        { guidance = name; }
        steps.push({ guidance, name: name ?? '', distanceM: Math.round(distance), type, lat: maneuver.location[1], lng: maneuver.location[0] });
      }
    }

    const distanceM = Math.round(route.distance);
    const durationSec = Math.round(distanceM / (4000 / 3600)); // 4km/h 기준
    response.json({ mode: 'WALK', distanceM, durationSec, path, steps });
  } catch (osrmError) {
    console.error('[osrm walk]', osrmError);
    response.status(500).json({ message: '도보 경로 조회 중 오류가 발생했습니다.' });
  }
});

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// DB 연결 실패해도 서버는 켜지도록 분리
// (길찾기 등 DB 무관 라우트는 항상 동작해야 함)
app.listen(port, () => {
  console.log(`OASIS API listening on http://127.0.0.1:${port}`);
});

ensureUsersTable().catch((error) => {
  console.error('⚠️  DB 연결 실패 — 로그인/회원가입 기능은 동작하지 않습니다.');
  console.error(error.message);
});
