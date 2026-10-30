const $=s=>document.querySelector(s);
const toggle=$('#mobileToggle'),nav=$('#mainNav');
toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');}));
const backdrop=$('#backdrop'),email=$('#email');
document.querySelectorAll('[data-modal]').forEach(b=>b.addEventListener('click',()=>{const register=b.dataset.modal==='register';$('#modalTitle').textContent=register?'Üye Ol':'Giriş Yap';$('#modalDesc').textContent=register?'ZirveOkey ailesine katıl.':'Hesabına giriş yap ve oyuna katıl.';$('#authSubmit').textContent=register?'Üye Ol':'Giriş Yap';email.hidden=!register;email.required=register;backdrop.hidden=false;}));
function closeModal(){backdrop.hidden=true;}
$('#modalClose').addEventListener('click',closeModal);backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeModal();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
$('#authForm').addEventListener('submit',e=>{e.preventDefault();$('#modalNote').textContent='Arayüz hazır. Gerçek üyelik ve oturum işlemleri backend bağlantısıyla etkinleştirilecek.';});
const panel=$('#radioPanel'),expand=$('#radioExpand'),audio=$('#radioAudio'),play=$('#radioPlay'),status=$('#radioStatus'),volume=$('#volume');
let streamUrl='',previousVolume=.7;
function expanded(open){panel.hidden=!open;expand.setAttribute('aria-expanded',String(open));}
expand.addEventListener('click',()=>expanded(panel.hidden));$('#radioClose').addEventListener('click',()=>expanded(false));
function playing(v){play.textContent=v?'Ⅱ':'▶';expand.querySelector('.mini-play').textContent=v?'Ⅱ':'▶';}
play.addEventListener('click',async()=>{if(!streamUrl){status.textContent='Canlı yayını başlatmak için ZirveFm yayın adresi gerekli.';return;}if(audio.paused){try{await audio.play();playing(true);status.textContent='Canlı yayın oynatılıyor.';}catch{status.textContent='Yayın başlatılamadı; yayın adresini kontrol edin.';}}else{audio.pause();playing(false);status.textContent='Yayın duraklatıldı.';}});
audio.addEventListener('pause',()=>playing(false));audio.addEventListener('play',()=>playing(true));
volume.addEventListener('input',()=>{audio.volume=Number(volume.value)/100;$('#volumeValue').textContent=volume.value;if(audio.volume>0)previousVolume=audio.volume;});
$('#mute').addEventListener('click',()=>{if(audio.volume>0){previousVolume=audio.volume;audio.volume=0;volume.value=0;$('#volumeValue').textContent='0';}else{audio.volume=previousVolume;volume.value=Math.round(previousVolume*100);$('#volumeValue').textContent=volume.value;}});
$('#previous').addEventListener('click',()=>status.textContent='Canlı yayında parça atlama desteklenmiyor.');$('#next').addEventListener('click',()=>status.textContent='Canlı yayında parça atlama desteklenmiyor.');
$('#playButton').addEventListener('click',()=>status.textContent='Oyun bağlantısı oyun uygulaması oluşturulduğunda eklenecek.');
audio.volume=.7;