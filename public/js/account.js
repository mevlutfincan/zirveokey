const $=s=>document.querySelector(s);
const status=$('#accountStatus'),content=$('#accountContent');
let preferences={};
async function api(url,options={}){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'İşlem tamamlanamadı.');
 return data;
}
function setStatus(target,message,error=false){target.textContent=message;target.classList.toggle('error',error);}
function renderAvatar(value,username){
 const image=$('#profileAvatar'),fallback=$('#avatarFallback');
 if(value){image.src=value;image.classList.add('visible');fallback.hidden=true;}
 else{image.removeAttribute('src');image.classList.remove('visible');fallback.hidden=false;fallback.textContent=(username||'Z').slice(0,1).toLocaleUpperCase('tr-TR');}
}
async function loadAccount(){
 try{
  const me=await api('/api/auth/me');
  if(me.authenticated!==true){location.replace('/');return;}
  $('#profileUsername').textContent=me.user.username||'';
  $('#profileEmail').textContent=me.user.email||'';
  $('#profileCountry').textContent=me.user.country||'';
  $('#profileGender').textContent=me.user.gender||'';
  $('#profileCountryInput').value=me.user.country||'Türkiye';
  $('#profileGenderInput').value=me.user.gender||'Belirtmek istemiyorum';
  const accountResults=await Promise.allSettled([api('/api/account/avatar'),api('/api/account/preferences'),api('/api/account/chat-style'),api('/api/account/email-change/status')]);
  const accountData=accountResults.map(result=>result.status==='fulfilled'?result.value:{});
  const [avatar,prefs,style,emailChange]=accountData;
  const partialFailure=accountResults.some(result=>result.status==='rejected');
  renderAvatar(avatar.avatar,me.user.username);
  preferences=prefs.preferences||{};
  document.body.classList.toggle('soft-light',preferences.settingDarkMode===false);
  document.querySelectorAll('#preferencesForm input[name]').forEach(input=>{input.checked=input.name==='settingDarkMode'?preferences.settingDarkMode!==false:preferences[input.name]===true;});
  const colors=style.chatStyle||{};
  $('#nameColor').value=colors.nameColor||'#ffffff';
  $('#textColor').value=colors.textColor||'#e9f0e8';
  $('#rowColor').value=colors.rowColor||'#102016';
  const emailChangeLoaded=accountResults[3].status==='fulfilled';
  $('#emailChangeForm').hidden=!emailChangeLoaded||emailChange.configured!==true;
  $('#emailChangeUnavailable').hidden=!emailChangeLoaded||emailChange.configured===true;
  content.hidden=false;
  if(partialFailure){setStatus(status,'Bazı hesap ayarları yüklenemedi. Sayfayı yenileyerek tekrar deneyebilirsin.',true);status.hidden=false;}
  else status.hidden=true;
 }catch(error){setStatus(status,error.message,true);}
}
$('#emailChangeForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const result=await api('/api/account/email-change',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('#newEmail').value,currentPassword:$('#emailCurrentPassword').value})});$('#emailCurrentPassword').value='';setStatus($('#emailChangeStatus'),result.message||'Adres uygunsa doğrulama bağlantısı gönderilecektir.');}
 catch(error){setStatus($('#emailChangeStatus'),error.message,true);}
 finally{button.disabled=false;}
});
$('#profileForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const result=await api('/api/account/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({country:$('#profileCountryInput').value,gender:$('#profileGenderInput').value})});$('#profileCountry').textContent=result.user.country;$('#profileGender').textContent=result.user.gender;setStatus($('#profileStatus'),'Profil bilgilerin güncellendi.');}
 catch(error){setStatus($('#profileStatus'),error.message,true);}
 finally{button.disabled=false;}
});
$('#avatarFile').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1024*1024){setStatus(status,'PNG, JPG veya WebP biçiminde en fazla 1 MB bir görsel seç.',true);event.target.value='';return;}
 try{
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Görsel okunamadı.'));reader.readAsDataURL(file);});
  const saved=await api('/api/account/avatar',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({avatar:data})});
  renderAvatar(saved.avatar,$('#profileUsername').textContent);setStatus(status,'Profil avatarın kaydedildi.');
 }catch(error){setStatus(status,error.message,true);}
 event.target.value='';
});
$('#removeAvatar').addEventListener('click',async()=>{
 try{const saved=await api('/api/account/avatar',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({avatar:null})});renderAvatar(saved.avatar,$('#profileUsername').textContent);setStatus(status,'Avatar kaldırıldı.');}
 catch(error){setStatus(status,error.message,true);}
});
$('#passwordForm').addEventListener('submit',async event=>{
 event.preventDefault();const currentPassword=$('#currentPassword').value,newPassword=$('#newPassword').value;
 if(newPassword!==$('#confirmPassword').value){setStatus($('#passwordStatus'),'Yeni şifreler eşleşmiyor.',true);return;}
 const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const result=await api('/api/account/password',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword})});event.currentTarget.reset();setStatus($('#passwordStatus'),result.message||'Şifre güncellendi.');}
 catch(error){setStatus($('#passwordStatus'),error.message,true);}
 finally{button.disabled=false;}
});
$('#preferencesForm').addEventListener('submit',async event=>{
 event.preventDefault();const changes={};event.currentTarget.querySelectorAll('input[name]').forEach(input=>changes[input.name]=input.checked);
 const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const result=await api('/api/account/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences:changes})});preferences=result.preferences||{...preferences,...changes};document.body.classList.toggle('soft-light',preferences.settingDarkMode===false);try{localStorage.setItem('zirveMemberSettings',JSON.stringify({...JSON.parse(localStorage.getItem('zirveMemberSettings')||'{}'),...preferences}));}catch{}setStatus($('#preferencesStatus'),'Hesap tercihlerin kaydedildi.');}
 catch(error){setStatus($('#preferencesStatus'),error.message,true);}
 finally{button.disabled=false;}
});
$('#chatStyleForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{await api('/api/account/chat-style',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nameColor:$('#nameColor').value,textColor:$('#textColor').value,rowColor:$('#rowColor').value})});setStatus($('#chatStyleStatus'),'Sohbet renklerin kaydedildi.');}
 catch(error){setStatus($('#chatStyleStatus'),error.message,true);}
 finally{button.disabled=false;}
});
loadAccount();