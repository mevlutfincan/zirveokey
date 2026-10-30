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
authForm.addEventListener('submit',e=>{
  e.preventDefault();
  const messages={
    login:'Hesap sistemi henüz sunucuya bağlı değil. Şu anda giriş yapılmadı.',
    register:'Hesap sistemi henüz sunucuya bağlı değil. Şu anda kayıt oluşturulmadı.',
    forgot:'Şifre sıfırlama sistemi henüz sunucuya bağlı değil. Şu anda e-posta gönderilmedi.'
  };
  $('#modalNote').textContent=messages[authMode];
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
