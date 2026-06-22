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

// 실시간 라이브 데이터 저장 (파이썬 스케줄러에서 업데이트됨)
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

// 파이썬 스케줄러에서 실시간 데이터 업데이트
app.post('/api/simulate-risk', async (request, response) => {
  try {
    const aiResponse = await axios.post(`${aiServerUrl}/simulate`, request.body, {
      timeout: 7000,
    });

    response.json(aiResponse.data);
  } catch (simulateError) {
    console.error('Failed to request AI risk simulation');

    if (simulateError.response) {
      console.error(simulateError.response.data);
      response.status(simulateError.response.status).json({
        message: 'AI simulation request failed.',
        detail: simulateError.response.data,
      });
      return;
    }

    console.error(simulateError.message);
    response.status(502).json({
      message: 'Failed to communicate with the AI simulation server.',
    });
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
    console.log('Live status updated from AI scheduler:', latestLiveStatus);
    response.json({ ok: true });
  } catch (error) {
    console.error('Failed to update live status');
    console.error(error);
    response.status(500).json({ message: 'Failed to update live status' });
  }
});

// 프론트엔드에서 최신 실시간 데이터 조회
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

app.get('/api/live-status', (request, response) => {
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

app.get('/api/risk-forecast', (request, response) => {
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

app.listen(port, () => {
  console.log(`OASIS API listening on http://127.0.0.1:${port}`);
});

ensureUsersTable().catch((error) => {
  console.error('Failed to initialize database connection');
  console.error(error);
  console.error('OASIS API will keep running, but auth/database features may fail until DATABASE_URL is fixed.');
});
