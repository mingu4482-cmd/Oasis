import express from 'express';
import { Pool } from 'pg';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = Number(process.env.API_PORT ?? 4000);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(express.json());

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

ensureUsersTable()
  .then(() => {
    app.listen(port, () => {
      console.log(`OASIS API listening on http://127.0.0.1:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database connection');
    console.error(error);
    process.exit(1);
  });
