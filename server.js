const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { rateLimit } = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { verifyResendWebhook } = require('./resend-webhook');

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
app.use(express.json({
  limit: '2mb',
  verify(req, _res, buffer) {
    if (req.path === '/api/webhooks/resend') req.rawBody = Buffer.from(buffer);
  }
}));
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
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_name_color VARCHAR(7) NOT NULL DEFAULT '#111111';
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_text_color VARCHAR(7) NOT NULL DEFAULT '#111111';
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_row_color VARCHAR(7) NOT NULL DEFAULT '#e8efe8';
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(16) NOT NULL DEFAULT 'normal';
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
CREATE TABLE IF NOT EXISTS user_presence (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  show_online BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS user_presence_seen_idx ON user_presence(last_seen_at DESC);
CREATE TABLE IF NOT EXISTS lobby_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username VARCHAR(24) NOT NULL,
  message VARCHAR(300) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS lobby_messages_created_idx ON lobby_messages(created_at DESC);
CREATE TABLE IF NOT EXISTS user_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(24) NOT NULL CHECK (category IN ('friendship','players','game','system','management','rewards')),
  title VARCHAR(120) NOT NULL,
  message VARCHAR(500) NOT NULL,
  action_url VARCHAR(300),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx ON user_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_notifications_unread_idx ON user_notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE TABLE IF NOT EXISTS member_friendships (
  id BIGSERIAL PRIMARY KEY,
  requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (requester_id <> recipient_id),
  UNIQUE(requester_id,recipient_id)
);
CREATE INDEX IF NOT EXISTS member_friendships_recipient_idx ON member_friendships(recipient_id,status,created_at DESC);
CREATE TABLE IF NOT EXISTS member_favorites (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id,target_id),
  CHECK(user_id <> target_id)
);
CREATE TABLE IF NOT EXISTS member_blocks (
  blocker_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(blocker_id,blocked_id),
  CHECK(blocker_id <> blocked_id)
);
CREATE TABLE IF NOT EXISTS member_reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(60) NOT NULL,
  details VARCHAR(500) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(reporter_id <> target_id)
);
CREATE INDEX IF NOT EXISTS member_reports_status_idx ON member_reports(status,created_at DESC);
CREATE TABLE IF NOT EXISTS private_messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message VARCHAR(1000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  CHECK(sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS private_messages_pair_idx ON private_messages(sender_id,recipient_id,id DESC);
CREATE INDEX IF NOT EXISTS private_messages_recipient_idx ON private_messages(recipient_id,read_at,id DESC);
CREATE TABLE IF NOT EXISTS resend_webhook_events (
  event_id VARCHAR(100) PRIMARY KEY,
  event_type VARCHAR(60) NOT NULL,
  email_id VARCHAR(100),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS resend_webhook_events_received_idx ON resend_webhook_events(received_at DESC);
`;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Çok fazla deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.' }
});
const socialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Çok sık üye işlemi yapıldı. Lütfen daha sonra tekrar deneyin.' }
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

app.post('/api/webhooks/resend', asyncRoute(async (req, res) => {
  if (!pool || !process.env.RESEND_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'E-posta olay alıcısı yapılandırılmamış.' });
  }
  if (!verifyResendWebhook(req, process.env.RESEND_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Webhook imzası geçersiz.' });
  }
  const event = req.body;
  const supportedEvents = new Set(['email.sent', 'email.delivered', 'email.delivery_delayed', 'email.bounced', 'email.complained', 'email.failed', 'email.suppressed']);
  if (!event || !supportedEvents.has(event.type)) {
    return res.status(400).json({ error: 'Desteklenmeyen e-posta olayı.' });
  }
  const emailId = typeof event.data?.email_id === 'string'
    ? event.data.email_id
    : (typeof event.data?.id === 'string' ? event.data.id : null);
  await pool.query(
    'INSERT INTO resend_webhook_events(event_id,event_type,email_id) VALUES($1,$2,$3) ON CONFLICT(event_id) DO NOTHING',
    [req.get('svix-id'), event.type, emailId]
  );
  res.status(204).end();
}));

if (pool && sessionSecret) {
  app.use(session({
    store: new PgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true, pruneSessionInterval: 900 }),
    name: 'zirve.sid',
    secret: sessionSecret,
    proxy: true,
    resave: false,
    saveUninitialized: false,
    cookie: { path: '/', httpOnly: true, secure: 'auto', sameSite: 'lax' }
  }));
}

app.get('/api/radio/status', (_req, res) => {
  const djName = String(process.env.RADIO_DJ_NAME || '').trim().slice(0, 48);
  let streamUrl = '';
  try {
    const candidate = new URL(String(process.env.RADIO_STREAM_URL || '').trim());
    if (candidate.protocol === 'https:' || candidate.protocol === 'http:') streamUrl = candidate.toString();
  } catch {}
  const isLive = String(process.env.RADIO_IS_LIVE || '').toLowerCase() === 'true' && Boolean(streamUrl && djName);
  res.json({ configured: Boolean(streamUrl), isLive, djName: isLive ? djName : '', streamUrl: isLive ? streamUrl : '' });
});

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
  const hasSessionCookie = String(req.headers.cookie || '').split(';').some(part => part.trim().startsWith('zirve.sid='));
  const authenticated = Boolean(req.session?.user?.id);
  console.info('[auth-session-check]', JSON.stringify({
    path: req.path,
    host: req.get('host'),
    secure: req.secure,
    hasSessionCookie,
    sessionLoaded: Boolean(req.session),
    authenticated
  }));
  if (!authenticated) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: req.session.user });
});

app.post('/api/auth/register', dbRequired, authLimiter, asyncRoute(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const country = String(req.body.country || '').trim();
  const gender = String(req.body.gender || '').trim();
  const allowedCountries = ['Türkiye','Almanya','Azerbaycan','Belçika','Birleşik Krallık','Fransa','Hollanda','Kıbrıs','ABD','Avusturya','Diğer'];
  const allowedGenders = ['Kadın','Erkek','Belirtmek istemiyorum'];
  if (!allowedCountries.includes(country)) return res.status(400).json({ error: 'Lütfen geçerli bir ülke seçin.' });
  if (!allowedGenders.includes(gender)) return res.status(400).json({ error: 'Lütfen cinsiyet seçimini yapın.' });
  if (!/^[\p{L}\p{N}_]{3,24}$/u.test(username)) return res.status(400).json({ error: 'Kullanıcı adı 3-24 karakter olmalı; harf, rakam ve alt çizgi kullanılabilir.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
  if (password.length < 10 || password.length > 72) return res.status(400).json({ error: 'Şifre 10-72 karakter arasında olmalı.' });
  const hash = await bcrypt.hash(password, 12);
  try {
    const result = await pool.query(
      'INSERT INTO users (username, username_normalized, email, email_normalized, password_hash, country, gender) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, username, email, country, gender',
      [username, username.toLocaleLowerCase('tr-TR'), email, email, hash, country, gender]
    );
    const user = result.rows[0];
    await pool.query("INSERT INTO user_notifications(user_id,category,title,message) SELECT id,'system',$2,$3 FROM users WHERE id=$1 AND notifications_enabled=TRUE AND COALESCE(member_preferences->>'settingNotifySystem','true') <> 'false'",[user.id,'ZirveOkey’e hoş geldin','Hesabın başarıyla oluşturuldu. Oyun lobisinde seni bekliyoruz.']);
    await new Promise((resolve, reject) => {
      req.session.regenerate(error => error ? reject(error) : resolve());
    });
    req.session.user = { id: user.id, username: user.username, email: user.email, country: user.country, gender: user.gender };
    req.session.cookie.maxAge = req.body.rememberMe === true ? 30 * 24 * 60 * 60 * 1000 : null;
    await new Promise((resolve, reject) => {
      req.session.save(error => error ? reject(error) : resolve());
    });
    res.status(201).json({ ok: true, user: req.session.user });
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
  await pool.query("INSERT INTO user_notifications(user_id,category,title,message) SELECT id,'system',$2,$3 FROM users WHERE id=$1 AND notifications_enabled=TRUE AND COALESCE(member_preferences->>'settingNotifySystem','true') <> 'false'",[user.id,'Hesabına giriş yapıldı','ZirveOkey hesabına yeni bir oturum açıldı. Bu işlem sana ait değilse hesabının güvenliğini kontrol et.']);
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

app.post('/api/auth/logout', dbRequired, asyncRoute(async (req, res) => {
  if (!req.session) return res.json({ ok: true });
  const userId = req.session.user?.id;
  if (userId) {
    try { await pool.query('DELETE FROM user_presence WHERE user_id=$1', [userId]); }
    catch (error) { console.error('Presence cleanup failed during logout:', error.message); }
  }
  req.session.destroy(error => {
    if (error) return res.status(500).json({ error: 'Oturum kapatılamadı.' });
    res.clearCookie('zirve.sid', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.json({ ok: true });
  });
}));
app.post('/api/presence/heartbeat', dbRequired, asyncRoute(async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Çevrimiçi görünmek için giriş yapmalısınız.' });
  const presence = await pool.query(`
    INSERT INTO user_presence(user_id,last_seen_at,show_online)
    SELECT u.id,NOW(),TRUE FROM users u WHERE u.id=$1 AND u.is_active=TRUE
    ON CONFLICT(user_id) DO UPDATE SET last_seen_at=NOW(),show_online=TRUE
    RETURNING user_id
  `, [req.session.user.id]);
  if (!presence.rowCount) return res.status(401).json({ error: 'Hesap etkin değil. Lütfen yeniden giriş yapın.' });
  res.status(204).end();
}));

app.get('/api/presence/online', dbRequired, asyncRoute(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const result = await pool.query(`
    SELECT u.id,u.username,u.membership_tier,
      CASE WHEN u.member_preferences->>'settingPresenceStatus' IN ('away','sleeping','busy')
        THEN u.member_preferences->>'settingPresenceStatus' ELSE 'online' END AS status
    FROM user_presence p JOIN users u ON u.id=p.user_id
    WHERE p.last_seen_at>NOW()-INTERVAL '90 seconds' AND u.is_active=TRUE
      AND ($1::bigint IS NULL OR NOT EXISTS(SELECT 1 FROM member_blocks b WHERE b.blocker_id=$1 AND b.blocked_id=u.id))
    ORDER BY u.username_normalized ASC LIMIT 100
  `,[req.session.user?.id||null]);
  res.json({ members: result.rows, count: result.rows.length });
}));

app.put('/api/account/password', dbRequired, authLimiter, asyncRoute(async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Şifre değiştirmek için giriş yapmalısınız.' });
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (currentPassword.length < 10 || currentPassword.length > 72) return res.status(400).json({ error: 'Mevcut şifren geçersiz.' });
  if (newPassword.length < 10 || newPassword.length > 72) return res.status(400).json({ error: 'Yeni şifre 10-72 karakter arasında olmalı.' });
  if (currentPassword === newPassword) return res.status(400).json({ error: 'Yeni şifren mevcut şifrenle aynı olamaz.' });
  const found = await pool.query('SELECT password_hash FROM users WHERE id=$1 AND is_active=TRUE', [req.session.user.id]);
  if (!found.rows[0] || !(await bcrypt.compare(currentPassword, found.rows[0].password_hash))) return res.status(400).json({ error: 'Mevcut şifren doğru değil.' });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [passwordHash, req.session.user.id]);
  res.json({ ok: true, message: 'Şifren başarıyla güncellendi.' });
}));

app.get('/api/account/preferences', dbRequired, asyncRoute(async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Ayarlar için giriş yapmalısınız.' });
  const result = await pool.query('SELECT member_preferences FROM users WHERE id=$1 AND is_active=TRUE', [req.session.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Hesap bulunamadı.' });
  res.json({ preferences: result.rows[0].member_preferences || {} });
}));
app.put('/api/account/preferences', dbRequired, asyncRoute(async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Ayarları kaydetmek için giriş yapmalısınız.' });
  const allowed = ['profileBio','settingAnimations','settingDarkMode','settingNotifications','settingNotificationSound','settingPrivateMessages','settingFriendRequests','settingNotifyPlayers','settingNotifyGame','settingNotifySystem','settingNotifyManagement','settingNotifyRewards','settingAutoArrange','settingConfirmExit','settingCompactUI','settingPresenceStatus'];
  const input = req.body?.preferences;
  const validPresenceStatuses = new Set(['online','away','sleeping','busy']);
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !allowed.includes(key)) ||
      Object.entries(input).some(([key,value]) => key === 'profileBio'
        ? typeof value !== 'string' || value.trim().length > 160
        : key === 'settingPresenceStatus'
          ? typeof value !== 'string' || !validPresenceStatuses.has(value)
          : typeof value !== 'boolean')) {
    return res.status(400).json({ error: 'Geçersiz ayar verisi.' });
  }
  const result = await pool.query(
    `UPDATE users
     SET member_preferences=member_preferences || $1::jsonb,
         notifications_enabled=CASE WHEN $2::boolean IS NULL THEN notifications_enabled ELSE $2::boolean END
     WHERE id=$3 AND is_active=TRUE
     RETURNING member_preferences`,
    [JSON.stringify(input), Object.prototype.hasOwnProperty.call(input, 'settingNotifications') ? input.settingNotifications : null, req.session.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Hesap bulunamadı.' });
  res.json({ ok: true, preferences: result.rows[0].member_preferences });
}));

app.get('/api/public/members/:id/avatar', dbRequired, asyncRoute(async (req, res) => {
  const memberId = Number(req.params.id);
  if (!Number.isSafeInteger(memberId) || memberId < 1) return res.status(400).end();
  const result = await pool.query('SELECT avatar_data FROM users WHERE id=$1 AND is_active=TRUE', [memberId]);
  const avatar = result.rows[0]?.avatar_data;
  const match = typeof avatar === 'string' ? avatar.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/) : null;
  if (!match) return res.status(404).end();
  res.setHeader('Content-Type', match[1] === 'jpeg' ? 'image/jpeg' : 'image/' + match[1]);
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.send(Buffer.from(match[2], 'base64'));
}));

app.get('/api/account/avatar', dbRequired, asyncRoute(async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Avatar için giriş yapmalısınız.' });
  const result = await pool.query('SELECT avatar_data FROM users WHERE id=$1 AND is_active=TRUE', [req.session.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Hesap bulunamadı.' });
  res.json({ avatar: result.rows[0].avatar_data || null });
}));

app.put('/api/account/avatar', dbRequired, asyncRoute(async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Avatar değiştirmek için giriş yapmalısınız.' });
  const avatar = req.body.avatar === null ? null : String(req.body.avatar || '');
  if (avatar !== null && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar) || avatar.length > 1400000)) {
    return res.status(400).json({ error: 'PNG, JPG veya WebP formatında, en fazla 1 MB bir görsel seçin.' });
  }
  const result = await pool.query('UPDATE users SET avatar_data=$1 WHERE id=$2 AND is_active=TRUE RETURNING avatar_data', [avatar, req.session.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Hesap bulunamadı.' });
  res.json({ ok: true, avatar: result.rows[0].avatar_data || null });
}));

app.get('/api/account/chat-style', dbRequired, asyncRoute(async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Renk tercihleri için giriş yapmalısınız.' });
  const result = await pool.query('SELECT chat_name_color,chat_text_color,chat_row_color FROM users WHERE id=$1 AND is_active=TRUE', [req.session.user.id]);
  if (!result.rows[0]) return res.status(401).json({ error: 'Hesap bulunamadı.' });
  res.json({ chatStyle: { nameColor: result.rows[0].chat_name_color, textColor: result.rows[0].chat_text_color, rowColor: result.rows[0].chat_row_color } });
}));

app.put('/api/account/chat-style', dbRequired, asyncRoute(async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Renk tercihleri için giriş yapmalısınız.' });
  const nameColor = String(req.body.nameColor || '').toLowerCase();
  const textColor = String(req.body.textColor || '').toLowerCase();
  const rowColor = req.body.rowColor === undefined ? null : String(req.body.rowColor || '').toLowerCase();
  const validHex = value => /^#[0-9a-f]{6}$/.test(value);
  if (!validHex(nameColor) || !validHex(textColor) || (rowColor !== null && !validHex(rowColor))) return res.status(400).json({ error: 'Geçerli bir HEX renk seçin.' });
  const result = await pool.query('UPDATE users SET chat_name_color=$1,chat_text_color=$2,chat_row_color=COALESCE($3,chat_row_color) WHERE id=$4 RETURNING chat_name_color,chat_text_color,chat_row_color', [nameColor, textColor, rowColor, req.session.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Hesap bulunamadı.' });
  res.json({ ok: true, chatStyle: { nameColor: result.rows[0].chat_name_color, textColor: result.rows[0].chat_text_color, rowColor: result.rows[0].chat_row_color } });
}));

app.get('/api/lobby/chat-styles', dbRequired, asyncRoute(async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const result = await pool.query(`
    SELECT u.id,u.username,u.chat_name_color,u.chat_text_color
    FROM users u
    JOIN user_presence p ON p.user_id=u.id
    WHERE u.is_active=TRUE AND p.last_seen_at>NOW()-INTERVAL '90 seconds'
    ORDER BY u.id ASC
  `);
  res.json({ members: result.rows });
}));

app.get('/api/lobby/messages', dbRequired, asyncRoute(async (req, res) => {
  const afterId = Math.max(0, Number.parseInt(req.query.after || '0', 10) || 0);
  const result = afterId
    ? await pool.query('SELECT m.id,m.user_id,m.username,m.message,m.created_at,u.chat_name_color,u.chat_text_color,u.chat_row_color FROM lobby_messages m JOIN users u ON u.id=m.user_id WHERE m.id>$1 ORDER BY m.id ASC LIMIT 100', [afterId])
    : await pool.query('SELECT m.id,m.user_id,m.username,m.message,m.created_at,m.chat_name_color,m.chat_text_color,m.chat_row_color FROM (SELECT lm.id,lm.user_id,lm.username,lm.message,lm.created_at,u.chat_name_color,u.chat_text_color,u.chat_row_color FROM lobby_messages lm JOIN users u ON u.id=lm.user_id ORDER BY lm.id DESC LIMIT 50) m ORDER BY m.id ASC');
  res.json({ messages: result.rows });
}));

app.post('/api/lobby/messages', dbRequired, authLimiter, asyncRoute(async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Sohbete yazmak için önce giriş yapmalısınız.' });
  const message = String(req.body.message || '').trim();
  if (!message || message.length > 300) return res.status(400).json({ error: 'Mesaj 1-300 karakter arasında olmalı.' });
  const user = req.session.user;
  const result = await pool.query(
    'INSERT INTO lobby_messages(user_id,username,message) VALUES($1,$2,$3) RETURNING id',
    [user.id, user.username, message]
  );
  const decorated = await pool.query('SELECT m.id,m.user_id,m.username,m.message,m.created_at,u.chat_name_color,u.chat_text_color,u.chat_row_color FROM lobby_messages m JOIN users u ON u.id=m.user_id WHERE m.id=$1', [result.rows[0].id]);
  await pool.query('DELETE FROM lobby_messages WHERE id < (SELECT GREATEST(COALESCE(MAX(id),0)-500,0) FROM lobby_messages)');
  res.status(201).json({ message: decorated.rows[0] });
}));


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


function requireMemberSession(req,res){
  if(!req.session.user?.id){res.status(401).json({error:'Bu işlem için giriş yapmalısınız.'});return null;}
  return Number(req.session.user.id);
}
async function notifyMember(userId,category,title,message,actionUrl=null){
  const preferenceKey={friendship:'settingFriendRequests',players:'settingNotifyPlayers',game:'settingNotifyGame',system:'settingNotifySystem',management:'settingNotifyManagement',rewards:'settingNotifyRewards'}[category];
  await pool.query(`INSERT INTO user_notifications(user_id,category,title,message,action_url)
    SELECT id,$2,$3,$4,$5 FROM users
    WHERE id=$1 AND notifications_enabled=TRUE
      AND COALESCE(member_preferences->>$6,'true')<>'false'`,
  [userId,category,title,message,actionUrl,preferenceKey||'']);
}
function parseMemberId(value){
  if(!/^[1-9]\d*$/.test(String(value)))return null;
  const id=Number(value);return Number.isSafeInteger(id)?id:null;
}
app.get('/api/members/:id/profile',dbRequired,asyncRoute(async(req,res)=>{
  const viewerId=requireMemberSession(req,res);if(!viewerId)return;
  const targetId=parseMemberId(req.params.id);if(!targetId)return res.status(400).json({error:'Geçersiz üye.'});
  const result=await pool.query(`
    SELECT u.id,u.username,u.membership_tier,u.created_at,
      COALESCE(u.member_preferences->>'profileBio','') AS bio,
      CASE WHEN p.last_seen_at>NOW()-INTERVAL '90 seconds' THEN
        CASE WHEN u.member_preferences->>'settingPresenceStatus' IN ('away','sleeping','busy') THEN u.member_preferences->>'settingPresenceStatus' ELSE 'online' END
      ELSE 'offline' END AS status,
      EXISTS(SELECT 1 FROM member_friendships f WHERE ((f.requester_id=$1 AND f.recipient_id=u.id) OR (f.requester_id=u.id AND f.recipient_id=$1)) AND f.status='accepted') AS is_friend,
      EXISTS(SELECT 1 FROM member_friendships f WHERE f.requester_id=u.id AND f.recipient_id=$1 AND f.status='pending') AS incoming_request,
      EXISTS(SELECT 1 FROM member_friendships f WHERE f.requester_id=$1 AND f.recipient_id=u.id AND f.status='pending') AS outgoing_request,
      EXISTS(SELECT 1 FROM member_favorites WHERE user_id=$1 AND target_id=u.id) AS is_favorite,
      EXISTS(SELECT 1 FROM member_blocks WHERE blocker_id=$1 AND blocked_id=u.id) AS is_blocked,
      EXISTS(SELECT 1 FROM member_blocks WHERE blocker_id=u.id AND blocked_id=$1) AS blocked_by_member
    FROM users u LEFT JOIN user_presence p ON p.user_id=u.id
    WHERE u.id=$2 AND u.is_active=TRUE
  `,[viewerId,targetId]);
  if(!result.rowCount)return res.status(404).json({error:'Üye bulunamadı.'});
  if(result.rows[0].blocked_by_member)return res.status(403).json({error:'Bu üyenin profili sana açık değil.'});
  res.json({profile:result.rows[0]});
}));
app.get('/api/social/summary',dbRequired,asyncRoute(async(req,res)=>{
  const userId=requireMemberSession(req,res);if(!userId)return;
  const [friends,incoming,favorites,blocked]=await Promise.all([
    pool.query("SELECT u.id,u.username,u.membership_tier FROM member_friendships f JOIN users u ON u.id=CASE WHEN f.requester_id=$1 THEN f.recipient_id ELSE f.requester_id END WHERE (f.requester_id=$1 OR f.recipient_id=$1) AND f.status='accepted' ORDER BY u.username_normalized",[userId]),
    pool.query("SELECT u.id,u.username FROM member_friendships f JOIN users u ON u.id=f.requester_id WHERE f.recipient_id=$1 AND f.status='pending' ORDER BY f.created_at DESC",[userId]),
    pool.query('SELECT u.id,u.username,u.membership_tier FROM member_favorites f JOIN users u ON u.id=f.target_id WHERE f.user_id=$1 ORDER BY f.created_at DESC',[userId]),
    pool.query('SELECT u.id,u.username FROM member_blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=$1 ORDER BY b.created_at DESC',[userId])
  ]);
  res.json({friends:friends.rows,incoming:incoming.rows,favorites:favorites.rows,blocked:blocked.rows});
}));
app.post('/api/social/friends/:id',dbRequired,socialLimiter,asyncRoute(async(req,res)=>{
  const userId=requireMemberSession(req,res);if(!userId)return;const targetId=parseMemberId(req.params.id);
  if(!targetId||targetId===userId)return res.status(400).json({error:'Geçerli bir üye seçin.'});
  const target=await pool.query('SELECT username FROM users WHERE id=$1 AND is_active=TRUE',[targetId]);if(!target.rowCount)return res.status(404).json({error:'Üye bulunamadı.'});
  const blocked=await pool.query('SELECT 1 FROM member_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',[userId,targetId]);
  if(blocked.rowCount)return res.status(403).json({error:'Engellenmiş üyeler arasında arkadaşlık kurulamaz.'});
  const existing=await pool.query('SELECT id,status FROM member_friendships WHERE requester_id=$2 AND recipient_id=$1',[userId,targetId]);
  if(existing.rows[0]?.status==='pending'){
    await pool.query("UPDATE member_friendships SET status='accepted',updated_at=NOW() WHERE id=$1",[existing.rows[0].id]);
    await notifyMember(targetId,'friendship','Arkadaşlık isteği kabul edildi',req.session.user.username+' arkadaşlık isteğini kabul etti.');
    return res.json({ok:true,status:'accepted'});
  }
  const result=await pool.query(`INSERT INTO member_friendships(requester_id,recipient_id) VALUES($1,$2)
    ON CONFLICT(requester_id,recipient_id) DO UPDATE SET status='pending',updated_at=NOW()
    WHERE member_friendships.status='declined' RETURNING id`,[userId,targetId]);
  if(!result.rowCount)return res.status(409).json({error:'Bu üyeye zaten arkadaşlık isteği gönderdin.'});
  await notifyMember(targetId,'friendship','Yeni arkadaşlık isteği',req.session.user.username+' sana arkadaşlık isteği gönderdi.','/oyun?social=friends');
  res.status(201).json({ok:true,status:'pending'});
}));
app.put('/api/social/friends/:id',dbRequired,asyncRoute(async(req,res)=>{
  const userId=requireMemberSession(req,res);if(!userId)return;const requesterId=parseMemberId(req.params.id);
  if(!requesterId||requesterId===userId||!['accepted','declined'].includes(req.body.status))return res.status(400).json({error:'İstek bilgisi geçersiz.'});
  const result=await pool.query("UPDATE member_friendships SET status=$1,updated_at=NOW() WHERE requester_id=$2 AND recipient_id=$3 AND status='pending' RETURNING id",[req.body.status,requesterId,userId]);
  if(!result.rowCount)return res.status(404).json({error:'Bekleyen arkadaşlık isteği bulunamadı.'});
  if(req.body.status==='accepted')await notifyMember(requesterId,'friendship','Arkadaşlık isteğin kabul edildi',req.session.user.username+' arkadaşlık isteğini kabul etti.');
  res.json({ok:true,status:req.body.status});
}));
app.delete('/api/social/friends/:id',dbRequired,asyncRoute(async(req,res)=>{
  const userId=requireMemberSession(req,res);if(!userId)return;const targetId=parseMemberId(req.params.id);if(!targetId)return res.status(400).json({error:'Geçersiz üye.'});
  await pool.query('DELETE FROM member_friendships WHERE (requester_id=$1 AND recipient_id=$2) OR (requester_id=$2 AND recipient_id=$1)',[userId,targetId]);res.json({ok:true});
}));
app.post('/api/social/favorites/:id',dbRequired,asyncRoute(async(req,res)=>{
  const userId=requireMemberSession(req,res);if(!userId)return;const targetId=parseMemberId(req.params.id);
  if(!targetId||targetId===userId)return res.status(400).json({error:'Geçerli bir üye seçin.'});
  const exists=await pool.query('SELECT 1 FROM users WHERE id=$1 AND is_active=TRUE',[targetId]);if(!exists.rowCount)return res.status(404).json({error:'Üye bulunamadı.'});
  await pool.query('INSERT INTO member_favorites(user_id,target_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[userId,targetId]);res.json({ok:true,favorite:true});
}));
app.delete('/api/social/favorites/:id',dbRequired,asyncRoute(async(req,res)=>{
  const userId=requireMemberSession(req,res);if(!userId)return;const targetId=parseMemberId(req.params.id);if(!targetId)return res.status(400).json({error:'Geçersiz üye.'});
  await pool.query('DELETE FROM member_favorites WHERE user_id=$1 AND target_id=$2',[userId,targetId]);res.json({ok:true,favorite:false});
}));
app.post('/api/social/blocks/:id',dbRequired,asyncRoute(async(req,res)=>{
  const userId=requireMemberSession(req,res);if(!userId)return;const targetId=parseMemberId(req.params.id);
  if(!targetId||targetId===userId)return res.status(400).json({error:'Geçerli bir üye seçin.'});
  const exists=await pool.query('SELECT 1 FROM users WHERE id=$1 AND is_active=TRUE',[targetId]);if(!exists.rowCount)return res.status(404).json({error:'Üye bulunamadı.'});
  await pool.query('INSERT INTO member_blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[userId,targetId]);
  await pool.query('DELETE FROM member_friendships WHERE (requester_id=$1 AND recipient_id=$2) OR (requester_id=$2 AND recipient_id=$1)',[userId,targetId]);
  res.json({ok:true,blocked:true});
}));
app.delete('/api/social/blocks/:id',dbRequired,asyncRoute(async(req,res)=>{
  const userId=requireMemberSession(req,res);if(!userId)return;const targetId=parseMemberId(req.params.id);if(!targetId)return res.status(400).json({error:'Geçersiz üye.'});
  await pool.query('DELETE FROM member_blocks WHERE blocker_id=$1 AND blocked_id=$2',[userId,targetId]);res.json({ok:true,blocked:false});
}));
app.post('/api/social/reports/:id',dbRequired,socialLimiter,asyncRoute(async(req,res)=>{
  const userId=requireMemberSession(req,res);if(!userId)return;const targetId=parseMemberId(req.params.id);
  const reason=String(req.body.reason||'').trim(),details=String(req.body.details||'').trim();
  if(!targetId||targetId===userId||!['Spam','Hakaret veya taciz','Uygunsuz profil','Dolandırıcılık','Diğer'].includes(reason)||details.length<10||details.length>500)return res.status(400).json({error:'Şikâyet nedeni ve 10-500 karakter açıklama girin.'});
  const exists=await pool.query('SELECT 1 FROM users WHERE id=$1 AND is_active=TRUE',[targetId]);if(!exists.rowCount)return res.status(404).json({error:'Üye bulunamadı.'});
  const duplicate=await pool.query("SELECT 1 FROM member_reports WHERE reporter_id=$1 AND target_id=$2 AND status<>'closed' AND created_at>NOW()-INTERVAL '24 hours'",[userId,targetId]);
  if(duplicate.rowCount)return res.status(409).json({error:'Bu üye için son 24 saat içinde açık bir şikâyetin bulunuyor.'});
  await pool.query('INSERT INTO member_reports(reporter_id,target_id,reason,details) VALUES($1,$2,$3,$4)',[userId,targetId,reason,details]);
  res.status(201).json({ok:true});
}));
app.get('/api/private-messages/:id',dbRequired,asyncRoute(async(req,res)=>{
  const userId=requireMemberSession(req,res);if(!userId)return;const targetId=parseMemberId(req.params.id),afterId=Math.max(0,Number.parseInt(req.query.after||'0',10)||0);
  if(!targetId||targetId===userId)return res.status(400).json({error:'Geçerli bir konuşma seçin.'});
  const blocked=await pool.query('SELECT 1 FROM member_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',[userId,targetId]);if(blocked.rowCount)return res.status(403).json({error:'Engellenmiş üyeler arasında mesajlaşma kapalı.'});
  const privacy=await pool.query("SELECT COALESCE(member_preferences->>'settingPrivateMessages','true')<>'false' AS allowed FROM users WHERE id=$1",[targetId]);if(!privacy.rows[0]?.allowed)return res.status(403).json({error:'Bu üye özel mesajları kabul etmiyor.'});
  const result=await pool.query(`SELECT id,sender_id,recipient_id,message,created_at,read_at FROM private_messages
    WHERE ((sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1)) AND id>$3 ORDER BY id ASC LIMIT 100`,[userId,targetId,afterId]);
  await pool.query('UPDATE private_messages SET read_at=COALESCE(read_at,NOW()) WHERE sender_id=$1 AND recipient_id=$2 AND read_at IS NULL',[targetId,userId]);
  res.json({messages:result.rows});
}));
app.post('/api/private-messages/:id',dbRequired,socialLimiter,asyncRoute(async(req,res)=>{
  const userId=requireMemberSession(req,res);if(!userId)return;const targetId=parseMemberId(req.params.id),message=String(req.body.message||'').trim();
  if(!targetId||targetId===userId||!message||message.length>1000)return res.status(400).json({error:'Mesaj 1-1000 karakter arasında olmalı.'});
  const target=await pool.query('SELECT username FROM users WHERE id=$1 AND is_active=TRUE',[targetId]);if(!target.rowCount)return res.status(404).json({error:'Üye bulunamadı.'});
  const blocked=await pool.query('SELECT 1 FROM member_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',[userId,targetId]);if(blocked.rowCount)return res.status(403).json({error:'Engellenmiş üyeler arasında mesajlaşma kapalı.'});
  const privacy=await pool.query("SELECT COALESCE(member_preferences->>'settingPrivateMessages','true')<>'false' AS allowed FROM users WHERE id=$1",[targetId]);if(!privacy.rows[0]?.allowed)return res.status(403).json({error:'Bu üye özel mesajları kabul etmiyor.'});
  const result=await pool.query('INSERT INTO private_messages(sender_id,recipient_id,message) VALUES($1,$2,$3) RETURNING id,sender_id,recipient_id,message,created_at,read_at',[userId,targetId,message]);
  await notifyMember(targetId,'players','Yeni özel mesaj',req.session.user.username+' sana özel mesaj gönderdi.','/oyun?social=messages');
  res.status(201).json({message:result.rows[0]});
}));
app.get('/api/private-messages',dbRequired,asyncRoute(async(req,res)=>{
  const userId=requireMemberSession(req,res);if(!userId)return;
  const result=await pool.query(`SELECT DISTINCT ON (peer.id) peer.id,peer.username,last.message,last.created_at,
    (SELECT COUNT(*)::int FROM private_messages unread WHERE unread.sender_id=peer.id AND unread.recipient_id=$1 AND unread.read_at IS NULL) AS unread
    FROM (SELECT CASE WHEN sender_id=$1 THEN recipient_id ELSE sender_id END AS peer_id,MAX(id) AS last_id FROM private_messages WHERE sender_id=$1 OR recipient_id=$1 GROUP BY 1) pairs
    JOIN users peer ON peer.id=pairs.peer_id JOIN private_messages last ON last.id=pairs.last_id
    WHERE NOT EXISTS(SELECT 1 FROM member_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=peer.id) OR (b.blocker_id=peer.id AND b.blocked_id=$1))
    ORDER BY peer.id,last.created_at DESC LIMIT 50`,[userId]);
  res.json({conversations:result.rows});
}));

app.get('/api/notifications', dbRequired, asyncRoute(async (req,res) => {
  if (!req.session.user?.id) return res.status(401).json({error:'Bildirimleri görmek için giriş yapmalısınız.'});
  const pref=await pool.query('SELECT notifications_enabled,member_preferences FROM users WHERE id=$1',[req.session.user.id]);
  const enabled=pref.rows[0]?.notifications_enabled===true;
  const [items,counts]=await Promise.all([
    pool.query('SELECT id,category,title,message,action_url,read_at,created_at FROM user_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[req.session.user.id]),
    pool.query('SELECT category,COUNT(*)::int AS unread FROM user_notifications WHERE user_id=$1 AND read_at IS NULL GROUP BY category',[req.session.user.id])
  ]);
  const unreadByCategory=Object.fromEntries(counts.rows.map(row=>[row.category,row.unread]));
  res.setHeader('Cache-Control','no-store');
  res.json({notifications:items.rows,unreadByCategory,preferences:pref.rows[0]?.member_preferences||{},enabled});
}));
app.put('/api/notifications/preferences', dbRequired, asyncRoute(async(req,res)=>{
  if(!req.session.user?.id)return res.status(401).json({error:'Giriş yapmalısınız.'});
  if(typeof req.body.enabled!=='boolean')return res.status(400).json({error:'Bildirim tercihi geçersiz.'});
  const result=await pool.query(
    `UPDATE users
     SET notifications_enabled=$1,
         member_preferences=member_preferences || jsonb_build_object('settingNotifications',$1::boolean)
     WHERE id=$2
     RETURNING notifications_enabled`,
    [req.body.enabled,req.session.user.id]
  );
  res.setHeader('Cache-Control','no-store');
  res.json({enabled:result.rows[0]?.notifications_enabled===true});
}));
app.post('/api/notifications/:id/read', dbRequired, asyncRoute(async (req,res) => {
  if (!req.session.user?.id) return res.status(401).json({error:'Giriş yapmalısınız.'});
  if(!/^[1-9]\d*$/.test(req.params.id))return res.status(400).json({error:'Geçersiz bildirim.'});
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id))return res.status(400).json({error:'Geçersiz bildirim.'});
  const result=await pool.query('UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND user_id=$2 RETURNING id',[id,req.session.user.id]);
  if(!result.rowCount)return res.status(404).json({error:'Bildirim bulunamadı.'});
  res.json({ok:true});
}));
app.post('/api/notifications/read-all', dbRequired, asyncRoute(async (req,res) => {
  if (!req.session.user?.id) return res.status(401).json({error:'Giriş yapmalısınız.'});
  await pool.query('UPDATE user_notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL',[req.session.user.id]);
  res.json({ok:true});
}));
app.delete('/api/notifications/:id', dbRequired, asyncRoute(async (req,res) => {
  if (!req.session.user?.id) return res.status(401).json({error:'Giriş yapmalısınız.'});
  if(!/^[1-9]\d*$/.test(req.params.id))return res.status(400).json({error:'Geçersiz bildirim.'});
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id))return res.status(400).json({error:'Geçersiz bildirim.'});
  const result=await pool.query('DELETE FROM user_notifications WHERE id=$1 AND user_id=$2 RETURNING id',[id,req.session.user.id]);
  if(!result.rowCount)return res.status(404).json({error:'Bildirim bulunamadı.'});
  res.json({ok:true});
}));
app.delete('/api/notifications', dbRequired, asyncRoute(async (req,res) => {
  if (!req.session.user?.id) return res.status(401).json({error:'Giriş yapmalısınız.'});
  await pool.query('DELETE FROM user_notifications WHERE user_id=$1',[req.session.user.id]);
  res.json({ok:true});
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

app.get(['/oyun', '/oyun/'], (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(publicDir, 'oyun.html'));
});
app.use(express.static(publicDir, {
  extensions: ['html'],
  etag: true,
  maxAge: '1h',
  setHeaders(res, filePath) { if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); }
}));
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.use((error, req, res, _next) => {
  console.error('Request failed:', JSON.stringify({ path: req.originalUrl, method: req.method, code: error.code || null, message: error.message }));
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
