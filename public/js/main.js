const $=s=>document.querySelector(s);
const toggle=$('#mobileToggle'),nav=$('#mainNav');

function closeNav(){
  nav.classList.remove('open');
  toggle.setAttribute('aria-expanded','false');
  toggle.setAttribute('aria-label','Menüyü aç');
}
toggle?.addEventListener('click',()=>{
  const open=nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'Menüyü kapat':'Menüyü aç');
});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeNav));
document.addEventListener('click',e=>{
  if(nav.classList.contains('open')&&!nav.contains(e.target)&&!toggle.contains(e.target))closeNav();
});

const backdrop=$('#backdrop'),email=$('#email'),authForm=$('#authForm');
const username=$('#username'),password=$('#password'),loginOptions=$('#loginOptions');
let lastTrigger=null,authMode='login';
let notificationSessionVersion=0;
const authButtons=[...document.querySelectorAll('[data-modal="login"],[data-modal="register"]')];
async function refreshAuthState(){
  try{
    const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw new Error('Oturum durumu alınamadı.');
    const data=await response.json();
    const signedIn=data.authenticated===true;
    const nextUserId=signedIn?String(data.user?.id||''):null;
    const identityChanged=homeSignedIn!==signedIn||homeUserId!==nextUserId;
    if(identityChanged){
      notificationSessionVersion++;
      notificationState=null;
      homePreferencesLoaded=false;
      if(homePreferencesRetryTimer){clearTimeout(homePreferencesRetryTimer);homePreferencesRetryTimer=null;}
      homePreferencesRetryDelay=5000;
    }
    homeSignedIn=signedIn;
    homeUserId=nextUserId;
    if(signedIn){
      const requestVersion=notificationSessionVersion;
      homePreferencesLoaded=await loadHomeAccountPreferences(nextUserId,requestVersion);
      if(requestVersion!==notificationSessionVersion||homeUserId!==nextUserId)return;
      if(homePreferencesLoaded){applyMemberAppearance();sendHomePresenceHeartbeat();sendActivityHeartbeat();}
      else scheduleHomePreferencesRetry(nextUserId,requestVersion);
    }else{homePreferencesLoaded=false;document.body.classList.remove('soft-light');}
    authButtons.forEach(button=>button.hidden=signedIn);
    const notificationToggle=document.getElementById('notificationToggle');if(notificationToggle)notificationToggle.hidden=!signedIn;
    if(signedIn)loadNotifications();else closeNotificationPanel();
    ['logoutButton','mobileLogoutButton'].forEach(id=>{const button=document.getElementById(id);if(button)button.hidden=!signedIn;});
    ['accountPageLink','mobileAccountPageLink'].forEach(id=>{const link=document.getElementById(id);if(link)link.hidden=!signedIn;});
    ['accountGreeting','mobileAccountGreeting'].forEach(id=>{const el=document.getElementById(id);if(el){el.hidden=!signedIn;el.textContent=signedIn?'Merhaba, '+data.user.username:'';}});
  }catch(error){console.warn('Oturum durumu kontrol edilemedi:',error.message);}
}
let notificationState=null,notificationBusy=false;
const notificationPanel=document.getElementById('notificationPanel');
const notificationToggle=document.getElementById('notificationToggle');
function closeNotificationPanel(){
  if(!notificationPanel||!notificationToggle)return;
  notificationPanel.hidden=true;
  notificationToggle.setAttribute('aria-expanded','false');
}
function notificationDate(value){
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short'}).format(date);
}
function renderNotifications(){
  if(!notificationState)return;
  const items=document.getElementById('notificationItems');
  const unread=Object.values(notificationState.unreadByCategory||{}).reduce((sum,count)=>sum+Number(count||0),0);
  const badge=document.getElementById('notificationBadge');
  badge.hidden=unread===0;badge.textContent=unread>99?'99+':String(unread);
  document.getElementById('notificationSummary').textContent=unread?unread+' okunmamış bildirim':'Okunmamış bildirimin yok.';
  document.getElementById('notificationsEnabled').checked=notificationState.enabled===true;
  document.querySelectorAll('[data-notification-category]').forEach(input=>{
    const key=input.dataset.notificationCategory;
    input.checked=notificationState.preferences?.[key]!==false;
    input.disabled=!notificationState.enabled;
  });
  items.replaceChildren();
  if(!notificationState.notifications?.length){
    const empty=document.createElement('p');empty.className='notification-empty';empty.textContent='Henüz bildirimin yok.';items.append(empty);return;
  }
  notificationState.notifications.forEach(item=>{
    const article=document.createElement('article');article.className='notification-item'+(item.read_at?'':' is-unread');
    const copy=document.createElement('div');copy.className='notification-copy';
    const title=document.createElement('strong');title.textContent=item.title||'Bildirim';
    const message=document.createElement('p');message.textContent=item.message||'';
    const meta=document.createElement('small');meta.textContent=notificationDate(item.created_at);
    copy.append(title,message,meta);
    if(item.action_url){
      try{const action=new URL(item.action_url,window.location.origin);if(action.origin===window.location.origin){const link=document.createElement('a');link.href=action.href;link.textContent='Görüntüle';copy.append(link);}}
      catch{}
    }
    const actions=document.createElement('div');actions.className='notification-item-actions';
    if(!item.read_at){const read=document.createElement('button');read.type='button';read.textContent='Okundu';read.addEventListener('click',()=>mutateNotification('/api/notifications/'+encodeURIComponent(item.id)+'/read','POST'));actions.append(read);}
    const remove=document.createElement('button');remove.type='button';remove.textContent='Sil';remove.addEventListener('click',()=>mutateNotification('/api/notifications/'+encodeURIComponent(item.id),'DELETE'));actions.append(remove);
    article.append(copy,actions);items.append(article);
  });
}
async function loadNotifications(){
  if(!homeSignedIn||notificationBusy)return;
  const requestVersion=notificationSessionVersion;
  notificationBusy=true;
  try{
    const response=await fetch('/api/notifications',{credentials:'same-origin',cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(requestVersion!==notificationSessionVersion||!homeSignedIn)return;
    if(!response.ok)throw new Error(data.error||'Bildirimler alınamadı.');
    notificationState=data;renderNotifications();
  }catch(error){
    if(requestVersion!==notificationSessionVersion||!homeSignedIn)return;
    const items=document.getElementById('notificationItems');
    if(items){const message=document.createElement('p');message.className='notification-empty';message.textContent=error.message;items.replaceChildren(message);}
  }finally{
    notificationBusy=false;
    if(homeSignedIn&&requestVersion!==notificationSessionVersion)loadNotifications();
  }
}
async function mutateNotification(url,method){
  const requestVersion=notificationSessionVersion;
  const requestUserId=homeUserId;
  try{
    const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(requestVersion!==notificationSessionVersion||requestUserId!==homeUserId||!homeSignedIn)return;
    if(!response.ok)throw new Error(data.error||'Bildirim işlemi tamamlanamadı.');
    await loadNotifications();
  }catch(error){
    if(requestVersion===notificationSessionVersion&&requestUserId===homeUserId)alert(error.message);
  }
}
let notificationPreferenceQueue=Promise.resolve();
function saveNotificationCategories(changes){
  const requestVersion=notificationSessionVersion;
  const requestUserId=homeUserId;
  notificationPreferenceQueue=notificationPreferenceQueue.catch(()=>{}).then(async()=>{
    if(requestVersion!==notificationSessionVersion||requestUserId!==homeUserId||!homeSignedIn)return;
    const status=document.getElementById('notificationSettingsStatus');
    try{
      const response=await fetch('/api/account/preferences',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences:changes})});
      const data=await response.json().catch(()=>({}));
      if(requestVersion!==notificationSessionVersion||requestUserId!==homeUserId||!homeSignedIn)return;
      if(!response.ok)throw new Error(data.error||'Bildirim ayarı kaydedilemedi.');
      notificationState.preferences={...(notificationState?.preferences||{}),...(data.preferences||{}),...changes};
      try{const saved=JSON.parse(localStorage.getItem('zirveMemberSettings')||'{}');localStorage.setItem('zirveMemberSettings',JSON.stringify({...saved,...changes}));}catch{}
      status.textContent='Bildirim kategorileri kaydedildi.';
      renderNotifications();
    }catch(error){
      if(requestVersion!==notificationSessionVersion||requestUserId!==homeUserId)return;
      status.textContent=error.message;
      await loadNotifications();
    }
  });
  return notificationPreferenceQueue;
}
notificationToggle?.addEventListener('click',async()=>{
  const open=notificationPanel.hidden;
  notificationPanel.hidden=!open;
  notificationToggle.setAttribute('aria-expanded',String(open));
  if(open)await loadNotifications();
});
document.getElementById('notificationClose')?.addEventListener('click',closeNotificationPanel);
document.getElementById('notificationsEnabled')?.addEventListener('change',async event=>{
  const checkbox=event.currentTarget;
  const requestVersion=notificationSessionVersion;
  const requestUserId=homeUserId;
  const requestedValue=checkbox.checked;
  checkbox.disabled=true;
  try{
    const response=await fetch('/api/notifications/preferences',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:requestedValue})});
    const data=await response.json().catch(()=>({}));
    if(requestVersion!==notificationSessionVersion||requestUserId!==homeUserId||!homeSignedIn)return;
    if(!response.ok)throw new Error(data.error||'Bildirim tercihi kaydedilemedi.');
    notificationState.enabled=data.enabled===true;
    notificationState.preferences={...(notificationState.preferences||{}),settingNotifications:notificationState.enabled};
    try{const saved=JSON.parse(localStorage.getItem('zirveMemberSettings')||'{}');localStorage.setItem('zirveMemberSettings',JSON.stringify({...saved,settingNotifications:notificationState.enabled}));}catch{}
    renderNotifications();
  }catch(error){
    if(requestVersion===notificationSessionVersion&&requestUserId===homeUserId){
      alert(error.message);
      checkbox.checked=notificationState?.enabled===true;
    }
  }finally{
    if(requestVersion===notificationSessionVersion&&requestUserId===homeUserId)checkbox.disabled=false;
  }
});
document.querySelectorAll('[data-notification-category]').forEach(input=>input.addEventListener('change',()=>{
  const changes={[input.dataset.notificationCategory]:input.checked};
  saveNotificationCategories(changes);
}));
document.getElementById('markAllNotificationsRead')?.addEventListener('click',()=>mutateNotification('/api/notifications/read-all','POST'));
document.addEventListener('click',event=>{
  if(notificationPanel&&!notificationPanel.hidden&&!notificationPanel.contains(event.target)&&!notificationToggle?.contains(event.target))closeNotificationPanel();
});
async function loadNewMembers(){
  const target=document.getElementById('newMembersList');
  if(!target)return;
  try{
    const response=await fetch('/api/public/new-members',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw new Error('Üye listesi alınamadı.');
    const data=await response.json();
    if(!Array.isArray(data.members)||!data.members.length){
      target.innerHTML='<strong>Henüz üye bulunmuyor</strong><small>İlk üyeler burada görünecek.</small>';
      return;
    }
    target.innerHTML='<ul class="member-list-items">'+data.members.map(member=>'<li><span class="member-avatar">'+escapeHtml(String(member.username||'?').slice(0,1).toLocaleUpperCase('tr-TR'))+'</span><span class="member-name">'+escapeHtml(member.username||'Üye')+'</span></li>').join('')+'</ul>';
  }catch(error){
    target.innerHTML='<strong>Üye listesi şu anda yüklenemiyor</strong><small>Daha sonra tekrar deneyin.</small>';
  }
}
function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
loadNewMembers();

async function loadActiveMembers(){
  const target=document.getElementById('activeMembersList');
  if(!target)return;
  try{
    const response=await fetch('/api/public/active-members',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw new Error('Aktiflik listesi alınamadı.');
    const data=await response.json();
    if(!Array.isArray(data.members)||!data.members.length){
      target.innerHTML='<strong>Henüz aktivite verisi yok</strong><small>Üyeler sitede vakit geçirdikçe liste oluşacak.</small>';
      return;
    }
    target.innerHTML='<ul class="member-list-items">'+data.members.map(member=>'<li><span class="member-avatar">'+escapeHtml(String(member.username||'?').slice(0,1).toLocaleUpperCase('tr-TR'))+'</span><span class="member-name">'+escapeHtml(member.username||'Üye')+'</span><span class="member-time">'+Math.floor(Number(member.active_seconds||0)/60)+' dk</span></li>').join('')+'</ul>';
  }catch(error){
    target.innerHTML='<strong>Aktiflik listesi şu anda yüklenemiyor</strong><small>Daha sonra tekrar deneyin.</small>';
  }
}
let activityHeartbeatBusy=false;
let homeSignedIn=false,homePreferencesLoaded=false,homeUserId=null;
let homePreferencesRetryTimer=null,homePreferencesRetryDelay=5000;
function applyMemberAppearance(){
  try{const settings=JSON.parse(localStorage.getItem('zirveMemberSettings')||'{}');document.body.classList.toggle('soft-light',settings.settingDarkMode===false);}
  catch{document.body.classList.remove('soft-light');}
}
function readHomeShowOnlinePreference(){
  try{
    const settings=JSON.parse(localStorage.getItem('zirveMemberSettings')||'{}');
    return settings.settingShowOnline!==false;
  }catch{return true;}
}
async function loadHomeAccountPreferences(expectedUserId,expectedVersion){
  try{
    const response=await fetch('/api/account/preferences',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw new Error('Hesap tercihleri alınamadı.');
    const data=await response.json();
    if(expectedVersion!==notificationSessionVersion||homeUserId!==expectedUserId||!homeSignedIn)return false;
    const current=JSON.parse(localStorage.getItem('zirveMemberSettings')||'{}');
    localStorage.setItem('zirveMemberSettings',JSON.stringify({...current,...(data.preferences||{})}));
    return true;
  }catch(error){
    console.warn('Hesap gizlilik tercihleri yüklenemedi:',error.message);
    return false;
  }
}
function scheduleHomePreferencesRetry(userId,sessionVersion){
  if(homePreferencesRetryTimer||!homeSignedIn||homeUserId!==userId||notificationSessionVersion!==sessionVersion)return;
  const delay=homePreferencesRetryDelay;
  homePreferencesRetryDelay=Math.min(homePreferencesRetryDelay*2,60000);
  homePreferencesRetryTimer=window.setTimeout(async()=>{
    homePreferencesRetryTimer=null;
    if(!homeSignedIn||homeUserId!==userId||notificationSessionVersion!==sessionVersion)return;
    homePreferencesLoaded=await loadHomeAccountPreferences(userId,sessionVersion);
    if(!homeSignedIn||homeUserId!==userId||notificationSessionVersion!==sessionVersion)return;
    if(homePreferencesLoaded){
      homePreferencesRetryDelay=5000;
      applyMemberAppearance();
      sendHomePresenceHeartbeat();
      sendActivityHeartbeat();
    }else scheduleHomePreferencesRetry(userId,sessionVersion);
  },delay);
}
async function sendHomePresenceHeartbeat(){
  if(!homeSignedIn||!homePreferencesLoaded||document.visibilityState!=='visible')return;
  try{
    const response=await fetch('/api/presence/heartbeat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({showOnline:readHomeShowOnlinePreference()})});
    if(!response.ok)throw new Error('HTTP '+response.status);
  }catch(error){console.warn('Çevrimiçi durumu güncellenemedi:',error.message);}
}
async function sendActivityHeartbeat(){
  if(!homeSignedIn||activityHeartbeatBusy||document.visibilityState!=='visible')return;
  activityHeartbeatBusy=true;
  try{
    const response=await fetch('/api/activity/heartbeat',{method:'POST',credentials:'same-origin'});
    if(!response.ok)throw new Error('HTTP '+response.status);
  }catch(error){console.warn('Aktivite kaydı gönderilemedi:',error.message);}
  finally{activityHeartbeatBusy=false;}
}
function startActivityTracking(){
  if(!document.getElementById('activeMembersList'))return;
  sendActivityHeartbeat();
  sendHomePresenceHeartbeat();
  window.setInterval(()=>{sendActivityHeartbeat();sendHomePresenceHeartbeat();loadActiveMembers();if(homeSignedIn&&document.visibilityState==='visible')loadNotifications();},60000);
}
loadActiveMembers();
startActivityTracking();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){sendActivityHeartbeat();sendHomePresenceHeartbeat();if(homeSignedIn)loadNotifications();}});

async function logout(){
  const buttons=[document.getElementById('logoutButton'),document.getElementById('mobileLogoutButton')].filter(Boolean);
  buttons.forEach(button=>button.disabled=true);
  // Invalidate in-flight notification responses as soon as logout starts.
  notificationSessionVersion++;
  homeSignedIn=false;
  notificationState=null;
  closeNotificationPanel();
  try{
    const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Çıkış yapılamadı.');
    await refreshAuthState();
    $('#playStatus').textContent='Hesabından güvenli şekilde çıkış yaptın.';
    closeNav();
  }catch(error){
    await refreshAuthState();
    alert(error.message);
  }finally{buttons.forEach(button=>button.disabled=false);}
}
document.getElementById('logoutButton')?.addEventListener('click',logout);
document.getElementById('mobileLogoutButton')?.addEventListener('click',logout);
refreshAuthState();

document.querySelectorAll('[data-modal]').forEach(button=>button.addEventListener('click',()=>{
  lastTrigger=button;
  authMode=button.dataset.modal==='register'?'register':'login';
  $('#modalTitle').textContent=authMode==='register'?'Üye Ol':'Giriş Yap';
  $('#modalDesc').textContent=authMode==='register'?'ZirveOkey ailesine katıl.':'Hesabına giriş yap ve oyuna katıl.';
  $('#authSubmit').textContent=authMode==='register'?'Üye Ol':'Giriş Yap';
  email.hidden=authMode!=='register';email.required=authMode==='register';email.value='';
  $('#registerProfileFields').hidden=authMode!=='register';$('#registerCountry').required=authMode==='register';$('#registerGender').required=authMode==='register';
  $('#authModeSwitch').hidden=authMode==='forgot'||authMode==='reset';$('#authModeSwitch').textContent=authMode==='register'?'Hesabınız varsa Giriş yap':'Hesabınız yoksa Üye Ol';
  username.hidden=false;username.required=true;username.value='';
  password.hidden=false;password.required=true;password.value='';
  loginOptions.hidden=authMode!=='login';
  password.setAttribute('autocomplete',authMode==='register'?'new-password':'current-password');
  authForm.reset();
  $('#modalNote').textContent='Hesabın sunucu üzerinden güvenli şekilde doğrulanır.';
  backdrop.hidden=false;
  backdrop.querySelector('input:not([hidden])')?.focus();
}));
$('#authModeSwitch').addEventListener('click',()=>{
  authMode=authMode==='register'?'login':'register';
  $('#modalTitle').textContent=authMode==='register'?'Üye Ol':'Giriş Yap';$('#modalDesc').textContent=authMode==='register'?'ZirveOkey ailesine katıl.':'Hesabına giriş yap ve oyuna katıl.';
  $('#authSubmit').textContent=authMode==='register'?'Üye Ol':'Giriş Yap';email.hidden=authMode!=='register';email.required=authMode==='register';username.hidden=false;username.required=true;password.hidden=false;password.required=true;
  $('#registerProfileFields').hidden=authMode!=='register';$('#registerCountry').required=authMode==='register';$('#registerGender').required=authMode==='register';loginOptions.hidden=authMode!=='login';
  password.setAttribute('autocomplete',authMode==='register'?'new-password':'current-password');$('#authModeSwitch').textContent=authMode==='register'?'Hesabınız varsa Giriş yap':'Hesabınız yoksa Üye Ol';$('#modalNote').textContent='';
});
$('#forgotPassword').addEventListener('click',()=>{
  authMode='forgot';
  $('#modalTitle').textContent='Şifremi Unuttum';
  $('#modalDesc').textContent='Şifre sıfırlama bağlantısı için kayıtlı e-posta adresini gir.';
  email.hidden=false;email.required=true;email.value='';
  username.hidden=true;username.required=false;
  password.hidden=true;password.required=false;
  loginOptions.hidden=true;$('#registerProfileFields').hidden=true;$('#registerCountry').required=false;$('#registerGender').required=false;$('#authModeSwitch').hidden=true;
  $('#authSubmit').textContent='Sıfırlama Bağlantısı Gönder';
  $('#modalNote').textContent='Adres kayıtlıysa şifre sıfırlama bağlantısı gönderilir.';
  email.focus();
});
function closeModal(){
  backdrop.hidden=true;
  lastTrigger?.focus();
}
$('#modalClose').addEventListener('click',closeModal);
backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeModal();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(!backdrop.hidden)closeModal();else if(notificationPanel&&!notificationPanel.hidden)closeNotificationPanel();else closeNav();}
  if(e.key==='Tab'&&!backdrop.hidden){
    const focusable=[...backdrop.querySelectorAll('button:not([disabled]),input:not([hidden]):not([disabled]),select:not([disabled])')];
    const first=focusable[0],last=focusable[focusable.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});
