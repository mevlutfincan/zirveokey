const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { rateLimit } = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
const databaseUrl = process.env.DATABASE_URL;
const sessionSecret = process.env.SESSION_SECRET;
const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
}) : null;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(24) NOT NULL,
  username_normalized VARCHAR(24) NOT NULL UNIQUE,
  email VARCHAR(254) NOT NULL,
  email_normalized VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS password_reset_expiry_idx ON password_reset_tokens(expires_at);
CREATE TABLE IF NOT EXISTS user_activity (user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), active_seconds BIGINT NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS user_activity_recent_idx ON user_activity(last_seen_at DESC, active_seconds DESC);
`;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Çok fazla deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.' }
});
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 4,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Çok fazla istek yapıldı. Daha sonra tekrar deneyin.' }
});
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const dbRequired = (_req, res, next) => {
  if (!pool || !sessionSecret) return res.status(503).json({ error: 'Hesap sistemi sunucu yapılandırması bekliyor.' });
  next();
};

if (pool && sessionSecret) {
  app.use(session({
    store: new PgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true, pruneSessionInterval: 900 }),
    name: 'zirve.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' }
  }));
}

app.get('/health', asyncRoute(async (_req, res) => {
  let database = 'not_configured';
  if (pool) {
    try { await pool.query('SELECT 1'); database = 'connected'; }
    catch { database = 'unavailable'; }
  }
  res.status(database === 'unavailable' ? 503 : 200).json({
    status: database === 'unavailable' ? 'degraded' : 'ok',
    service: 'zirveokey',
    database,
    authConfigured: Boolean(pool && sessionSecret)
  });
}));

app.get('/api/auth/me', dbRequired, (req, res) => {
  if (!req.session.user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: req.session.user });
});

app.post('/api/auth/register', dbRequired, authLimiter, asyncRoute(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!/^[\p{L}\p{N}_]{3,24}$/u.test(username)) return res.status(400).json({ error: 'Kullanıcı adı 3-24 karakter olmalı; harf, rakam ve alt çizgi kullanılabilir.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
  if (password.length < 10 || password.length > 72) return res.status(400).json({ error: 'Şifre 10-72 karakter arasında olmalı.' });
  const hash = await bcrypt.hash(password, 12);
  try {
    const result = await pool.query(
      'INSERT INTO users (username, username_normalized, email, email_normalized, password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, email',
      [username, username.toLocaleLowerCase('tr-TR'), email, email, hash]
    );
    const user = result.rows[0];
    req.session.user = { id: user.id, username: user.username, email: user.email };
    req.session.cookie.maxAge = req.body.rememberMe === true ? 30 * 24 * 60 * 60 * 1000 : null;
    req.session.save(err => {
      if (err) return res.status(500).json({ error: 'Oturum oluşturulamadı.' });
      res.status(201).json({ ok: true, user: req.session.user });
    });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Bu kullanıcı adı veya e-posta zaten kayıtlı.' });
    throw error;
  }
}));

app.post('/api/auth/login', dbRequired, authLimiter, asyncRoute(async (req, res) => {
  const identifier = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!identifier || !password || password.length > 72) return res.status(400).json({ error: 'Kullanıcı adı/e-posta ve şifre gerekli.' });
  const normalized = identifier.includes('@') ? identifier.toLowerCase() : identifier.toLocaleLowerCase('tr-TR');
  const result = await pool.query(
    'SELECT id, username, email, password_hash FROM users WHERE (username_normalized=$1 OR email_normalized=$1) AND is_active=TRUE LIMIT 1',
    [normalized]
  );
  const user = result.rows[0];
  const valid = user ? await bcrypt.compare(password, user.password_hash) : await bcrypt.compare(password, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
  if (!user || !valid) return res.status(401).json({ error: 'Giriş bilgileri hatalı.' });
  await pool.query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [user.id]);
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Oturum açılamadı.' });
    req.session.user = { id: user.id, username: user.username, email: user.email };
    req.session.cookie.maxAge = req.body.rememberMe === true ? 30 * 24 * 60 * 60 * 1000 : null;
    req.session.save(saveErr => {
      if (saveErr) return res.status(500).json({ error: 'Oturum kaydedilemedi.' });
      res.json({ ok: true, user: req.session.user });
    });
  });
}));

app.post('/api/auth/logout', dbRequired, (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(() => {
    res.clearCookie('zirve.sid', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.json({ ok: true });
  });
});

app.post('/api/auth/forgot-password', dbRequired, resetLimiter, asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
  const generic = { ok: true, message: 'Adres kayıtlıysa şifre sıfırlama bağlantısı gönderilecektir.' };
  const result = await pool.query('SELECT id,email FROM users WHERE email_normalized=$1 AND is_active=TRUE LIMIT 1', [email]);
  if (!result.rows[0]) return res.json(generic);
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM || !process.env.APP_URL) return res.status(503).json({ error: 'Şifre sıfırlama e-posta hizmeti henüz yapılandırılmadı.' });
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await pool.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [result.rows[0].id]);
  await pool.query('INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL \'30 minutes\')', [result.rows[0].id, tokenHash]);
  const link = new URL('/?reset=' + encodeURIComponent(rawToken), process.env.APP_URL).toString();
  const mail = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [email], subject: 'ZirveOkey şifre sıfırlama', text: 'Şifrenizi yenilemek için 30 dakika içinde bu bağlantıyı açın: ' + link })
  });
  if (!mail.ok) throw new Error('Password reset email provider rejected the request');
  res.json(generic);
}));

app.post('/api/auth/reset-password', dbRequired, authLimiter, asyncRoute(async (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: 'Sıfırlama bağlantısı geçersiz veya süresi dolmuş.' });
  if (password.length < 10 || password.length > 72) return res.status(400).json({ error: 'Yeni şifre 10-72 karakter arasında olmalı.' });
  const digest = crypto.createHash('sha256').update(token).digest('hex');
  const hash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT id,user_id FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() FOR UPDATE', [digest]);
    if (!found.rows[0]) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Sıfırlama bağlantısı geçersiz veya süresi dolmuş.' }); }
    await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, found.rows[0].user_id]);
    await client.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [found.rows[0].user_id]);
    await client.query('DELETE FROM user_sessions WHERE sess::jsonb->\'user\'->>\'id\'=$1', [String(found.rows[0].user_id)]).catch(() => {});
    await client.query('COMMIT');
    res.json({ ok: true, message: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.' });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}));

app.get('/api/public/new-members', asyncRoute(async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Üye listesi şu anda kullanılamıyor.' });
  const result = await pool.query(
    'SELECT username, created_at FROM users WHERE is_active=TRUE ORDER BY created_at DESC LIMIT 5'
  );
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({ members: result.rows });
}));

app.post('/api/activity/heartbeat', dbRequired, asyncRoute(async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Aktivite kaydı için giriş yapmalısınız.' });
  await pool.query(`
    INSERT INTO user_activity(user_id,last_seen_at,active_seconds)
    VALUES($1,NOW(),0)
    ON CONFLICT(user_id) DO UPDATE SET
      active_seconds=user_activity.active_seconds + CASE
        WHEN user_activity.last_seen_at > NOW()-INTERVAL '2 minutes'
        THEN LEAST(90,GREATEST(0,EXTRACT(EPOCH FROM (NOW()-user_activity.last_seen_at))::BIGINT))
        ELSE 0 END,
      last_seen_at=NOW()
  `, [req.session.user.id]);
  res.status(204).end();
}));

app.get('/api/public/active-members', asyncRoute(async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Aktif üye listesi şu anda kullanılamıyor.' });
  const result = await pool.query(`
    SELECT u.username, a.active_seconds
    FROM user_activity a JOIN users u ON u.id=a.user_id
    WHERE u.is_active=TRUE AND a.last_seen_at > NOW()-INTERVAL '7 days'
    ORDER BY a.active_seconds DESC, a.last_seen_at DESC
    LIMIT 5
  `);
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({ members: result.rows });
}));

app.use(express.static(publicDir, {
  extensions: ['html'],
  etag: true,
  maxAge: '1h',
  setHeaders(res, filePath) { if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); }
}));
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.use((error, _req, res, _next) => {
  console.error('Request failed:', error.message);
  res.status(500).json({ error: 'İşlem sırasında beklenmeyen bir sunucu hatası oluştu.' });
});

async function start() {
  if (pool && sessionSecret) {
    await pool.query(schema);
    console.log('Database schema ready');
  } else {
    const missing = [!databaseUrl && 'DATABASE_URL', !sessionSecret && 'SESSION_SECRET'].filter(Boolean);
    console.warn('Account API disabled: missing ' + missing.join(', ') + '.');
  }
  app.listen(PORT, () => console.log('ZirveOkey running on port ' + PORT));
}
start().catch(error => { console.error('Startup failed:', error); process.exit(1); });
