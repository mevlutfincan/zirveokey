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
const authButtons=[...document.querySelectorAll('[data-modal="login"],[data-modal="register"]')];
async function refreshAuthState(){
  try{
    const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw new Error('Oturum durumu alınamadı.');
    const data=await response.json();
    const signedIn=data.authenticated===true;
    authButtons.forEach(button=>button.hidden=signedIn);
    ['logoutButton','mobileLogoutButton'].forEach(id=>{const button=document.getElementById(id);if(button)button.hidden=!signedIn;});
    ['accountGreeting','mobileAccountGreeting'].forEach(id=>{const el=document.getElementById(id);if(el){el.hidden=!signedIn;el.textContent=signedIn?'Merhaba, '+data.user.username:'';}});
  }catch(error){console.warn('Oturum durumu kontrol edilemedi:',error.message);}
}
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

async function logout(){
  const buttons=[document.getElementById('logoutButton'),document.getElementById('mobileLogoutButton')].filter(Boolean);
  buttons.forEach(button=>button.disabled=true);
  try{
    const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Çıkış yapılamadı.');
    await refreshAuthState();
    $('#playStatus').textContent='Hesabından güvenli şekilde çıkış yaptın.';
    closeNav();
  }catch(error){alert(error.message);}
  finally{buttons.forEach(button=>button.disabled=false);}
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
  username.hidden=false;username.required=true;username.value='';
  password.hidden=false;password.required=true;password.value='';
  loginOptions.hidden=authMode!=='login';
  password.setAttribute('autocomplete',authMode==='register'?'new-password':'current-password');
  authForm.reset();
  $('#modalNote').textContent='Hesap işlemleri sunucu bağlantısı eklendiğinde etkinleştirilecek.';
  backdrop.hidden=false;
  backdrop.querySelector('input:not([hidden])')?.focus();
}));
$('#forgotPassword').addEventListener('click',()=>{
  authMode='forgot';
  $('#modalTitle').textContent='Şifremi Unuttum';
  $('#modalDesc').textContent='Şifre sıfırlama bağlantısı için kayıtlı e-posta adresini gir.';
  email.hidden=false;email.required=true;email.value='';
  username.hidden=true;username.required=false;
  password.hidden=true;password.required=false;
  loginOptions.hidden=true;
  $('#authSubmit').textContent='Sıfırlama Bağlantısı Gönder';
  $('#modalNote').textContent='Şifre sıfırlama işlemi sunucu bağlantısı eklendiğinde etkinleştirilecek.';
  email.focus();
});
function closeModal(){
  backdrop.hidden=true;
  lastTrigger?.focus();
}
$('#modalClose').addEventListener('click',closeModal);
backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeModal();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(!backdrop.hidden)closeModal();else closeNav();}
  if(e.key==='Tab'&&!backdrop.hidden){
    const focusable=[...backdrop.querySelectorAll('button:not([disabled]),input:not([hidden]):not([disabled])')];
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
  loginOptions.hidden=true;
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
    payload={username:username.value.trim(),email:email.value.trim(),password:password.value,rememberMe:$('#rememberMe').checked};
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
      $('#modalNote').textContent='Hoş geldin, '+data.user.username+'. Hesabına başarıyla giriş yaptın.';
      await refreshAuthState();
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
let streamUrl='',previousVolume=.7;
function expanded(open){
  radio.classList.toggle('is-open',open);
  expand.setAttribute('aria-expanded',String(open));
  panel.setAttribute('aria-hidden',String(!open));
  panel.inert=!open;
  if(open)$('#radioClose').focus({preventScroll:true});
  else expand.focus({preventScroll:true});
}
expanded(false);
expand.addEventListener('click',()=>expanded(!radio.classList.contains('is-open')));
$('#radioClose').addEventListener('click',()=>expanded(false));
function playing(value){
  play.textContent=value?'Ⅱ':'▶';
  play.setAttribute('aria-label',value?'Duraklat':'Başlat');
  expand.querySelector('.mini-play').textContent=value?'Ⅱ':'▶';
  document.querySelector('.bars')?.classList.toggle('is-playing',value);
}
play.addEventListener('click',async()=>{
  if(!streamUrl){status.textContent='ZirveFm yayın adresi henüz eklenmedi. Yayın bağlantısı son aşamada eklenecek.';return;}
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

$('#playButton').addEventListener('click',()=>{
  $('#playStatus').textContent='Oyun bağlantısı henüz etkinleştirilmedi.';
});
audio.volume=.7;