const resetToken=new URLSearchParams(window.location.search).get('reset');
if(resetToken){
  authMode='reset';
  $('#modalTitle').textContent='Yeni Şifre Belirle';
  $('#modalDesc').textContent='Yeni şifreni belirleyerek hesabına tekrar erişebilirsin.';
  email.hidden=true;email.required=false;
  username.hidden=true;username.required=false;
  password.hidden=false;password.required=true;password.value='';
  password.setAttribute('autocomplete','new-password');
  password.placeholder='Yeni şifre (en az 10 karakter)';
  loginOptions.hidden=true;$('#registerProfileFields').hidden=true;$('#registerCountry').required=false;$('#registerGender').required=false;$('#authModeSwitch').hidden=true;
  $('#authSubmit').textContent='Şifreyi Güncelle';
  $('#modalNote').textContent='Sıfırlama bağlantısı 30 dakika geçerlidir.';
  backdrop.hidden=false;
  password.focus();
}
authForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const submit=$('#authSubmit');
  const original=submit.textContent;
  submit.disabled=true;
  submit.textContent='İşleniyor…';
  $('#modalNote').textContent='';
  let endpoint='',payload={};
  if(authMode==='login'){
    endpoint='/api/auth/login';
    payload={username:username.value.trim(),password:password.value,rememberMe:$('#rememberMe').checked};
  }else if(authMode==='register'){
    endpoint='/api/auth/register';
    payload={username:username.value.trim(),email:email.value.trim(),password:password.value,rememberMe:$('#rememberMe').checked,country:$('#registerCountry').value,gender:$('#registerGender').value};
  }else if(authMode==='forgot'){
    endpoint='/api/auth/forgot-password';
    payload={email:email.value.trim()};
  }else{
    endpoint='/api/auth/reset-password';
    payload={token:resetToken,password:password.value};
  }
  try{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'İşlem tamamlanamadı. Lütfen tekrar deneyin.');
    if(authMode==='login'||authMode==='register'){
      const verify=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
      const verified=await verify.json().catch(()=>({}));
      if(!verify.ok||verified.authenticated!==true||String(verified.user?.id)!==String(data.user?.id)){
        throw new Error('Giriş yanıtı alındı ancak oturum doğrulanamadı. Anasayfa ve oyun oturumu eşleşmiyor.');
      }
      await refreshAuthState();
      if(!homeSignedIn)throw new Error('Hesap oturumu anasayfada doğrulanamadı.');
      $('#modalNote').textContent='Hoş geldin, '+verified.user.username+'. Hesabına başarıyla giriş yaptın.';
      setTimeout(()=>{backdrop.hidden=true;},900);
    }else if(authMode==='forgot'){
      $('#modalNote').textContent=data.message||'Adres kayıtlıysa sıfırlama bağlantısı gönderilecektir.';
    }else{
      $('#modalNote').textContent=data.message||'Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.';
      const cleanUrl=new URL(window.location.href);cleanUrl.searchParams.delete('reset');window.history.replaceState({},'',cleanUrl.pathname+cleanUrl.search+cleanUrl.hash);
    }
  }catch(error){
    $('#modalNote').textContent=error.message;
  }finally{
    submit.disabled=false;
    submit.textContent=original;
  }
});

