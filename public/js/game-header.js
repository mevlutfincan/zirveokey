(()=>{'use strict';
 const byId=id=>document.getElementById(id);
 function paintAvatar(value,username){
  const letter=(String(username||'M').trim().charAt(0)||'M').toLocaleUpperCase('tr-TR');
  ['gameUserAvatar','gameSeatAvatar'].forEach(id=>{
   const node=byId(id);if(!node)return;node.replaceChildren();
   if(value){const img=document.createElement('img');img.src=value;img.alt='Profil avatarı';img.className='member-avatar-image';img.addEventListener('error',()=>{node.replaceChildren();node.textContent=letter;},{once:true});node.append(img);}
   else node.textContent=letter;
  });
 }
 async function refreshHeaderIdentity(){
  try{
   const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!response.ok)return;
   const data=await response.json(),signed=data.authenticated===true,username=signed?String(data.user?.username||'Üye'):'Misafir Oyuncu';
   if(byId('gameUsername'))byId('gameUsername').textContent=username;
   if(byId('gameAccountState'))byId('gameAccountState').textContent=signed?'Üye hesabı':'Giriş yapılmadı';
   if(byId('gameSeatUsername'))byId('gameSeatUsername').textContent=username;
   if(byId('gameAuthActions'))byId('gameAuthActions').hidden=signed;
   if(byId('gameLogoutButton'))byId('gameLogoutButton').hidden=!signed;
   let avatar=null;
   if(signed){try{const r=await fetch('/api/account/avatar',{credentials:'same-origin',cache:'no-store'});if(r.ok)avatar=(await r.json()).avatar||null;}catch(_){}}
   paintAvatar(avatar,username);
  }catch(error){console.warn('Üst menü hesap bilgisi yenilenemedi:',error);}
 }
 const notificationsButton=byId('notificationsButton'),popover=byId('notificationsPopover');
 notificationsButton?.addEventListener('click',()=>{
  if(!popover)return;const opening=popover.hidden;popover.hidden=!opening;notificationsButton.setAttribute('aria-expanded',String(opening));
  if(opening){if(typeof window.__ZIRVE_LOAD_NOTIFICATIONS==='function')window.__ZIRVE_LOAD_NOTIFICATIONS();else loadNotificationsFallback();}
 });
 async function loadNotificationsFallback(){
  const list=byId('notificationList');if(!list)return;list.textContent='Bildirimler yükleniyor…';
  try{const r=await fetch('/api/notifications',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error('Bildirimler şu anda alınamıyor.');
   const data=await r.json(),items=data.notifications||[];list.replaceChildren();if(!items.length){list.textContent='Gösterilecek bildirim yok.';return;}
   items.forEach(item=>{const card=document.createElement('article');card.className='notification-item';const title=document.createElement('strong');title.textContent=String(item.title||'Bildirim');const message=document.createElement('p');message.textContent=String(item.message||'');card.append(title,message);list.append(card);});
  }catch(error){list.textContent=error.message;}
 }
 byId('settingsButton')?.addEventListener('click',()=>{if(typeof window.__ZIRVE_OPEN_SETTINGS==='function'){window.__ZIRVE_OPEN_SETTINGS();return;}const d=byId('memberSettingsDialog');if(d&&!d.open)d.showModal();});
 byId('openNotificationSettings')?.addEventListener('click',()=>{if(typeof window.__ZIRVE_OPEN_NOTIFICATION_SETTINGS==='function'){window.__ZIRVE_OPEN_NOTIFICATION_SETTINGS();return;}if(popover)popover.hidden=true;const d=byId('memberSettingsDialog');if(d&&!d.open)d.showModal();});
 byId('fullscreenButton')?.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch(_){const t=byId('gameToast');if(t){t.textContent='Tam ekran bu tarayıcıda kullanılamıyor.';t.classList.add('show');}}});
 document.addEventListener('fullscreenchange',()=>{const b=byId('fullscreenButton');if(!b)return;const active=!!document.fullscreenElement;b.title=active?'Tam ekrandan çık':'Tam ekran';b.setAttribute('aria-label',active?'Tam ekrandan çık':'Tam ekran');});
 refreshHeaderIdentity();window.addEventListener('pageshow',refreshHeaderIdentity);window.addEventListener('zirve:account-updated',refreshHeaderIdentity);
})();