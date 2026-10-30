const $=s=>document.querySelector(s);
const toggle=$('#mobileToggle'),nav=$('#mainNav');
const themeButton=$('.theme');
const root=document.documentElement;

try{
  const savedTheme=localStorage.getItem('zirveokey-theme');
  if(savedTheme==='light'){root.classList.add('soft-light');themeButton.textContent='☀';themeButton.setAttribute('aria-label','Koyu temaya geç');}
}catch(_){}

themeButton?.addEventListener('click',()=>{
  const light=root.classList.toggle('soft-light');
  themeButton.textContent=light?'☀':'☾';
  themeButton.setAttribute('aria-label',light?'Koyu temaya geç':'Açık temaya geç');
  try{localStorage.setItem('zirveokey-theme',light?'light':'dark');}catch(_){}
});

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
let lastTrigger=null;
document.querySelectorAll('[data-modal]').forEach(button=>button.addEventListener('click',()=>{
  lastTrigger=button;
  const register=button.dataset.modal==='register';
  $('#modalTitle').textContent=register?'Üye Ol':'Giriş Yap';
  $('#modalDesc').textContent=register?'ZirveOkey ailesine katıl.':'Hesabına giriş yap ve oyuna katıl.';
  $('#authSubmit').textContent=register?'Üye Ol':'Giriş Yap';
  email.hidden=!register;email.required=register;email.value='';
  authForm.reset();
  $('#modalNote').textContent='Hesap işlemleri sunucu bağlantısı eklendiğinde etkinleştirilecek.';
  backdrop.hidden=false;
  backdrop.querySelector('input:not([hidden])')?.focus();
}));
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
  $('#modalNote').textContent='Hesap sistemi henüz sunucuya bağlı değil. Şu anda kayıt veya giriş işlemi yapılmadı.';
});

const panel=$('#radioPanel'),expand=$('#radioExpand'),audio=$('#radioAudio'),play=$('#radioPlay'),status=$('#radioStatus'),volume=$('#volume');
let streamUrl='',previousVolume=.7;
function expanded(open){panel.hidden=!open;expand.setAttribute('aria-expanded',String(open));}
expand.addEventListener('click',()=>expanded(panel.hidden));
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