const panel=$('#radioPanel'),expand=$('#radioExpand'),radio=$('#radio'),audio=$('#radioAudio'),play=$('#radioPlay'),status=$('#radioStatus'),volume=$('#volume');
let streamUrl='',previousVolume=.7,radioStatusLoaded=false;
async function loadRadioStatus(){
  radioStatusLoaded=false;
  try{
    const response=await fetch('/api/radio/status',{cache:'no-store'});
    if(!response.ok)throw new Error('Radyo durumu alınamadı.');
    const data=await response.json();
    streamUrl=data.isLive&&data.configured?String(data.streamUrl||''):'';
    if(streamUrl){
      audio.src=streamUrl;
      $('#trackName').textContent=data.djName?data.djName+' · ZirveFm':'ZirveFm Canlı Yayın';
      status.textContent='Canlı yayın hazır.';
    }else{
      audio.removeAttribute('src');
      audio.load();
      status.textContent=data.configured?'Radyo şu anda yayında değil.':'ZirveFm yayın adresi henüz eklenmedi.';
    }
  }catch{
    streamUrl='';
    status.textContent='Radyo yayın durumu şu anda alınamıyor.';
  }finally{radioStatusLoaded=true;}
}
function expanded(open){
  radio.classList.toggle('is-open',open);
  expand.setAttribute('aria-expanded',String(open));
  panel.setAttribute('aria-hidden',String(!open));
  panel.inert=!open;
  if(open){$('#radioClose').focus({preventScroll:true});loadRadioStatus();}
  else expand.focus({preventScroll:true});
}
expanded(false);
loadRadioStatus();
expand.addEventListener('click',()=>expanded(!radio.classList.contains('is-open')));
$('#radioClose').addEventListener('click',()=>expanded(false));
function playing(value){
  play.textContent=value?'Ⅱ':'▶';
  play.setAttribute('aria-label',value?'Duraklat':'Başlat');
  expand.querySelector('.mini-play').textContent=value?'Ⅱ':'▶';
  document.querySelector('.bars')?.classList.toggle('is-playing',value);
}
play.addEventListener('click',async()=>{
  if(!radioStatusLoaded){status.textContent='Radyo yayın durumu kontrol ediliyor.';return;}
  if(!streamUrl){if(!status.textContent)status.textContent='ZirveFm şu anda yayında değil.';return;}
  if(audio.paused){
    try{await audio.play();playing(true);status.textContent='Canlı yayın oynatılıyor.';}
    catch{status.textContent='Yayın başlatılamadı; yayın adresini kontrol edin.';}
  }else{audio.pause();playing(false);status.textContent='Yayın duraklatıldı.';}
});
audio.addEventListener('pause',()=>playing(false));
audio.addEventListener('play',()=>playing(true));
audio.addEventListener('error',()=>{playing(false);status.textContent='Yayın bağlantısına ulaşılamıyor.';});
volume.addEventListener('input',()=>{
  audio.volume=Number(volume.value)/100;
  $('#volumeValue').textContent=volume.value;
  if(audio.volume>0)previousVolume=audio.volume;
});
$('#mute').addEventListener('click',()=>{
  if(audio.volume>0){previousVolume=audio.volume;audio.volume=0;volume.value=0;$('#volumeValue').textContent='0';$('#mute').setAttribute('aria-label','Sesi aç');}
  else{audio.volume=previousVolume;volume.value=Math.round(previousVolume*100);$('#volumeValue').textContent=volume.value;$('#mute').setAttribute('aria-label','Sessize al');}
});
$('#previous').addEventListener('click',()=>status.textContent='Canlı yayında parça atlama desteklenmiyor.');
$('#next').addEventListener('click',()=>status.textContent='Canlı yayında parça atlama desteklenmiyor.');

$('#playButton').addEventListener('click',async()=>{
  const button=$('#playButton');button.disabled=true;
  try{
    const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Hesap bağlantısı şu anda kullanılamıyor.');
    if(data.authenticated===true){window.location.href='/oyun.html';return;}
    const loginButton=document.querySelector('[data-modal="login"]');
    loginButton?.click();
    $('#modalNote').textContent='Oyuna katılmak için önce hesabına giriş yap.';
  }catch(error){$('#playStatus').textContent=error.message;}
  finally{button.disabled=false;}
});
audio.volume=.7;
