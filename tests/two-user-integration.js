const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');

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
  const gameScript = readFileSync('public/js/oyun.js', 'utf8');
  assert.doesNotMatch(gameScript, /(?<!\\$)\\$\\([^)]*\\)\\.forEach/, 'Tek eleman seçicisi forEach ile çağrılmamalı.');
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

  for (const [label, cookie, expected] of [['A', cookieA, users[0].username], ['B', cookieB, users[1].username]]) {
    for (const gamePath of ['/oyun', '/oyun/', '/oyun.html']) {
      const gameResponse = await request(gamePath, { cookie });
      assert.equal(gameResponse.status, 200, label + ' oyun sayfası açılamadı: ' + gamePath);
      assert.match(gameResponse.headers.get('cache-control') || '', /no-store/, label + ' oyun HTML yanıtı önbelleğe açık.');
      const gameHtml = await gameResponse.text();
      assert.ok(gameHtml.includes('window.__ZIRVE_AUTH_BOOTSTRAP__='), label + ' oyun sayfasında sunucu oturum başlangıcı bulunamadı: ' + gamePath);
      assert.ok(!gameHtml.includes('</script>\\\\n</head>'), label + ' oyun sayfasında görünür kaçış karakteri kaldı: ' + gamePath);
      assert.ok(gameHtml.includes('id="gameUsername">' + expected + '</b>'), label + ' üst kullanıcı adı oyun sayfasına aktarılmadı: ' + gamePath);
      assert.ok(gameHtml.includes('id="gameSeatUsername">' + expected + '</b>'), label + ' masa koltuğu kullanıcı adı oyun sayfasına aktarılmadı: ' + gamePath);
      assert.ok(gameHtml.includes('/js/game-header.js?v=header-controls-avatar-20261102'), label + ' bağımsız üst menü betiği yüklenmedi: ' + gamePath);
      assert.ok(gameHtml.includes('"authenticated":true'), label + ' oyun başlangıç verisi oturumu doğrulamadı: ' + gamePath);
    }
  }

  const anonymousPreferences = await request('/api/account/preferences');
  assert.equal(anonymousPreferences.status, 401, 'Oturumsuz kullanıcı hesap tercihlerini okuyabildi.');
  const savePreferencesA = await request('/api/account/preferences', { method: 'PUT', cookie: cookieA, body: { preferences: { settingDarkMode: false, settingPresenceStatus: 'away', settingAutoArrange: true } } });
  assert.equal(savePreferencesA.status, 200, 'A kendi ayarlarını kaydedemedi.');
  const readPreferencesA = await request('/api/account/preferences', { cookie: cookieA });
  const prefsA = (await readPreferencesA.json()).preferences;
  assert.equal(prefsA.settingDarkMode, false, 'A tema tercihi kalıcı değil.');
  assert.equal(prefsA.settingPresenceStatus, 'away', 'A durum tercihi kalıcı değil.');
  assert.equal(prefsA.settingAutoArrange, true, 'A oyun tercihi kalıcı değil.');
  const bioSave = await request('/api/account/preferences',{method:'PUT',cookie:cookieA,body:{preferences:{profileBio:'Profil açıklaması testi'}}});
  assert.equal(bioSave.status,200,'Profil açıklaması kaydedilemedi.');
  const prefsB = (await (await request('/api/account/preferences', { cookie: cookieB })).json()).preferences;
  assert.equal(prefsB.settingDarkMode, undefined, 'A kullanıcısının ayarı B hesabına sızdı.');
  const invalidPreferences = await request('/api/account/preferences', { method: 'PUT', cookie: cookieA, body: { preferences: { isAdmin: true } } });
  assert.equal(invalidPreferences.status, 400, 'İzin verilmeyen hesap tercihi kabul edildi.');
  const invalidPresenceStatus = await request('/api/account/preferences', { method: 'PUT', cookie: cookieA, body: { preferences: { settingPresenceStatus: 'offline' } } });
  assert.equal(invalidPresenceStatus.status, 400, 'Desteklenmeyen çevrim içi durumu kabul edildi.');
  const anonymousAvatar = await request('/api/account/avatar');
  assert.equal(anonymousAvatar.status, 401, 'Oturumsuz kullanıcı avatar verisini okuyabildi.');
  const avatarData = 'data:image/png;base64,iVBORw0KGgo=';
  const saveAvatarA = await request('/api/account/avatar', { method: 'PUT', cookie: cookieA, body: { avatar: avatarData } });
  assert.equal(saveAvatarA.status, 200, 'A avatarını kaydedemedi.');
  assert.equal((await saveAvatarA.json()).avatar, avatarData, 'Avatar kaydetme yanıtı farklı veri döndürdü.');
  const savedAvatarA = await request('/api/account/avatar', { cookie: cookieA });
  assert.equal((await savedAvatarA.json()).avatar, avatarData, 'Avatar oturum sonrası kalıcı değil.');
  const avatarB = await request('/api/account/avatar', { cookie: cookieB });
  assert.equal((await avatarB.json()).avatar, null, 'A kullanıcısının avatarı B hesabına sızdı.');
  const invalidAvatar = await request('/api/account/avatar', { method: 'PUT', cookie: cookieA, body: { avatar: 'https://example.com/avatar.png' } });
  assert.equal(invalidAvatar.status, 400, 'Harici veya geçersiz avatar verisi kabul edildi.');
  const removeAvatarA = await request('/api/account/avatar', { method: 'PUT', cookie: cookieA, body: { avatar: null } });
  assert.equal(removeAvatarA.status, 200, 'A varsayılan avatara dönemedi.');
  assert.equal((await (await request('/api/account/avatar', { cookie: cookieA })).json()).avatar, null, 'Avatar silme işlemi kalıcı değil.');

  const anonymousNotifications = await request('/api/notifications');
  assert.equal(anonymousNotifications.status, 401, 'Oturumsuz kullanıcı bildirimleri okuyabildi.');
  const notificationsAResponse = await request('/api/notifications', { cookie: cookieA });
  assert.equal(notificationsAResponse.status, 200, 'A bildirim merkezini açamadı.');
  const notificationsA = await notificationsAResponse.json();
  assert.equal(notificationsA.enabled, true, 'Yeni hesapta bildirimler varsayılan olarak açık olmalı.');
  assert.ok(notificationsA.notifications.some(item => item.category === 'system'), 'Kayıt karşılama sistem bildirimi oluşturulmadı.');
  assert.ok((notificationsA.unreadByCategory.system || 0) >= 1, 'Sistem bildirimi okunmamış sayacına eklenmedi.');
  assert.equal(notificationsA.preferences.settingNotifySystem, undefined, 'Varsayılan sistem tercihi gereksiz yere false olarak saklandı.');
  const notificationId = notificationsA.notifications.find(item => item.category === 'system').id;

  const saveNotificationCategories = await request('/api/account/preferences', {
    method: 'PUT', cookie: cookieA,
    body: { preferences: { settingFriendRequests: false, settingNotifyPlayers: false, settingNotifyGame: true, settingNotifySystem: false, settingNotifyManagement: false, settingNotifyRewards: true } }
  });
  assert.equal(saveNotificationCategories.status, 200, 'A bildirim kategori tercihlerini kaydedemedi.');
  const storedNotificationCategories = (await (await request('/api/account/preferences', { cookie: cookieA })).json()).preferences;
  assert.equal(storedNotificationCategories.settingFriendRequests, false, 'Arkadaşlık bildirimi tercihi kalıcı değil.');
  assert.equal(storedNotificationCategories.settingNotifyPlayers, false, 'Oyuncu bildirimi tercihi kalıcı değil.');
  assert.equal(storedNotificationCategories.settingNotifyGame, true, 'Oyun bildirimi tercihi kalıcı değil.');
  assert.equal(storedNotificationCategories.settingNotifySystem, false, 'Sistem bildirimi tercihi kalıcı değil.');
  assert.equal(storedNotificationCategories.settingNotifyManagement, false, 'Yönetim bildirimi tercihi kalıcı değil.');
  assert.equal(storedNotificationCategories.settingNotifyRewards, true, 'Ödül bildirimi tercihi kalıcı değil.');
  const notificationsAfterCategorySave = await (await request('/api/notifications', { cookie: cookieA })).json();
  assert.equal(notificationsAfterCategorySave.preferences.settingNotifySystem, false, 'Bildirim API kategori tercihlerini güncel döndürmüyor.');
  assert.ok(notificationsAfterCategorySave.notifications.some(item => item.id === notificationId), 'Kategori tercihi geçmiş bildirimi silmemeli.');

  const toggleNotificationsOff = await request('/api/notifications/preferences', {
    method: 'PUT', cookie: cookieA, body: { enabled: false }
  });
  assert.equal(toggleNotificationsOff.status, 200, 'Genel bildirim anahtarı kapatılamadı.');
  assert.equal((await toggleNotificationsOff.json()).enabled, false, 'Genel bildirim anahtarı kapalı dönmedi.');
  const notificationsOffState = await (await request('/api/notifications', { cookie: cookieA })).json();
  assert.equal(notificationsOffState.enabled, false, 'Genel bildirim durumu API üzerinde kalıcı değil.');
  assert.equal(notificationsOffState.preferences.settingNotifications, false, 'Genel bildirim tercihi ayarlarla eşitlenmedi.');
  const toggleNotificationsOn = await request('/api/notifications/preferences', {
    method: 'PUT', cookie: cookieA, body: { enabled: true }
  });
  assert.equal(toggleNotificationsOn.status, 200, 'Genel bildirim anahtarı açılamadı.');
  const notificationsOnState = await (await request('/api/notifications', { cookie: cookieA })).json();
  assert.equal(notificationsOnState.enabled, true, 'Genel bildirim anahtarı tekrar açılmadı.');

  const markNotification = await request('/api/notifications/' + notificationId + '/read', { method: 'POST', cookie: cookieA });
  assert.equal(markNotification.status, 200, 'Tek bildirim okundu yapılamadı.');
  const readNotification = (await (await request('/api/notifications', { cookie: cookieA })).json()).notifications.find(item => item.id === notificationId);
  assert.ok(readNotification?.read_at, 'Okundu bilgisi veritabanına kaydedilmedi.');
  const markAllNotifications = await request('/api/notifications/read-all', { method: 'POST', cookie: cookieA });
  assert.equal(markAllNotifications.status, 200, 'Tüm bildirimler okundu yapılamadı.');
  const deleteNotification = await request('/api/notifications/' + notificationId, { method: 'DELETE', cookie: cookieA });
  assert.equal(deleteNotification.status, 200, 'Tek bildirim silinemedi.');
  const remainingNotifications = await (await request('/api/notifications', { cookie: cookieA })).json();
  assert.ok(!remainingNotifications.notifications.some(item => item.id === notificationId), 'Silinen bildirim listede kaldı.');
  const notificationsB = await (await request('/api/notifications', { cookie: cookieB })).json();
  assert.ok(notificationsB.notifications.some(item => item.category === 'system'), 'A kullanıcısının bildirim işlemi B hesabını etkiledi.');

  const notificationBId = notificationsB.notifications.find(item => item.category === 'system').id;
  const crossUserRead = await request('/api/notifications/' + notificationBId + '/read', { method: 'POST', cookie: cookieA });
  assert.equal(crossUserRead.status, 404, 'A kullanıcısı B kullanıcısının bildirimini okundu yapabildi.');
  const crossUserDelete = await request('/api/notifications/' + notificationBId, { method: 'DELETE', cookie: cookieA });
  assert.equal(crossUserDelete.status, 404, 'A kullanıcısı B kullanıcısının bildirimini silebildi.');
  const malformedNotificationId = await request('/api/notifications/' + notificationBId + 'abc', { method: 'DELETE', cookie: cookieA });
  assert.equal(malformedNotificationId.status, 400, 'Geçersiz bildirim kimliği kabul edildi.');
  const notificationsBAfterIsolation = await (await request('/api/notifications', { cookie: cookieB })).json();
  assert.ok(notificationsBAfterIsolation.notifications.some(item => item.id === notificationBId && !item.read_at), 'Yetkisiz işlem B kullanıcısının bildirimini değiştirdi.');


  const userC = { username: 'TestC_' + suffix, email: 'testc-' + suffix + '@example.invalid', password: 'ZirveTest!2026C', country: 'Türkiye', gender: 'Belirtmek istemiyorum' };
  const registerC = await request('/api/auth/register', { method: 'POST', body: userC });
  assert.equal(registerC.status, 201, 'Üçüncü bildirim test hesabı oluşturulamadı: ' + await registerC.text());
  let cookieC = cookieFrom(registerC);
  const initialCNotifications = await (await request('/api/notifications', { cookie: cookieC })).json();
  assert.equal(initialCNotifications.notifications.filter(item => item.category === 'system').length, 1, 'C hesabında yalnızca kayıt bildirimi bekleniyordu.');
  const disableSystemC = await request('/api/account/preferences', {
    method: 'PUT', cookie: cookieC, body: { preferences: { settingNotifySystem: false } }
  });
  assert.equal(disableSystemC.status, 200, 'C sistem bildirimi kategorisini kapatamadı.');
  const logoutC = await request('/api/auth/logout', { method: 'POST', cookie: cookieC });
  assert.equal(logoutC.status, 200, 'C test oturumu kapatılamadı.');
  const loginC = await request('/api/auth/login', { method: 'POST', body: { username: userC.username, password: userC.password } });
  assert.equal(loginC.status, 200, 'C yeniden giriş yapamadı.');
  cookieC = cookieFrom(loginC);
  const afterDisabledSystemLogin = await (await request('/api/notifications', { cookie: cookieC })).json();
  assert.equal(afterDisabledSystemLogin.notifications.filter(item => item.category === 'system').length, 1, 'Sistem kategorisi kapalıyken yeni giriş bildirimi üretildi.');
  const disableAllC = await request('/api/notifications/preferences', { method: 'PUT', cookie: cookieC, body: { enabled: false } });
  assert.equal(disableAllC.status, 200, 'C genel bildirimleri kapatamadı.');
  const logoutCAgain = await request('/api/auth/logout', { method: 'POST', cookie: cookieC });
  assert.equal(logoutCAgain.status, 200, 'C ikinci test oturumu kapatılamadı.');
  const loginCAgain = await request('/api/auth/login', { method: 'POST', body: { username: userC.username, password: userC.password } });
  assert.equal(loginCAgain.status, 200, 'C genel bildirimler kapalıyken yeniden giriş yapamadı.');
  cookieC = cookieFrom(loginCAgain);
  const afterGlobalOffLogin = await (await request('/api/notifications', { cookie: cookieC })).json();
  assert.equal(afterGlobalOffLogin.notifications.filter(item => item.category === 'system').length, 1, 'Genel bildirimler kapalıyken yeni sistem bildirimi üretildi.');

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

  const heartbeatAWhileAway = await request('/api/presence/heartbeat', { method: 'POST', cookie: cookieA, body: {} });
  assert.equal(heartbeatAWhileAway.status, 204, 'A durum seçiliyken heartbeat gönderemedi.');
  const visibleWhileAway = await (await request('/api/presence/online')).json();
  const awayMember = visibleWhileAway.members.find(member => member.username === users[0].username);
  assert.ok(awayMember, 'A Dışarda durumundayken çevrim içi listeden kayboldu.');
  assert.equal(awayMember.status, 'away', 'A durum etiketi listede gösterilmedi.');
  const updatePresenceStatus = await request('/api/account/preferences', { method: 'PUT', cookie: cookieA, body: { preferences: { settingPresenceStatus: 'sleeping' } } });
  assert.equal(updatePresenceStatus.status, 200, 'A durumunu Uyuyorum olarak güncelleyemedi.');
  await request('/api/presence/heartbeat', { method: 'POST', cookie: cookieA, body: {} });
  const sleepingMembers = (await (await request('/api/presence/online')).json()).members;
  assert.equal(sleepingMembers.find(member => member.username === users[0].username)?.status, 'sleeping', 'Uyuyorum durumu listede görünmedi.');
  const heartbeatA = await request('/api/presence/heartbeat', { method: 'POST', cookie: cookieA, body: { showOnline: true } });
  const heartbeatB = await request('/api/presence/heartbeat', { method: 'POST', cookie: cookieB, body: { showOnline: true } });
  assert.equal(heartbeatA.status, 204, 'A çevrimiçi heartbeat başarısız.');
  assert.equal(heartbeatB.status, 204, 'B çevrimiçi heartbeat başarısız.');
  const styleUpdate = await request('/api/account/chat-style', {
    method: 'PUT', cookie: cookieA, body: { nameColor: '#008000', textColor: '#663399' }
  });
  assert.equal(styleUpdate.status, 200, 'A renk değişikliğini kaydedemedi.');
  const liveStylesResponse = await request('/api/lobby/chat-styles', { cookie: cookieB });
  assert.equal(liveStylesResponse.headers.get('cache-control'), 'no-store', 'Canlı sohbet stil listesi önbelleğe açık.');
  assert.equal(liveStylesResponse.status, 200, 'B canlı sohbet renklerini alamadı.');
  const liveStyles = (await liveStylesResponse.json()).members;
  const liveStyleA = liveStyles.find(member => member.username === users[0].username);
  assert.ok(liveStyleA, 'B çevrimiçi A kullanıcısının renk bilgisini alamadı.');
  assert.equal(liveStyleA.chat_name_color, '#008000', 'B A kullanıcısının yeni isim rengini anlık renk akışında göremedi.');
  assert.equal(liveStyleA.chat_text_color, '#663399', 'B A kullanıcısının yeni mesaj rengini anlık renk akışında göremedi.');
  assert.equal(liveStyleA.chat_row_color, '#dbeafe', 'B A kullanıcısının sohbet satırı arka plan rengini anlık renk akışında göremedi.');
  const alwaysVisibleChatStyles = await (await request('/api/lobby/chat-styles', { cookie: cookieA })).json();
  assert.ok(alwaysVisibleChatStyles.members.some(member => member.username === users[1].username), 'B kullanıcısının adı durum seçimi nedeniyle listeden kayboldu.');

  let onlineResponse = await request('/api/presence/online');
  assert.equal(onlineResponse.headers.get('cache-control'), 'no-store', 'Çevrimiçi üye listesi yanıtı önbelleğe açık.');
  let online = await onlineResponse.json();
  assert.ok(online.members.some(member => member.username === users[0].username), 'A çevrimiçi listede görünmüyor.');
  assert.ok(online.members.some(member => member.username === users[1].username), 'B çevrimiçi listede görünmüyor.');

  const setBusyStatus = await request('/api/account/preferences', { method: 'PUT', cookie: cookieB, body: { preferences: { settingPresenceStatus: 'busy' } } });
   assert.equal(setBusyStatus.status, 200, 'B meşgul durumunu kaydedemedi.');
   await request('/api/presence/heartbeat', { method: 'POST', cookie: cookieB, body: {} });
   onlineResponse = await request('/api/presence/online'); online = await onlineResponse.json();
   const busyMember = online.members.find(member => member.username === users[1].username);
   assert.ok(busyMember, 'Meşgul durumundaki B listeden kayboldu.');
   assert.equal(busyMember.status, 'busy', 'Meşgul etiketi listede gösterilmedi.');

  const profileAId = (await (await request('/api/auth/me',{cookie:cookieA})).json()).user.id;
  const profileA = await request('/api/members/' + profileAId + '/profile', { cookie: cookieA });
  assert.equal(profileA.status, 200, 'A kendi profilini açamadı.');
  const profileBId = (await (await request('/api/auth/me',{cookie:cookieB})).json()).user.id;
  const profileB = await request('/api/members/' + profileBId + '/profile', { cookie: cookieA });
  assert.equal(profileB.status, 200, 'A, B profilini görüntüleyemedi.');
  const friendRequest = await request('/api/social/friends/' + profileBId, { method:'POST', cookie:cookieA, body:{} });
  assert.equal(friendRequest.status, 201, 'A arkadaşlık isteği gönderemedi: ' + await friendRequest.text());
  const incoming = await (await request('/api/social/summary',{cookie:cookieB})).json();
  assert.ok(incoming.incoming.some(item=>item.username===users[0].username), 'B gelen arkadaşlık isteğini göremedi.');
  const acceptFriend = await request('/api/social/friends/' + (await (await request('/api/auth/me',{cookie:cookieA})).json()).user.id, { method:'PUT', cookie:cookieB, body:{status:'accepted'} });
  assert.equal(acceptFriend.status, 200, 'B arkadaşlık isteğini kabul edemedi.');
  const friendsA = await (await request('/api/social/summary',{cookie:cookieA})).json();
  assert.ok(friendsA.friends.some(item=>item.username===users[1].username), 'A arkadaş listesinde B görünmüyor.');
  const addFavorite = await request('/api/social/favorites/' + profileBId, { method:'POST', cookie:cookieA, body:{} });
  assert.equal(addFavorite.status, 200, 'A B kullanıcısını favoriye ekleyemedi.');
  const profileBFromA = await (await request('/api/members/' + profileBId + '/profile',{cookie:cookieA})).json();
  assert.equal(profileBFromA.profile.is_favorite,true,'Favori ilişkisi profil API yanıtında görünmüyor.');
  await request('/api/account/preferences',{method:'PUT',cookie:cookieB,body:{preferences:{settingPrivateMessages:false}}});
  const privateDenied = await request('/api/private-messages/'+profileBId,{method:'POST',cookie:cookieA,body:{message:'Gizlilik testi'}});
  assert.equal(privateDenied.status,403,'Özel mesaj tercihi kapalıyken mesaj kabul edildi.');
  await request('/api/account/preferences',{method:'PUT',cookie:cookieB,body:{preferences:{settingPrivateMessages:true}}});
  const sendPrivate = await request('/api/private-messages/' + profileBId, { method:'POST', cookie:cookieA, body:{message:'Özel mesaj entegrasyon testi '+suffix} });
  assert.equal(sendPrivate.status,201,'Özel mesaj gönderilemedi: '+await sendPrivate.text());
  const readPrivate = await request('/api/private-messages/' + (await (await request('/api/auth/me',{cookie:cookieA})).json()).user.id,{cookie:cookieB});
  assert.equal(readPrivate.status,200,'B özel mesajı okuyamadı.');
  assert.ok((await readPrivate.json()).messages.some(item=>item.message==='Özel mesaj entegrasyon testi '+suffix),'A özel mesajı B gelen kutusuna ulaşmadı.');
  const report = await request('/api/social/reports/' + profileBId,{method:'POST',cookie:cookieA,body:{reason:'Diğer',details:'Bu bir otomatik entegrasyon test şikâyetidir.'}});
  assert.equal(report.status,201,'Üye şikâyeti kaydedilemedi: '+await report.text());
  const block = await request('/api/social/blocks/' + profileBId,{method:'POST',cookie:cookieA,body:{}});
  assert.equal(block.status,200,'A B kullanıcısını engelleyemedi.');
  const blockedMessage = await request('/api/private-messages/' + profileBId,{method:'POST',cookie:cookieA,body:{message:'Engel kontrolü'}});
  assert.equal(blockedMessage.status,403,'Engellenen üyeye özel mesaj gönderilebildi.');
  const blockedProfile = await request('/api/members/' + profileAId + '/profile',{cookie:cookieB});
  assert.equal(blockedProfile.status,403,'Engelleyen üyenin profili engellenen kullanıcıya açık kaldı.');
  const unblock = await request('/api/social/blocks/' + profileBId,{method:'DELETE',cookie:cookieA});
  assert.equal(unblock.status,200,'A engeli kaldıramadı.');
  const removeFavorite = await request('/api/social/favorites/' + profileBId,{method:'DELETE',cookie:cookieA});
  assert.equal(removeFavorite.status,200,'A favoriden çıkaramadı.');
  const removeFriend = await request('/api/social/friends/' + profileBId,{method:'DELETE',cookie:cookieA});
  assert.equal(removeFriend.status,200,'A arkadaşlıktan çıkaramadı.');

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

  console.log('PASS: üye profili, arkadaşlık, favoriler, özel mesaj, engelleme ve şikâyet işlemleri');
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
