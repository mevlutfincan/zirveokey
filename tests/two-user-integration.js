const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const port = Number(process.env.TEST_PORT || 3101);
const baseUrl = 'http://127.0.0.1:' + port;
const child = spawn(process.execPath, ['server.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverOutput = '';
child.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
child.stderr.on('data', chunk => { serverOutput += chunk.toString(); });

function cookieFrom(response) {
  const value = response.headers.get('set-cookie');
  assert.ok(value, 'Oturum cookie sunucu tarafından gönderilmedi.');
  return value.split(';', 1)[0];
}

async function request(path, { method = 'GET', cookie, body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(baseUrl + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual'
  });
}

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    if (child.exitCode !== null) throw new Error('Test sunucusu başlamadı:\n' + serverOutput);
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) {
        const health = await response.json();
        assert.equal(health.database, 'connected', 'Test veritabanı bağlantısı kurulamadı.');
        assert.equal(health.authConfigured, true, 'Üyelik yapılandırması eksik.');
        return;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Test sunucusu zamanında hazır olmadı:\n' + serverOutput);
}

async function main() {
  await waitForServer();
  const radioStatusResponse = await request('/api/radio/status');
  assert.equal(radioStatusResponse.status, 200, 'Radyo yayın durumu alınamadı.');
  const radioStatus = await radioStatusResponse.json();
  assert.equal(typeof radioStatus.configured, 'boolean', 'Radyo yapılandırma durumu boolean olmalı.');
  assert.equal(typeof radioStatus.isLive, 'boolean', 'Radyo canlı yayın durumu boolean olmalı.');
  assert.equal(typeof radioStatus.djName, 'string', 'Radyo yayıncı adı metin olmalı.');
  assert.equal(typeof radioStatus.streamUrl, 'string', 'Radyo yayın adresi metin olmalı.');
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const users = [
    { username: 'TestA_' + suffix, email: 'testa-' + suffix + '@example.invalid', password: 'ZirveTest!2026A', country: 'Türkiye', gender: 'Kadın' },
    { username: 'TestB_' + suffix, email: 'testb-' + suffix + '@example.invalid', password: 'ZirveTest!2026B', country: 'Almanya', gender: 'Erkek' }
  ];

  const registerA = await request('/api/auth/register', { method: 'POST', body: users[0] });
  assert.equal(registerA.status, 201, 'Birinci kullanıcı kaydı başarısız: ' + await registerA.text());
  const cookieA = cookieFrom(registerA);
  const registerB = await request('/api/auth/register', { method: 'POST', body: users[1] });
  assert.equal(registerB.status, 201, 'İkinci kullanıcı kaydı başarısız: ' + await registerB.text());
  const cookieB = cookieFrom(registerB);

  for (const [label, cookie, expected] of [['A', cookieA, users[0].username], ['B', cookieB, users[1].username]]) {
    const me = await request('/api/auth/me', { cookie });
    assert.equal(me.status, 200, label + ' oturum kontrolü başarısız.');
    const data = await me.json();
    assert.equal(data.authenticated, true, label + ' oturumu doğrulanmadı.');
    assert.equal(data.user.username, expected, label + ' yanlış kullanıcıya bağlandı.');
    assert.equal(data.user.country, label === 'A' ? 'Türkiye' : 'Almanya', label + ' ülke bilgisi saklanmadı.');
    assert.equal(data.user.gender, label === 'A' ? 'Kadın' : 'Erkek', label + ' cinsiyet bilgisi saklanmadı.');
  }

  const anonymousPreferences = await request('/api/account/preferences');
  assert.equal(anonymousPreferences.status, 401, 'Oturumsuz kullanıcı hesap tercihlerini okuyabildi.');
  const savePreferencesA = await request('/api/account/preferences', { method: 'PUT', cookie: cookieA, body: { preferences: { settingDarkMode: false, settingShowOnline: false, settingAutoArrange: true } } });
  assert.equal(savePreferencesA.status, 200, 'A kendi ayarlarını kaydedemedi.');
  const readPreferencesA = await request('/api/account/preferences', { cookie: cookieA });
  const prefsA = (await readPreferencesA.json()).preferences;
  assert.equal(prefsA.settingDarkMode, false, 'A tema tercihi kalıcı değil.');
  assert.equal(prefsA.settingShowOnline, false, 'A gizlilik tercihi kalıcı değil.');
  assert.equal(prefsA.settingAutoArrange, true, 'A oyun tercihi kalıcı değil.');
  const prefsB = (await (await request('/api/account/preferences', { cookie: cookieB })).json()).preferences;
  assert.equal(prefsB.settingDarkMode, undefined, 'A kullanıcısının ayarı B hesabına sızdı.');
  const invalidPreferences = await request('/api/account/preferences', { method: 'PUT', cookie: cookieA, body: { preferences: { isAdmin: true } } });
  assert.equal(invalidPreferences.status, 400, 'İzin verilmeyen hesap tercihi kabul edildi.');

  const anonymousStyle = await request('/api/account/chat-style');
  assert.equal(anonymousStyle.status, 401, 'Oturumsuz kullanıcının renk tercihleri okunabildi.');
  const defaultStyleResponse = await request('/api/account/chat-style', { cookie: cookieA });
  assert.equal(defaultStyleResponse.status, 200, 'A varsayılan sohbet renklerini alamadı.');
  const defaultStyle = (await defaultStyleResponse.json()).chatStyle;
  assert.equal(defaultStyle.nameColor, '#111111', 'Varsayılan isim rengi beklenenden farklı.');
  assert.equal(defaultStyle.textColor, '#111111', 'Varsayılan mesaj rengi beklenenden farklı.');
  assert.equal(defaultStyle.rowColor, '#e8efe8', 'Varsayılan satır rengi beklenenden farklı.');
  const savedStyleResponse = await request('/api/account/chat-style', {
    method: 'PUT', cookie: cookieA, body: { nameColor: '#7f1d1d', textColor: '#1e3a8a', rowColor: '#dbeafe' }
  });
  const savedStyleData = await savedStyleResponse.json().catch(() => ({}));
  assert.equal(savedStyleResponse.status, 200, 'A renk tercihlerini kaydedemedi: ' + JSON.stringify(savedStyleData));
  const savedStyle = savedStyleData.chatStyle;
  assert.equal(savedStyle.nameColor, '#7f1d1d');
  assert.equal(savedStyle.textColor, '#1e3a8a');
  assert.equal(savedStyle.rowColor, '#dbeafe');
  const lightStyleResponse = await request('/api/account/chat-style', {
    method: 'PUT', cookie: cookieA, body: { nameColor: '#ffffff', textColor: '#ffff00', rowColor: '#fce7f3' }
  });
  assert.equal(lightStyleResponse.status, 200, 'Beyaz ve sarı gibi açık renkler de kaydedilebilmeli.');
  const lightStyle = (await lightStyleResponse.json()).chatStyle;
  assert.equal(lightStyle.nameColor, '#ffffff');
  assert.equal(lightStyle.textColor, '#ffff00');
  assert.equal(lightStyle.rowColor, '#fce7f3');
  const restoredStyleResponse = await request('/api/account/chat-style', {
    method: 'PUT', cookie: cookieA, body: { nameColor: '#7f1d1d', textColor: '#1e3a8a', rowColor: '#dbeafe' }
  });
  assert.equal(restoredStyleResponse.status, 200, 'Açık renklerden sonra renkler yeniden değiştirilemedi.');

  const anonymousPost = await request('/api/lobby/messages', { method: 'POST', body: { message: 'Yetkisiz test' } });
  assert.equal(anonymousPost.status, 401, 'Oturumsuz kullanıcının sohbet mesajı engellenmedi.');

  const sent = await request('/api/lobby/messages', {
    method: 'POST', cookie: cookieA, body: { message: 'TWO-USER-' + suffix }
  });
  const sentData = await sent.json().catch(() => ({}));
  assert.equal(sent.status, 201, 'A kullanıcısının mesajı kaydedilemedi: ' + JSON.stringify(sentData));
  const messageId = sentData.message.id;
  assert.equal(sentData.message.chat_name_color, '#7f1d1d', 'Gönderilen mesajda isim rengi bulunmuyor.');
  assert.equal(sentData.message.chat_text_color, '#1e3a8a', 'Gönderilen mesajda yazı rengi bulunmuyor.');
  assert.equal(sentData.message.chat_row_color, '#dbeafe', 'Gönderilen mesajda satır rengi bulunmuyor.');

  const received = await request('/api/lobby/messages?after=' + (messageId - 1), { cookie: cookieB });
  assert.equal(received.status, 200, 'B kullanıcısı sohbeti okuyamadı.');
  const receivedData = await received.json();
  const receivedMessage = receivedData.messages.find(message => message.id === messageId && message.username === users[0].username && message.message === 'TWO-USER-' + suffix);
  assert.ok(receivedMessage, 'A mesajı B kullanıcısına ulaşmadı.');
  assert.equal(receivedMessage.chat_name_color, '#7f1d1d', 'B kullanıcısı A seçtiği isim rengini göremedi.');
  assert.equal(receivedMessage.chat_text_color, '#1e3a8a', 'B kullanıcısı A seçtiği mesaj rengini göremedi.');
  assert.equal(receivedMessage.chat_row_color, '#dbeafe', 'B kullanıcısı A seçtiği satır rengini göremedi.');

  const heartbeatA = await request('/api/presence/heartbeat', { method: 'POST', cookie: cookieA, body: { showOnline: true } });
  const heartbeatB = await request('/api/presence/heartbeat', { method: 'POST', cookie: cookieB, body: { showOnline: true } });
  assert.equal(heartbeatA.status, 204, 'A çevrimiçi heartbeat başarısız.');
  assert.equal(heartbeatB.status, 204, 'B çevrimiçi heartbeat başarısız.');
  const styleUpdate = await request('/api/account/chat-style', {
    method: 'PUT', cookie: cookieA, body: { nameColor: '#008000', textColor: '#663399' }
  });
  assert.equal(styleUpdate.status, 200, 'A renk değişikliğini kaydedemedi.');
  const liveStylesResponse = await request('/api/lobby/chat-styles', { cookie: cookieB });
  assert.equal(liveStylesResponse.status, 200, 'B canlı sohbet renklerini alamadı.');
  const liveStyles = (await liveStylesResponse.json()).members;
  const liveStyleA = liveStyles.find(member => member.username === users[0].username);
  assert.ok(liveStyleA, 'B çevrimiçi A kullanıcısının renk bilgisini alamadı.');
  assert.equal(liveStyleA.chat_name_color, '#008000', 'B A kullanıcısının yeni isim rengini anlık renk akışında göremedi.');
  assert.equal(liveStyleA.chat_text_color, '#663399', 'B A kullanıcısının yeni mesaj rengini anlık renk akışında göremedi.');

  let onlineResponse = await request('/api/presence/online');
  let online = await onlineResponse.json();
  assert.ok(online.members.some(member => member.username === users[0].username), 'A çevrimiçi listede görünmüyor.');
  assert.ok(online.members.some(member => member.username === users[1].username), 'B çevrimiçi listede görünmüyor.');

  const hidden = await request('/api/presence/heartbeat', { method: 'POST', cookie: cookieA, body: { showOnline: false } });
  assert.equal(hidden.status, 204, 'A çevrimiçi görünürlüğünü kapatamadı.');
  onlineResponse = await request('/api/presence/online');
  online = await onlineResponse.json();
  assert.ok(!online.members.some(member => member.username === users[0].username), 'Gizli görünürlükte A online listede kaldı.');
  assert.ok(online.members.some(member => member.username === users[1].username), 'A gizlenince B de online listesinden kayboldu.');

  const logoutA = await request('/api/auth/logout', { method: 'POST', cookie: cookieA });
  assert.equal(logoutA.status, 200, 'A çıkış yapamadı.');
  const meAfterLogout = await request('/api/auth/me', { cookie: cookieA });
  assert.equal(meAfterLogout.status, 200);
  assert.equal((await meAfterLogout.json()).authenticated, false, 'A çıkıştan sonra oturum açık kaldı.');
  const afterLogoutOnline = await request('/api/presence/online');
  const afterLogoutMembers = (await afterLogoutOnline.json()).members;
  assert.ok(!afterLogoutMembers.some(member => member.username === users[0].username), 'A çıkıştan sonra online listede kaldı.');

  const logoutB = await request('/api/auth/logout', { method: 'POST', cookie: cookieB });
  assert.equal(logoutB.status, 200, 'B çıkış yapamadı.');
  const bAfterLogout = await request('/api/auth/me', { cookie: cookieB });
  assert.equal((await bAfterLogout.json()).authenticated, false, 'B çıkıştan sonra oturum açık kaldı.');

  console.log('PASS: iki ayrı hesap kaydı ve oturum doğrulama');
  console.log('PASS: oturumsuz sohbet yazma engeli');
  console.log('PASS: hesap bazlı renk tercihleri kaydedildi ve doğrulandı');
  console.log('PASS: iki kullanıcı arasında seçilen isim ve mesaj renkleri iletildi');
  console.log('PASS: açık renkler dahil tüm geçerli HEX satır renkleri kabul edildi');
  console.log('PASS: A mesajı B tarafından alındı');
  console.log('PASS: iki kullanıcının çevrimiçi görünmesi');
  console.log('PASS: çevrimiçi görünürlüğü tercihi');
  console.log('PASS: çıkış sonrası oturum ve presence temizliği');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  child.kill('SIGTERM');
  await new Promise(resolve => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000).unref();
  });
});
