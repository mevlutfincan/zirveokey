const status=document.getElementById('emailVerifyStatus');
const detail=document.getElementById('emailVerifyDetail');
const params=new URLSearchParams(location.search);
const token=params.get('token')||'';
history.replaceState(null,'',location.pathname);
async function verifyEmail(){
 if(!/^[a-f0-9]{64}$/.test(token)){status.textContent='Doğrulama bağlantısı geçersiz veya eksik.';status.classList.add('error');return;}
 try{
  const response=await fetch('/api/account/email-change/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'E-posta doğrulanamadı.');
  status.textContent=data.message||'E-posta adresin güncellendi.';
  detail.textContent='Güvenlik nedeniyle açık oturumların kapatıldı. Yeni e-posta adresinle tekrar giriş yapabilirsin.';
 }catch(error){status.textContent=error.message;status.classList.add('error');detail.textContent='Bağlantının süresi dolmuş veya daha önce kullanılmış olabilir. Hesabından yeni doğrulama bağlantısı isteyebilirsin.';}
}
verifyEmail();