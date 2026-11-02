(()=>{'use strict';
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const toast=$('#gameToast');let toastTimer;
function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2600)}
let tables=[],activeTable=null,selectedTile=null,idleTimer=null;
const gameAuthBootstrap=window.__ZIRVE_AUTH_BOOTSTRAP__||{authenticated:false};
let gameSignedIn=gameAuthBootstrap.authenticated===true,pendingMembershipAction=null;
function requireGameMembership(action,onSuccess){if(gameSignedIn)return true;pendingMembershipAction=typeof onSuccess==='function'?onSuccess:null;openGameAuth('login');$('#gameAuthMessage').textContent=action+' için önce hesabına giriş yapmalısın. Hesabın yoksa Üye Ol seçeneğini kullanabilirsin.';notify('Devam etmek için giriş yapmalısın.');return false;}
const discarded=[];
function lobbyNotice(message){const box=$('#chatMessages');const item=document.createElement('div');item.className='chat-system';item.textContent=message;box.append(item);box.scrollTop=box.scrollHeight;}
function clearIdleTimer(){if(idleTimer){clearTimeout(idleTimer);idleTimer=null}}
function resetIdleTimer(){clearIdleTimer();if(activeTable===null)return;idleTimer=setTimeout(()=>{const id=activeTable;tables=tables.filter(t=>t.id!==id);activeTable=null;$('#tableView').hidden=true;$('#lobbyView').hidden=false;renderTabs();renderLobby();lobbyNotice(String(id).padStart(3,'0')+' nolu test masası 2 dakika hareketsiz kaldığı için otomatik kapatıldı.');notify('Test masası hareketsizlik nedeniyle kapatıldı.');},120000)}
const sampleTiles=[{v:1,c:'red'},{v:2,c:'red'},{v:3,c:'red'},{v:4,c:'red'},{v:5,c:'red'},{v:6,c:'blue'},{v:7,c:'blue'},{v:8,c:'blue'},{v:9,c:'blue'},{v:10,c:'black'},{v:11,c:'black'},{v:12,c:'black'},{v:13,c:'black'},{v:5,c:'yellow'}];
function renderTabs(){
 const root=$('#openTableTabs');root.innerHTML='';
 if(!tables.length){root.innerHTML='<span class="empty-tabs">Açık masa yok</span>';return}
 tables.forEach(table=>{const b=document.createElement('div');b.className='table-tab'+(activeTable===table.id?' active':'');b.setAttribute('role','group');b.innerHTML='<span>▦</span><span>'+escapeHtml(table.name)+'<small> · '+String(table.id).padStart(3,'0')+'</small></span><button class="close-tab" type="button" aria-label="Masayı kapat">×</button>';b.addEventListener('click',e=>{if(e.target.closest('.close-tab')){e.stopPropagation();closeTable(table.id)}else openTable(table.id)});root.append(b)});
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderLobby(){
 const root=$('#lobbyTableGrid');root.innerHTML='';
 tables.forEach(t=>{const card=document.createElement('article');card.className='lobby-table-card'+(t.style==='Renkli'?' colored-table':'');card.innerHTML='<b>Masa '+String(t.id).padStart(3,'0')+' · '+escapeHtml(t.name)+'</b><p>'+escapeHtml(t.type)+' · '+escapeHtml(t.privacy)+' · '+escapeHtml(t.style||'Standart')+'</p><div class="table-card-seats"><span class="filled">Misafir</span><span>Boş</span><span>Boş</span><span>Boş</span></div>';card.addEventListener('click',()=>openTable(t.id));root.append(card)});
 updateOnlineCount();
}
function renderRack(){
 const root=$('#tileRack');root.innerHTML='';
 sampleTiles.forEach((tile,i)=>{const el=document.createElement('button');el.type='button';el.className='rack-tile '+tile.c+(selectedTile===i?' selected':'');el.textContent=tile.v;el.setAttribute('aria-label',tile.v+' numaralı taş');el.addEventListener('click',()=>{selectedTile=selectedTile===i?null:i;renderRack()});root.append(el)});
 $('#rackCount').textContent=sampleTiles.length+' taş • örnek dizilim';
}
function openTable(id){if(!requireGameMembership('Masaya oturmak',()=>openTable(id)))return;activeTable=id;const t=tables.find(x=>x.id===id);if(!t)return;$('#lobbyView').hidden=true;$('#tableView').hidden=false;$('#tableTitle').textContent='Masa '+String(t.id).padStart(3,'0');$('.table-number').textContent='MASA #'+String(t.id).padStart(3,'0');$('#roundStatus').textContent=t.type+' • Oyuncular bekleniyor';renderTabs();renderRack();resetIdleTimer()}
function closeTable(id){if(!confirm('Masayı kapatmak istediğinizden emin misiniz?'))return;clearIdleTimer();tables=tables.filter(t=>t.id!==id);if(activeTable===id){activeTable=null;$('#tableView').hidden=true;$('#lobbyView').hidden=false}renderTabs();renderLobby();lobbyNotice(String(id).padStart(3,'0')+' nolu masadan kendi isteğinle çıkış yaptın.');notify('Masa kapatıldı.')}
function createTable(){
 if(!requireGameMembership('Masa oluşturmak',()=>createTable()))return;
 if(tables.length>=1){notify('Bu önizlemede aynı anda yalnızca bir masa açılabilir.');return}
 const name=$('#newTableName').value.trim()||'Klasik Okey';const id=1;
 tables.push({id,name,type:$('#gameType').value,privacy:$('#tablePrivacy').value,style:$('#tableStyle').value,isTest:true});activeTable=id;
 $('#createDialog').close();renderTabs();renderLobby();openTable(id);notify('Masa arayüzü oluşturuldu. Oyun sunucusu henüz bağlı değil.');
}
$('#openCreateTable').addEventListener('click',()=>{if(requireGameMembership('Masa oluşturmak',()=>$('#createDialog').showModal()))$('#createDialog').showModal()});
const lobbyCreateTable=$('#lobbyCreateTable');if(lobbyCreateTable)lobbyCreateTable.addEventListener('click',()=>{if(requireGameMembership('Masa oluşturmak',()=>$('#createDialog').showModal()))$('#createDialog').showModal()});
$('.lobby-tab').addEventListener('click',()=>{clearIdleTimer();activeTable=null;$('#tableView').hidden=true;$('#lobbyView').hidden=false;renderTabs();});
$('#createTableForm').addEventListener('submit',e=>{e.preventDefault();createTable()});
$('#leaveTable').addEventListener('click',()=>{if(!activeTable)return;const id=activeTable;if(!confirm('Masadan çıkmak istediğinizden emin misiniz?'))return;clearIdleTimer();tables=tables.filter(t=>t.id!==id);activeTable=null;$('#tableView').hidden=true;$('#lobbyView').hidden=false;renderTabs();renderLobby();lobbyNotice(String(id).padStart(3,'0')+' nolu masadan kendi isteğinle çıkış yaptın.');notify('Masadan ayrıldın.')});
$('#sortTiles').addEventListener('click',()=>{sampleTiles.sort((a,b)=>a.c.localeCompare(b.c)||a.v-b.v);selectedTile=null;renderRack();notify('Taşlar renge ve sayıya göre sıralandı (örnek).')});
$('#sortPairs').addEventListener('click',()=>{sampleTiles.sort((a,b)=>a.v-b.v);selectedTile=null;renderRack();notify('Çift dizme önizlemesi uygulandı.')});
$('#discardTile').addEventListener('click',()=>{if(selectedTile===null){notify('Önce atmak istediğin taşı seç.');return}const tile=sampleTiles.splice(selectedTile,1)[0];discarded.push(tile);const target=$('#discardedTile');target.textContent=tile.v;target.classList.add('has-tile');target.style.color=tile.c==='red'?'#d42e29':tile.c==='blue'?'#2566c6':tile.c==='yellow'?'#c49b18':'#171717';selectedTile=null;renderRack();notify('Taş atma görsel önizlemesi uygulandı.');});
$('#startGame').addEventListener('click',()=>{if(!requireGameMembership('Oyun oynamak',()=>notify('Oyun motoru henüz bağlı değil.')))return;notify('Oyun motoru henüz bağlı değil.')});
$('#tableView').addEventListener('pointerdown',resetIdleTimer);
$('#tableView').addEventListener('keydown',resetIdleTimer);

const chatPanel=$('.chat-panel');
const mainColumn=$('.main-column');
const lobbyTabs=$('.lobby-tabs');
const chatDefaultHeight=390;
let chatPanelMode='normal';
const chatPositionProps=['position','left','right','top','bottom','width','height','min-height','max-height','max-width','box-sizing','transform','z-index','margin-top','transition','animation'];
function resetChatPanelInlineStyles(){
 chatPositionProps.forEach(p=>chatPanel.style.removeProperty(p));
 chatPanel.classList.remove('chat-panel-grown','chat-panel-centered');
 mainColumn.classList.remove('chat-mode-centered');
}
function setChatPosition(prop,value){
 chatPanel.style.setProperty(prop,value,'important');
}
function applyChatPanelMode(){
 resetChatPanelInlineStyles();
 if(chatPanelMode==='normal')return;
 /* Measure from the normal layout before applying any floating position. */
 const baseRect=chatPanel.getBoundingClientRect();
 const columnRect=mainColumn.getBoundingClientRect();
 const tabsRect=lobbyTabs.getBoundingClientRect();
 const isMobile=window.matchMedia('(max-width:760px)').matches;
 const viewportHeight=window.visualViewport?.height||window.innerHeight;
 const viewportTop=window.visualViewport?.offsetTop||0;
 setChatPosition('position','fixed');
 setChatPosition('left',Math.max(8,columnRect.left)+'px');
 setChatPosition('right','auto');
 setChatPosition('width',Math.min(columnRect.width,window.innerWidth-16)+'px');
 setChatPosition('z-index','80');
 setChatPosition('margin-top','0');
 setChatPosition('transition','none');
 setChatPosition('animation','none');
 if(isMobile){
  /* On phones the panel floats above the page; no negative transforms or flow-dependent sizing. */
  setChatPosition('max-width','calc(100vw - 16px)');
  setChatPosition('box-sizing','border-box');
  if(chatPanelMode==='grow'){
   const top=Math.max(viewportTop+8,Math.min(tabsRect.bottom+8,viewportTop+viewportHeight-220));
   setChatPosition('top',top+'px');
   setChatPosition('bottom',Math.max(8,window.innerHeight-(viewportTop+viewportHeight-8))+'px');
   setChatPosition('height','auto');
   setChatPosition('min-height','220px');
   setChatPosition('max-height','none');
   setChatPosition('transform','none');
   chatPanel.classList.add('chat-panel-grown');
  }else if(chatPanelMode==='center'){
   const panelHeight=Math.min(Math.round(viewportHeight*.70),560);
   setChatPosition('top',(viewportTop+viewportHeight/2)+'px');
   setChatPosition('bottom','auto');
   setChatPosition('height',panelHeight+'px');
   setChatPosition('min-height',panelHeight+'px');
   setChatPosition('max-height',Math.round(viewportHeight*.82)+'px');
   setChatPosition('transform','translateY(-50%)');
   chatPanel.classList.add('chat-panel-centered');
  }
  return;
 }
 setChatPosition('width',columnRect.width+'px');
 if(chatPanelMode==='grow'){
  /* Desktop: extend the chat panel upward to the lobby tabs. */
  setChatPosition('top',(tabsRect.bottom+2)+'px');
  setChatPosition('bottom',Math.max(0,window.innerHeight-baseRect.bottom)+'px');
  setChatPosition('height','auto');
  setChatPosition('min-height','0');
  setChatPosition('max-height','none');
  setChatPosition('transform','none');
  chatPanel.classList.add('chat-panel-grown');
 }else if(chatPanelMode==='center'){
  setChatPosition('top',(window.innerHeight/2)+'px');
  setChatPosition('bottom',Math.max(0,window.innerHeight-baseRect.bottom)+'px');
  setChatPosition('height','auto');
  setChatPosition('min-height','0');
  setChatPosition('max-height','none');
  setChatPosition('transform','none');
  chatPanel.classList.add('chat-panel-centered');
 }
}
function setChatPanelMode(mode){
 chatPanelMode=['grow','center'].includes(mode)?mode:'normal';
 applyChatPanelMode();
 $('#chatPanelGrow').classList.toggle('active',chatPanelMode==='grow');
 $('#chatPanelCenter').classList.toggle('active',chatPanelMode==='center');
 $('#chatPanelShrink').classList.toggle('active',chatPanelMode==='normal');
}
$('#chatPanelGrow').addEventListener('click',()=>setChatPanelMode('grow'));
$('#chatPanelCenter').addEventListener('click',()=>setChatPanelMode('center'));
$('#chatPanelShrink').addEventListener('click',()=>setChatPanelMode('normal'));
window.addEventListener('resize',()=>{if(chatPanelMode!=='normal')applyChatPanelMode()});
window.visualViewport?.addEventListener('resize',()=>{if(chatPanelMode!=='normal')applyChatPanelMode()});
setChatPanelMode('normal');

/* Expanded single-page emoji and smile collection. */
const smileButton=$('#chatSmileButton');
const chatPicker=$('#chatPicker');
const emojiGrid=$('#chatEmojiGrid');
const emojiSymbols=["😀","😃","😄","😁","😆","😅","😂","🤣","🥲","☺️","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🫣","🤭","🫢","🫡","🤫","🫠","🤥","😶","😐","😑","😬","🫨","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","😵‍💫","🫥","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾","❤️","🩷","🧡","💛","💚","💙","🩵","💜","🤎","🖤","🩶","🤍","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓","💗","💖","💘","💝","💟","💌","💋","💯","💢","💥","💫","💦","💨","👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄","🫦","👶","🧒","👦","👧","🧑","👨","👩","🧔","👱","👴","👵","💃","🕺","🧘","🏃","🚶","🧍","🧎","🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🦆","🦅","🦉","🦇","🐺","🐴","🦄","🐝","🦋","🐌","🐞","🐜","🕷️","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🦈","🐊","🐅","🐆","🦓","🦍","🐘","🦛","🦏","🐪","🦒","🦘","🦬","🐄","🐎","🐖","🐑","🦙","🐐","🦌","🐕","🐈","🐓","🦃","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨","🦡","🦦","🦥","🐁","🐀","🐿️","🦔","🐾","🌵","🎄","🌲","🌳","🌴","🌱","🌿","☘️","🍀","🍃","🍂","🍁","🍄","🌾","💐","🌷","🥀","🌹","🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌜","🌚","🌕","🌙","🌎","🪐","⭐","🌟","✨","⚡","☄️","💥","🔥","🌪️","🌈","☀️","🌤️","⛅","☁️","🌦️","🌧️","⛈️","🌩️","🌨️","❄️","☃️","🌬️","💧","💦","☔","🌊","🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🌮","🌯","🥗","🥘","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🍤","🍙","🍚","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🥜","🍯","🥛","☕","🫖","🍵","🧃","🥤","🧋","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🍾","⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🏓","🏸","🏒","🏑","🥍","🏏","⛳","🏹","🎣","🥊","🥋","🛹","🛼","⛸️","🎿","⛷️","🏂","🏋️","🤼","🤸","⛹️","🤺","🏌️","🏇","🏄","🏊","🚣","🚴","🎪","🎭","🩰","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🎷","🎺","🎸","🪕","🎻","🎲","♟️","🎯","🎳","🎮","🕹️","🧩","🧸","🎊","🎉","🎈","🎀","🎁","🏆","🥇","🥈","🥉","🏅","🪄","📱","💻","⌨️","🖥️","🖨️","📷","📸","📹","🎥","📞","☎️","📺","📻","🎙️","⏰","⌛","📡","🔋","🔌","💡","🔦","🕯️","💸","💵","💴","💶","💷","🪙","💰","💳","💎","🔧","🔨","⚒️","🛠️","⛏️","🪓","🔩","⚙️","🧲","🧪","🧬","🔬","🔭","📚","📖","✂️","🖊️","📝","✏️","🔍","🔒","🔑","🚪","🪑","🛏️","🛋️","🚽","🚿","🛁","🧴","🧹","🧺","🧻","🧼","🪥","🧽","🛒","🚬","⚰️","🪦","🗿","♻️","⚜️","🔱","🔰","⭕","✅","☑️","✔️","❌","❎","➕","➖","➗","✖️","💲","#️⃣","*️⃣","➰","🔴","🟠","🟡","🟢","🔵","🟣","🟤","⚫","⚪","🟥","🟧","🟨","🟩","🟦","🟪","🟫","⬛","⬜","🔶","🔷","🔸","🔹","🔺","🔻","💠"];
function insertChatText(value){
 const input=$('#chatInput');
 const start=input.selectionStart??input.value.length;
 const end=input.selectionEnd??input.value.length;
 input.value=input.value.slice(0,start)+value+input.value.slice(end);
 input.focus();
 const caret=start+value.length;
 input.setSelectionRange(caret,caret);
}
emojiSymbols.forEach(symbol=>{
 const b=document.createElement('button');b.type='button';b.textContent=symbol;b.setAttribute('aria-label',symbol);
 b.addEventListener('click',()=>insertChatText(symbol));emojiGrid.append(b);
});
function positionChatPicker(){
 const r=smileButton.getBoundingClientRect();
 const width=Math.min(520,window.innerWidth-24);
 const left=Math.max(12,Math.min(window.innerWidth-width-12,r.right-width));
 chatPicker.style.position='fixed';
 chatPicker.style.left=left+'px';
 chatPicker.style.right='auto';
 chatPicker.style.bottom=Math.max(12,window.innerHeight-r.top+8)+'px';
 chatPicker.style.top='auto';
 chatPicker.style.zIndex='2147483000';
 chatPicker.style.maxHeight=Math.min(620,window.innerHeight-24)+'px';
}
smileButton.addEventListener('click',event=>{
 event.preventDefault();
 event.stopPropagation();
 const opening=chatPicker.hidden || chatPicker.getAttribute('aria-hidden')==='true';
 if(chatPicker.parentElement!==document.body)document.body.append(chatPicker);
 if(opening){
  positionChatPicker();
  chatPicker.hidden=false;
  chatPicker.removeAttribute('aria-hidden');
  chatPicker.style.display='block';
 }else{
  chatPicker.hidden=true;
  chatPicker.setAttribute('aria-hidden','true');
  chatPicker.style.display='none';
 }
 smileButton.setAttribute('aria-expanded',String(opening));
});
window.addEventListener('resize',()=>{if(!chatPicker.hidden)positionChatPicker();});
window.addEventListener('scroll',()=>{if(!chatPicker.hidden)positionChatPicker();},true);
document.addEventListener('click',e=>{
 if(!chatPicker.hidden&&!chatPicker.contains(e.target)&&!e.composedPath().includes(smileButton)){
  chatPicker.hidden=true;chatPicker.setAttribute('aria-hidden','true');chatPicker.style.display='none';smileButton.setAttribute('aria-expanded','false');
 }
});
let chatLastId=0,chatBusy=false,chatStyleAuthenticated=false,chatStyleSaving=false,chatStyleAccountId=null,chatDisplayEnabled=false;
 const defaultChatStyle={nameColor:'#111111',textColor:'#111111',rowColor:'#e8efe8'};
 function validChatRowHex(value){return /^#[0-9a-f]{6}$/i.test(String(value||''));}
 function validChatHex(value){return /^#[0-9a-f]{6}$/i.test(String(value||''));}
 function updateChatColorPreview(){
  const name=$('#chatNameColor').value,text=$('#chatBodyColor').value;
  $('#chatColorPreview').style.setProperty('--chat-row-color',$('#settingRowColor')?.value||defaultChatStyle.rowColor);
  $('#chatColorPreviewName').style.color=name;$('#chatColorPreviewText').style.color=text;
  $('#chatColorSave').disabled=!chatStyleAuthenticated||chatStyleSaving;
  $('#chatColorStatus').textContent=!chatStyleAuthenticated?'Renkleri kaydetmek için giriş yapın.':chatStyleSaving?'Kaydediliyor…':'Seçtiğin tüm renkler kaydedilebilir ve diğer üyelere aynen görünür.';
 }
 function setChatColorInputs(style){
  $('#chatNameColor').value=validChatHex(style?.nameColor)?style.nameColor:defaultChatStyle.nameColor;
  $('#chatBodyColor').value=validChatHex(style?.textColor)?style.textColor:defaultChatStyle.textColor;
  const rowSetting=$('#settingRowColor');if(rowSetting)rowSetting.value=validChatRowHex(style?.rowColor)?style.rowColor:defaultChatStyle.rowColor;
  const nickSetting=$('#settingNickColor'),messageSetting=$('#settingMessageColor');
  if(nickSetting)nickSetting.value=$('#chatNameColor').value;
  if(messageSetting)messageSetting.value=$('#chatBodyColor').value;
  updateMemberColorPreview();
  updateChatColorPreview();
 }
 async function loadChatStyle(signed,accountId){
  chatStyleAuthenticated=signed;
  if(!signed){chatStyleAccountId=null;setChatColorInputs(defaultChatStyle);return;}
  const nextAccountId=String(accountId||'');
  // refreshGameAccount polls periodically; do not overwrite unsaved picker changes on every poll.
  if(chatStyleAccountId===nextAccountId)return;
  try{
   const response=await fetch('/api/account/chat-style',{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw new Error('Renk tercihleri alınamadı.');
   const data=await response.json();setChatColorInputs(data.chatStyle||defaultChatStyle);
   chatStyleAccountId=nextAccountId;
  }catch(error){$('#chatColorStatus').textContent='Renk tercihleri sunucudan alınamadı.';updateChatColorPreview();}
 }
 const renderedChatMessageIds=new Set();
 const chatMessagesBox=$('#chatMessages');
 function chatPreferenceKey(){
  const username=($('#gameUsername')?.textContent||'misafir').trim().toLocaleLowerCase('tr-TR');
  return 'zirveokey:lobby-chat-preferences:'+encodeURIComponent(username);
 }
 function readChatPreferences(){
  try{return JSON.parse(localStorage.getItem(chatPreferenceKey())||'{}')||{};}catch(_){return {};}
 }
 function saveChatPreferences(prefs){
  try{localStorage.setItem(chatPreferenceKey(),JSON.stringify(prefs));}catch(_){}
 }
 function applyChatTextPreferences(){
  const prefs=readChatPreferences();
  const size=Math.min(22,Math.max(12,Number(prefs.textSize)||15));
  chatMessagesBox.style.setProperty('--chat-message-size',size+'px');
  $('#chatTextReset').classList.toggle('active',size===15);
  $('#chatTextGrow').disabled=size>=22;
  $('#chatTextShrink').disabled=size<=12;
 }
 const chatTextSettingsToggle=$('#chatTextSettingsToggle');
const chatTextSettingsMenu=$('#chatTextSettingsMenu');
const radioButton=$('#chatRadioButton');
const radioStatus=$('#radioLiveStatus');
const radioAudio=$('#lobbyRadioAudio');
let radioInfo={isLive:false,djName:'',streamUrl:''};
let radioStatusBusy=false;
function renderRadioStatus(){
 const playing=!radioAudio.paused&&!radioAudio.ended;
 radioStatus.classList.toggle('is-live',radioInfo.isLive);
 radioStatus.classList.toggle('is-playing',playing);
 if(radioInfo.isLive){
  radioStatus.textContent='Şu Anda Yayında · '+radioInfo.djName;
  radioButton.title=playing?'Radyo yayınını durdur':'Radyo yayınını dinle';
 }else{
  radioStatus.textContent='Radyo çevrimdışı';
  radioButton.title='Radyo yayın bilgisi';
  radioButton.setAttribute('aria-pressed','false');
  if(playing)radioAudio.pause();
 }
 radioButton.classList.toggle('is-playing',playing);
 radioButton.setAttribute('aria-pressed',String(playing));
}
async function loadRadioStatus(){
 if(radioStatusBusy)return;
 radioStatusBusy=true;
 try{
  const response=await fetch('/api/radio/status',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw new Error('Radyo durumu alınamadı.');
  const data=await response.json();
  radioInfo={isLive:data.isLive===true&&typeof data.streamUrl==='string'&&data.streamUrl!=='',djName:String(data.djName||''),streamUrl:String(data.streamUrl||'')};
  if(radioInfo.isLive&&radioAudio.src!==radioInfo.streamUrl)radioAudio.src=radioInfo.streamUrl;
  renderRadioStatus();
 }catch(error){
  radioInfo={isLive:false,djName:'',streamUrl:''};
  radioStatus.textContent='Radyo durumu alınamadı';
  radioStatus.classList.remove('is-live','is-playing');
  radioButton.setAttribute('aria-pressed','false');
  if(!radioAudio.paused)radioAudio.pause();
 }finally{radioStatusBusy=false;}
}
radioButton.addEventListener('click',async()=>{
 if(!radioInfo.isLive||!radioInfo.streamUrl){
  notify('Radyo şu anda yayında değil.');
  return;
 }
 if(!radioAudio.paused&&!radioAudio.ended){
  radioAudio.pause();
  renderRadioStatus();
  return;
 }
 try{
  if(radioAudio.src!==radioInfo.streamUrl)radioAudio.src=radioInfo.streamUrl;
  await radioAudio.play();
  renderRadioStatus();
 }catch(error){
  notify('Radyo yayını başlatılamadı. Yayın bağlantısını kontrol edin.');
  renderRadioStatus();
 }
});
radioAudio.addEventListener('pause',renderRadioStatus);
radioAudio.addEventListener('play',renderRadioStatus);
radioAudio.addEventListener('ended',renderRadioStatus);
loadRadioStatus();
window.setInterval(loadRadioStatus,5000);

function selectChatSettingsTab(colors){
 $('#chatFontSettingsPane').hidden=colors;$('#chatColorsSettingsPane').hidden=!colors;
 $('#chatFontTab').classList.toggle('active',!colors);$('#chatColorsTab').classList.toggle('active',colors);
 $('#chatFontTab').setAttribute('aria-selected',String(!colors));$('#chatColorsTab').setAttribute('aria-selected',String(colors));
}
$('#chatFontTab').addEventListener('click',()=>selectChatSettingsTab(false));
$('#chatColorsTab').addEventListener('click',()=>selectChatSettingsTab(true));
$('#chatNameColor').addEventListener('input',updateChatColorPreview);
$('#chatBodyColor').addEventListener('input',updateChatColorPreview);
$('#chatColorSave').addEventListener('click',async()=>{
 if(!chatStyleAuthenticated||chatStyleSaving)return;
 chatStyleSaving=true;updateChatColorPreview();
 try{
  const response=await fetch('/api/account/chat-style',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({nameColor:$('#chatNameColor').value,textColor:$('#chatBodyColor').value,rowColor:'#e8efe8'})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Renkler kaydedilemedi.');
  const savedStyle=data.chatStyle||{nameColor:$('#chatNameColor').value,textColor:$('#chatBodyColor').value};
  setChatColorInputs(savedStyle);
  if(chatStyleAccountId)applyLobbyChatStyles([{id:chatStyleAccountId,chat_name_color:savedStyle.nameColor,chat_text_color:savedStyle.textColor,chat_row_color:savedStyle.rowColor}]);
  $('#chatColorStatus').textContent='Renk tercihlerin hesabına kaydedildi.';
  chatLastId=0;renderedChatMessageIds.clear();chatMessagesBox.replaceChildren();await loadLobbyMessages(true);
 }catch(error){$('#chatColorStatus').textContent=error.message;}
 finally{chatStyleSaving=false;updateChatColorPreview();}
});
selectChatSettingsTab(false);
chatTextSettingsToggle.addEventListener('click',()=>{
 const opening=chatTextSettingsMenu.hidden;
 chatTextSettingsMenu.hidden=!opening;
 chatTextSettingsToggle.setAttribute('aria-expanded',String(opening));
});
document.addEventListener('click',e=>{
 if(!$('#chatTextSettings').contains(e.target)){
  chatTextSettingsMenu.hidden=true;
  chatTextSettingsToggle.setAttribute('aria-expanded','false');
 }
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!chatTextSettingsMenu.hidden){
  chatTextSettingsMenu.hidden=true;
  chatTextSettingsToggle.setAttribute('aria-expanded','false');
  chatTextSettingsToggle.focus();
 }
});
$('#chatTextGrow').addEventListener('click',()=>{
  const prefs=readChatPreferences();prefs.textSize=Math.min(22,(Number(prefs.textSize)||15)+1);saveChatPreferences(prefs);applyChatTextPreferences();
 });
 $('#chatTextShrink').addEventListener('click',()=>{
  const prefs=readChatPreferences();prefs.textSize=Math.max(12,(Number(prefs.textSize)||15)-1);saveChatPreferences(prefs);applyChatTextPreferences();
 });
 $('#chatTextReset').addEventListener('click',()=>{
  const prefs=readChatPreferences();prefs.textSize=15;delete prefs.centered;saveChatPreferences(prefs);applyChatTextPreferences();
 });
 $('#chatClearMessages').addEventListener('click',()=>{
  const prefs=readChatPreferences();prefs.clearBeforeId=Math.max(Number(prefs.clearBeforeId)||0,chatLastId);saveChatPreferences(prefs);
  chatMessagesBox.replaceChildren();renderedChatMessageIds.clear();
  notify('Sohbet görünümün temizlendi.');
 });
 applyChatTextPreferences();
 function appendLobbyMessage(message){
  if(!message||message.id===undefined||message.id===null)return;
  const id=String(message.id);
  if(renderedChatMessageIds.has(id))return;
  renderedChatMessageIds.add(id);
  const numericId=Number(id);
  if(Number.isFinite(numericId))chatLastId=Math.max(chatLastId,numericId);
  if(Number.isFinite(numericId)&&numericId<=(Number(readChatPreferences().clearBeforeId)||0))return;
  const item=document.createElement('div');item.className='chat-message';item.dataset.messageId=id;
  if(message.user_id!==undefined&&message.user_id!==null)item.dataset.userId=String(message.user_id);
  const time=document.createElement('small');
  const createdAt=new Date(message.created_at);
  time.textContent=Number.isNaN(createdAt.getTime())?'--:--':createdAt.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
  time.className='chat-message-time';
  const author=document.createElement('b');author.className='chat-message-author';author.textContent=String(message.username||'Üye')+' :';
  const nameColor=validChatHex(message.chat_name_color)?message.chat_name_color:defaultChatStyle.nameColor;
  const textColor=validChatHex(message.chat_text_color)?message.chat_text_color:defaultChatStyle.textColor;
  item.style.setProperty('--chat-author-color',nameColor);item.style.setProperty('--chat-body-color',textColor);item.style.setProperty('--chat-row-color',validChatRowHex(message.chat_row_color)?message.chat_row_color:defaultChatStyle.rowColor);
  const body=document.createElement('span');body.className='chat-message-body';
  const messageText=String(message.message||'');
  if(typeof Intl!=='undefined'&&Intl.Segmenter){
   const segmenter=new Intl.Segmenter('tr',{granularity:'grapheme'});
   for(const part of segmenter.segment(messageText)){
    if(/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(part.segment)){
     const emoji=document.createElement('span');emoji.className='chat-message-emoji';emoji.textContent=part.segment;body.append(emoji);
    }else body.append(document.createTextNode(part.segment));
   }
  }else body.textContent=messageText;
  item.append(time,author,body);
  const box=$('#chatMessages');
  const next=[...box.querySelectorAll('.chat-message')].find(node=>Number(node.dataset.messageId)>numericId);
  if(next)box.insertBefore(item,next);else box.append(item);
  box.scrollTop=box.scrollHeight;
 }
 function applyLobbyChatStyles(members){
  (members||[]).forEach(member=>{
   const userId=String(member.id||'');
   if(!userId)return;
   const nameColor=validChatHex(member.chat_name_color)?member.chat_name_color:defaultChatStyle.nameColor;
   const textColor=validChatHex(member.chat_text_color)?member.chat_text_color:defaultChatStyle.textColor;
   const rowColor=validChatRowHex(member.chat_row_color)?member.chat_row_color:defaultChatStyle.rowColor;
   chatMessagesBox.querySelectorAll('.chat-message').forEach(item=>{
    if(item.dataset.userId!==userId)return;
    item.style.setProperty('--chat-author-color',nameColor);
    item.style.setProperty('--chat-body-color',textColor);
    item.style.setProperty('--chat-row-color',rowColor);
   });
  });
 }
 let chatStyleSyncBusy=false;
 async function loadLobbyChatStyles(){
  if(chatStyleSyncBusy||document.visibilityState==='hidden')return;
  chatStyleSyncBusy=true;
  try{
   const response=await fetch('/api/lobby/chat-styles',{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw new Error('Sohbet renkleri alınamadı');
   const data=await response.json();
   applyLobbyChatStyles(data.members||[]);
  }catch(error){console.warn('Sohbet renkleri eşitlenemedi.');}
  finally{chatStyleSyncBusy=false;}
 }
 async function loadLobbyMessages(initial=false){
 if(!chatDisplayEnabled||chatBusy)return;chatBusy=true;
 try{
  const url=initial?'/api/lobby/messages':'/api/lobby/messages?after='+chatLastId;
  const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});
  if(!r.ok)throw new Error('Sohbet alınamadı');
  const data=await r.json();
  if(initial){
   const messages=data.messages||[];
   const latestId=messages.reduce((max,message)=>Math.max(max,Number(message.id)||0),chatLastId);
   chatLastId=latestId;
   const prefs=readChatPreferences();prefs.clearBeforeId=Math.max(Number(prefs.clearBeforeId)||0,latestId);saveChatPreferences(prefs);
   chatMessagesBox.replaceChildren();renderedChatMessageIds.clear();
  }else (data.messages||[]).forEach(appendLobbyMessage);
 }catch(e){console.warn('Lobi sohbeti bağlantısı kurulamadı.');}
 finally{chatBusy=false;}
}
$('#chatForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!requireGameMembership('Sohbete mesaj göndermek',()=>$('#chatForm').requestSubmit()))return;const input=$('#chatInput'),message=input.value.trim();if(!message)return;
 try{
  const r=await fetch('/api/lobby/messages',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){if(r.status===401){openGameAuth('login');notify('Sohbete yazmak için giriş yapmalısın.');return;}throw new Error(data.error||'Mesaj gönderilemedi.');}
  input.value='';appendLobbyMessage(data.message);
 }catch(error){notify(error.message);}
});


function updateOnlineCount(count){
 const headerCount=$('#headerOnlineCount');
 const current=headerCount?Number(headerCount.textContent)||0:0;
 const value=count===undefined?current:(Number(count)||0);
 if(headerCount)headerCount.textContent=String(value);
 const sideBadge=$('.online-badge');if(sideBadge){const icon=sideBadge.querySelector('i');sideBadge.textContent=String(value);if(icon)sideBadge.prepend(icon);}
}
async function loadOnlineMembers(){
 try{
  const r=await fetch('/api/presence/online',{credentials:'same-origin',cache:'no-store'});
  if(!r.ok)throw new Error('Çevrimiçi listesi alınamadı');
  const data=await r.json(),root=$('#onlineList');root.replaceChildren();
  (data.members||[]).forEach(member=>{
   const tier=['gold','vip'].includes(String(member.membership_tier||'').toLowerCase())?String(member.membership_tier).toLowerCase():'normal';
   const row=document.createElement('div');row.className='online-member tier-'+tier;
   const avatar=document.createElement('button');avatar.type='button';avatar.className='online-member-avatar';avatar.title=member.username+' profil fotoğrafını büyüt';
   avatar.setAttribute('aria-label',member.username+' profil fotoğrafını büyüt');
   const image=document.createElement('img');image.alt='';image.loading='lazy';image.src='/api/public/members/'+encodeURIComponent(member.id)+'/avatar';
   const fallback=document.createElement('span');fallback.textContent=(member.username||'?').trim().charAt(0).toLocaleUpperCase('tr-TR');
   image.addEventListener('error',()=>{image.remove();avatar.append(fallback);},{once:true});
   avatar.append(image);
   avatar.addEventListener('click',()=>openMemberProfile(member.id));
   row.dataset.memberId=member.id;row.dataset.memberName=member.username;
   row.addEventListener('contextmenu',event=>{event.preventDefault();showMemberContextMenu(member,event.clientX,event.clientY);});
   let holdTimer=null,longPressTriggered=false;row.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')holdTimer=window.setTimeout(()=>{longPressTriggered=true;showMemberContextMenu(member,event.clientX,event.clientY);},550);});
   row.addEventListener('click',event=>{if(longPressTriggered){event.preventDefault();event.stopPropagation();longPressTriggered=false;}},true);
   ['pointerup','pointercancel','pointerleave'].forEach(type=>row.addEventListener(type,()=>{if(holdTimer)clearTimeout(holdTimer);holdTimer=null;}));
   const identity=document.createElement('span');identity.className='online-member-identity';
   const nameLine=document.createElement('span');nameLine.className='online-member-name-line';
   if(tier!=='normal'){const mark=document.createElement('span');mark.className='online-member-tier-icon';mark.textContent=tier==='gold'?'🪙':'💎';mark.setAttribute('aria-label',tier==='gold'?'Gold Üye':'VIP Üye');nameLine.append(mark);}
   const name=document.createElement('b');name.textContent=member.username;name.className='online-member-name-button';name.addEventListener('click',()=>openMemberProfile(member.id));nameLine.append(name);
   const membership=document.createElement('small');membership.className='online-member-tier-label';membership.textContent=tier==='gold'?'Gold Üye':tier==='vip'?'VIP Üye':'Normal Üye';
   identity.append(nameLine,membership);
   const status=document.createElement('small');
   const statusLabels={online:'Çevrim İçi',away:'Dışarda',sleeping:'Uyuyorum',busy:'Meşgul'};
   status.className='online-member-status status-'+(statusLabels[member.status]?member.status:'online');
   status.textContent=statusLabels[member.status]||statusLabels.online;
   row.append(avatar,identity,status);root.append(row);
  });
  if(!root.children.length){const empty=document.createElement('div');empty.className='side-empty';empty.innerHTML='<span>♙</span><b>Şu anda çevrimiçi üye yok</b>';root.append(empty);}
  updateOnlineCount(Number(data.count)||0);
 }catch(error){console.warn('Çevrimiçi üye listesi yüklenemedi.');}
}
let activeSocialMember=null,activePrivateMember=null,privateMessageLastId=0;
const memberProfileDialog=$('#memberProfileDialog'),privateMessageDialog=$('#privateMessageDialog'),socialCenterDialog=$('#socialCenterDialog'),memberContextMenu=$('#memberContextMenu');
async function socialRequest(url,method='GET',body){
 const response=await fetch(url,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'İşlem tamamlanamadı.');
 return data;
}
function closeMemberContextMenu(){memberContextMenu.hidden=true;memberContextMenu.replaceChildren();}
function showMemberContextMenu(member,x,y){
 if(!gameSignedIn){requireGameMembership('Üye işlemleri');return;}
 activeSocialMember=member;
 const actions=[['profile','Profili görüntüle'],['message','Özel mesaj gönder']];
 memberContextMenu.replaceChildren();
 actions.forEach(([action,label])=>{const button=document.createElement('button');button.type='button';button.role='menuitem';button.textContent=label;button.addEventListener('click',()=>{closeMemberContextMenu();runMemberAction(action,member);});memberContextMenu.append(button);});
 memberContextMenu.hidden=false;
 const rect=memberContextMenu.getBoundingClientRect();
 memberContextMenu.style.left=Math.max(8,Math.min(x,window.innerWidth-rect.width-8))+'px';
 memberContextMenu.style.top=Math.max(8,Math.min(y,window.innerHeight-rect.height-8))+'px';
}
document.addEventListener('click',event=>{if(!event.target.closest('#memberContextMenu'))closeMemberContextMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMemberContextMenu();});
async function openMemberProfile(memberId){
 if(!requireGameMembership('Üye profilini görüntülemek',()=>openMemberProfile(memberId)))return;
 try{
  const data=await socialRequest('/api/members/'+memberId+'/profile'),p=data.profile;activeSocialMember={id:p.id,username:p.username};
  $('#memberProfileName').textContent=p.username;
  $('#memberProfileAvatar').src='/api/public/members/'+p.id+'/avatar';
  $('#memberProfileAvatar').onerror=()=>{$('#memberProfileAvatar').src='';};
  $('#memberProfileTier').textContent=p.membership_tier==='gold'?'🪙 Gold Üye':p.membership_tier==='vip'?'💎 VIP Üye':'Normal Üye';
  $('#memberProfileStatus').textContent=({online:'Çevrim İçi',away:'Dışarda',sleeping:'Uyuyorum',busy:'Meşgul',offline:'Çevrim Dışı'})[p.status]||'Çevrim Dışı';
  $('#memberProfileBio').textContent=p.bio||'Henüz profil açıklaması eklenmemiş.';
  const hours=Math.floor(Number(p.active_seconds||0)/3600),days=Number(p.member_days||0);
  $('#memberProfileStats').replaceChildren();
  [['Üyelik',days+' gündür'],['Aktif süre',hours+' saat'],['Arkadaş',String(p.friend_count||0)]].forEach(([label,value])=>{const item=document.createElement('span');item.innerHTML='<small>'+label+'</small><b>'+value+'</b>';$('#memberProfileStats').append(item);});
  const badges=[];
  if(days>=30)badges.push('🏅 Topluluk Üyesi');
  else if(days>=7)badges.push('🌱 Yeni Topluluk Üyesi');
  if(hours>=10)badges.push('⭐ Sadık Oyuncu');
  else if(hours>=1)badges.push('🎯 Aktif Üye');
  if(p.membership_tier==='gold')badges.push('🪙 Gold Üye');
  if(p.membership_tier==='vip')badges.push('💎 VIP Üye');
  const badgeRoot=$('#memberProfileAchievements');badgeRoot.replaceChildren();
  if(!badges.length){badgeRoot.textContent='Rozet kazanmak için toplulukta aktif ol.';}
  else badges.forEach(label=>{const badge=document.createElement('span');badge.textContent=label;badgeRoot.append(badge);});
  const root=$('#memberProfileActions');root.replaceChildren();
  const add=(label,action)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>runMemberAction(action,activeSocialMember,p));root.append(b);};
  if(p.incoming_request){add('İsteği kabul et','accept');add('İsteği reddet','decline');}else if(!p.is_friend&&!p.outgoing_request)add('Arkadaş ekle','friend');else if(p.outgoing_request)add('İsteği iptal et','cancel_request');
  if(p.is_friend)add('Arkadaşlıktan çıkar','unfriend');
  add(p.is_favorite?'Favorilerden çıkar':'Favorilere ekle','favorite');
  add('Özel mesaj gönder','message');add(p.is_blocked?'Engeli kaldır':'Engelle','block');add('Şikâyet et','report');
  $('#memberProfileFeedback').textContent='';
  memberProfileDialog.showModal();
 }catch(error){notify(error.message);}
}
async function runMemberAction(action,member,profile){
 if(!member?.id)return;
 try{
  if(action==='profile'){await openMemberProfile(member.id);return;}
  if(action==='message'){memberProfileDialog.close();await openPrivateConversation(member);return;}
  if(action==='report'){activeSocialMember=member;$('#memberReportFeedback').textContent='';$('#memberReportForm').reset();$('#memberReportDialog').showModal();return;}
  let data;
  if(action==='friend')data=await socialRequest('/api/social/friends/'+member.id,'POST',{});
  else if(action==='accept')data=await socialRequest('/api/social/friends/'+member.id,'PUT',{status:'accepted'});
  else if(action==='decline')data=await socialRequest('/api/social/friends/'+member.id,'PUT',{status:'declined'});
  else if(action==='cancel_request')data=await socialRequest('/api/social/friends/'+member.id,'DELETE');
  else if(action==='unfriend')data=await socialRequest('/api/social/friends/'+member.id,'DELETE');
  else if(action==='favorite')data=await socialRequest('/api/social/favorites/'+member.id,profile?.is_favorite?'DELETE':'POST',{});
  else if(action==='block'){if(!confirm(member.username+' adlı üyeyi engellemek istiyor musun?'))return;data=await socialRequest('/api/social/blocks/'+member.id,profile?.is_blocked?'DELETE':'POST',{});}
  notify(action==='friend'?'Arkadaşlık isteği gönderildi.':action==='accept'?'Arkadaşlık isteği kabul edildi.':action==='favorite'?'Favori listen güncellendi.':action==='block'?'Engelleme listen güncellendi.':'İşlem tamamlandı.');
  if(memberProfileDialog.open)await openMemberProfile(member.id);
  if(socialCenterDialog.open)await loadSocialCenter(currentSocialTab);
 }catch(error){notify(error.message);}
}
let currentSocialTab='friends';
async function loadSocialCenter(tab='friends'){
 currentSocialTab=tab;
 $$('.social-center-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.socialTab===tab));
 const root=$('#socialCenterList');root.textContent='Yükleniyor…';
 try{
  if(tab==='messages'){
   const data=await socialRequest('/api/private-messages');root.replaceChildren();
   (data.conversations||[]).forEach(item=>addSocialListItem(root,item.username,item.message,()=>openPrivateConversation({id:item.id,username:item.username}),item.unread?item.unread+' okunmamış':''));
   if(!root.children.length)root.textContent='Henüz özel mesajın yok.';
   return;
  }
  const data=await socialRequest('/api/social/summary');
  const key={friends:'friends',requests:'incoming',favorites:'favorites',blocked:'blocked'}[tab],items=data[key]||[];
  root.replaceChildren();
  items.forEach(item=>{
   const suffix=tab==='requests'?'Arkadaşlık isteği':tab==='blocked'?'Engellenmiş üye':tab==='favorites'?'Favori üye':'Arkadaş';
   const row=document.createElement('div');row.className='social-list-item';
   const name=document.createElement('b');name.textContent=item.username;
   const sub=document.createElement('small');sub.textContent=suffix;
   const open=document.createElement('button');open.type='button';open.textContent='Profili aç';open.addEventListener('click',()=>openMemberProfile(item.id));
   row.append(name,sub,open);
   if(tab==='requests'){const accept=document.createElement('button');accept.type='button';accept.textContent='Kabul et';accept.addEventListener('click',async()=>{await runMemberAction('accept',item);});const decline=document.createElement('button');decline.type='button';decline.textContent='Reddet';decline.addEventListener('click',async()=>{await runMemberAction('decline',item);});row.append(accept,decline);}
   if(tab==='blocked'){const unblock=document.createElement('button');unblock.type='button';unblock.textContent='Engeli kaldır';unblock.addEventListener('click',()=>runMemberAction('block',item,{is_blocked:true}));row.append(unblock);}
   root.append(row);
  });
  if(!root.children.length)root.textContent=tab==='requests'?'Bekleyen arkadaşlık isteği yok.':tab==='favorites'?'Favori listen boş.':tab==='blocked'?'Engellediğin üye yok.':'Henüz arkadaşın yok.';
 }catch(error){root.textContent=error.message;}
}
function addSocialListItem(root,name,description,onClick,meta=''){
 const row=document.createElement('div');row.className='social-list-item';const b=document.createElement('b');b.textContent=name;const s=document.createElement('small');s.textContent=description;const action=document.createElement('button');action.type='button';action.textContent=meta||'Aç';action.addEventListener('click',onClick);row.append(b,s,action);root.append(row);
}
async function openPrivateConversation(member){
 if(!requireGameMembership('Özel mesaj göndermek',()=>openPrivateConversation(member)))return;
 activePrivateMember=member;privateMessageLastId=0;$('#privateMessageTitle').textContent=member.username+' · Özel Mesaj';$('#privateMessageHistory').replaceChildren();privateMessageDialog.showModal();await loadPrivateMessages();
}
async function loadPrivateMessages(){
 if(!activePrivateMember)return;
 try{
  const data=await socialRequest('/api/private-messages/'+activePrivateMember.id+'?after='+privateMessageLastId);
  const root=$('#privateMessageHistory');
  (data.messages||[]).forEach(item=>{privateMessageLastId=Math.max(privateMessageLastId,Number(item.id));const line=document.createElement('div');line.className='private-message '+(Number(item.sender_id)===Number(chatStyleAccountId)?'mine':'theirs');line.textContent=item.message;root.append(line);});
  root.scrollTop=root.scrollHeight;
 }catch(error){notify(error.message);}
}
$('#privateMessageForm').addEventListener('submit',async event=>{
 event.preventDefault();const input=$('#privateMessageInput'),message=input.value.trim();if(!message||!activePrivateMember)return;
 const button=event.submitter;button.disabled=true;
 try{await socialRequest('/api/private-messages/'+activePrivateMember.id,'POST',{message});input.value='';await loadPrivateMessages();}
 catch(error){notify(error.message);}finally{button.disabled=false;input.focus();}
});
$('#memberReportForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!activeSocialMember)return;
 const button=event.submitter;button.disabled=true;$('#memberReportFeedback').textContent='Gönderiliyor…';
 try{await socialRequest('/api/social/reports/'+activeSocialMember.id,'POST',{reason:$('#memberReportReason').value,details:$('#memberReportDetails').value.trim()});$('#memberReportFeedback').textContent='Şikâyetin yönetime iletildi.';notify('Şikâyetin alındı.');window.setTimeout(()=>$('#memberReportDialog').close(),700);}
 catch(error){$('#memberReportFeedback').textContent=error.message;}finally{button.disabled=false;}
});
$$('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>$('#'+button.dataset.closeDialog).close()));
$$('[data-social-tab]').forEach(button=>button.addEventListener('click',()=>loadSocialCenter(button.dataset.socialTab)));
$('#openSocialCenter').addEventListener('click',()=>{if(!requireGameMembership('Arkadaş listesini açmak'))return;socialCenterDialog.showModal();loadSocialCenter('friends');});
$('#openPrivateInbox').addEventListener('click',()=>{if(!requireGameMembership('Özel mesajlarını açmak'))return;socialCenterDialog.showModal();loadSocialCenter('messages');});
window.setInterval(()=>{if(privateMessageDialog.open)loadPrivateMessages();},5000);
window.addEventListener('resize',closeMemberContextMenu);

function openOnlineMemberAvatar(username,src){
 const dialog=$('#onlineMemberAvatarDialog'),image=$('#onlineMemberAvatarImage');
 if(!dialog||!image)return;
 $('#onlineMemberAvatarName').textContent=username;
 image.src=src;dialog.showModal();
}
const onlineAvatarDialog=$('#onlineMemberAvatarDialog');
$('#onlineMemberAvatarClose')?.addEventListener('click',()=>onlineAvatarDialog?.close());
onlineAvatarDialog?.addEventListener('click',event=>{if(event.target===onlineAvatarDialog)onlineAvatarDialog.close();});
async function sendPresenceHeartbeat(){
 try{await fetch('/api/presence/heartbeat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});}
 catch(error){console.warn('Çevrimiçi durumu güncellenemedi.');}
}
async function sendActivityHeartbeat(){
 try{
  const response=await fetch('/api/activity/heartbeat',{method:'POST',credentials:'same-origin',cache:'no-store'});
  if(!response.ok&&response.status!==401)throw new Error('Aktivite kaydı alınamadı');
 }catch(error){console.warn('Üye aktivitesi güncellenemedi.');}
}

const notificationsButton=$('#notificationsButton');
const notificationsPopover=$('#notificationsPopover');
const notificationList=$('#notificationList');
const notificationUnreadLabel=$('#notificationUnreadLabel');
const notificationStatus=$('#notificationStatus');
const notificationPreferenceToggle=$('#notificationPreferenceToggle');
let notificationUnreadCount=0,notificationUnreadByCategory={},notificationPollTimer=null,notificationsEnabled=true,lastNotificationUnreadCount=null,notificationAudioContext=null;
function prepareNotificationAudio(){const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)return;try{if(!notificationAudioContext)notificationAudioContext=new AudioContextClass();if(notificationAudioContext.state==='suspended')notificationAudioContext.resume().catch(()=>{});}catch(_){}}
function playNotificationSound(){if(!memberPreferences.settingNotificationSound||!notificationsEnabled||!notificationAudioContext||notificationAudioContext.state!=='running')return;try{const oscillator=notificationAudioContext.createOscillator(),gain=notificationAudioContext.createGain(),now=notificationAudioContext.currentTime;oscillator.type='sine';oscillator.frequency.setValueAtTime(880,now);oscillator.frequency.exponentialRampToValueAtTime(660,now+.13);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.12,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+.18);oscillator.connect(gain);gain.connect(notificationAudioContext.destination);oscillator.start(now);oscillator.stop(now+.19);}catch(_){}}
function updateNotificationBadge(count){
 notificationUnreadCount=Math.max(0,Number(count)||0);
 let badge=$('#notificationBadge');
 if(!badge){badge=document.createElement('span');badge.id='notificationBadge';badge.className='notification-badge';notificationsButton.append(badge);}
 badge.textContent=notificationUnreadCount>99?'99+':String(notificationUnreadCount);
 badge.hidden=notificationUnreadCount===0||!notificationsEnabled;
 notificationsButton.classList.toggle('has-notifications',notificationUnreadCount>0&&notificationsEnabled);
 notificationUnreadLabel.textContent=notificationsEnabled?(notificationUnreadCount?notificationUnreadCount+' okunmamış bildirim':'Bildirim geçmişin'):'Bildirimler kapalı';
}
function renderNotificationPreference(){
 notificationPreferenceToggle.setAttribute('aria-checked',String(notificationsEnabled));
 notificationPreferenceToggle.classList.toggle('enabled',notificationsEnabled);
 notificationPreferenceToggle.querySelector('b').textContent=notificationsEnabled?'Açık':'Kapalı';
 $('#notificationPreferenceHint').textContent=notificationsEnabled?'Yeni bildirimleri alıyorsun.':'Yeni bildirimler gösterilmeyecek.';
}
function syncNotificationCategoryControls(){
 ['settingNotifications','settingNotificationSound','settingFriendRequests','settingNotifyPlayers','settingNotifyGame','settingNotifySystem','settingNotifyManagement','settingNotifyRewards'].forEach(id=>{const control=$('#'+id);if(control&&document.activeElement!==control)control.checked=memberPreferences[id]!==false;});
}
function isNotificationCategoryEnabled(category){
 const keys={friendship:'settingFriendRequests',players:'settingNotifyPlayers',game:'settingNotifyGame',system:'settingNotifySystem',management:'settingNotifyManagement',rewards:'settingNotifyRewards'};
 const key=keys[category];return !key||memberPreferences[key]!==false;
}
function visibleUnreadCount(data){
 if(!notificationsEnabled)return 0;
 const counts=data.unreadByCategory||{};
 return Object.entries(counts).reduce((total,[category,count])=>total+(isNotificationCategoryEnabled(category)?Math.max(0,Number(count)||0):0),0);
}
function notificationTime(value){
 const date=new Date(value);if(Number.isNaN(date.getTime()))return '';
 return new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(date);
}
async function loadNotifications(){
 if(!gameSignedIn){notificationList.innerHTML='<div class="notification-empty"><b>Bildirimlerini görmek için giriş yap</b><span>Bildirimlerin hesabına özel olarak saklanır.</span><button type="button" id="notificationLogin">Giriş yap</button></div>';notificationUnreadLabel.textContent='Üye hesabı gerekli';return;}
 try{
  const response=await fetch('/api/notifications',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw new Error(response.status===401?'Oturumun sona ermiş.':'Bildirimler yüklenemedi.');
  const data=await response.json();memberPreferences={...preferenceDefaults,...memberPreferences,...(data.preferences||{})};notificationUnreadByCategory=data.unreadByCategory||{};notificationsEnabled=data.enabled!==false;syncNotificationCategoryControls();renderNotificationPreference();
  const visibleNotifications=(data.notifications||[]).filter(item=>isNotificationCategoryEnabled(item.category));
  updateNotificationBadge(visibleUnreadCount(data));
  notificationStatus.textContent=visibleNotifications.length+' bildirim';
  if(!notificationsEnabled){notificationList.innerHTML='<div class="notification-empty"><b>Bildirimler kapalı</b><span>Yeni bildirim almak için yukarıdaki düğmeyi açabilirsin.</span></div>';return;}
  if(!visibleNotifications.length){notificationList.innerHTML='<div class="notification-empty"><b>Gösterilecek bildirim yok</b><span>Yeni bildirimlerin burada görünecek veya tercihlerin nedeniyle gizleniyor.</span></div>';return;}
  notificationList.replaceChildren();
  visibleNotifications.forEach(item=>{
   const card=document.createElement('article');card.className='notification-item'+(item.read_at?'':' unread');card.dataset.id=item.id;
   const icon=document.createElement('span');icon.className='notification-icon';icon.textContent=({friendship:'♙',players:'●',game:'◆',system:'⚙',management:'✦',rewards:'★'})[item.category]||'•';
   const body=document.createElement('div');body.className='notification-copy';
   const title=document.createElement('strong');title.textContent=item.title;
   const message=document.createElement('p');message.textContent=item.message;
   const time=document.createElement('time');time.textContent=notificationTime(item.created_at);
   body.append(title,message,time);card.append(icon,body);
   const actions=document.createElement('div');actions.className='notification-item-actions';
   if(!item.read_at){const read=document.createElement('button');read.type='button';read.textContent='Okundu';read.setAttribute('aria-label','Okundu işaretle');read.addEventListener('click',()=>markNotificationRead(item.id));actions.append(read);}
   const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Bildirimi sil');remove.addEventListener('click',()=>deleteNotification(item.id));actions.append(remove);card.append(actions);
   if(item.action_url){const safe=new URL(item.action_url,location.origin);if(safe.origin===location.origin){card.classList.add('actionable');card.addEventListener('click',e=>{if(e.target.closest('button'))return;location.href=safe.pathname+safe.search+safe.hash;});}}
   notificationList.append(card);
  });
 }catch(error){notificationList.innerHTML='<div class="notification-empty">'+error.message+'</div>';}
}
async function notificationAction(url,method='POST'){
 const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store'});
 if(!response.ok)throw new Error('Bildirim işlemi tamamlanamadı.');
 await loadNotifications();
}
async function markNotificationRead(id){try{await notificationAction('/api/notifications/'+id+'/read');}catch(e){notify(e.message);}}
async function deleteNotification(id){try{await notificationAction('/api/notifications/'+id,'DELETE');}catch(e){notify(e.message);}}
window.__ZIRVE_LOAD_NOTIFICATIONS=loadNotifications;
notificationList.addEventListener('click',e=>{if(e.target.id==='notificationLogin')openGameAuth('login');});
$('#notificationReadAll').addEventListener('click',async()=>{try{await notificationAction('/api/notifications/read-all');}catch(e){notify(e.message);}});
$('#notificationClearAll').addEventListener('click',async()=>{if(!confirm('Tüm bildirimlerini silmek istediğinden emin misin?'))return;try{await notificationAction('/api/notifications','DELETE');}catch(e){notify(e.message);}});
notificationPreferenceToggle.addEventListener('click',async()=>{
 const next=!notificationsEnabled;notificationPreferenceToggle.disabled=true;
 try{
  const response=await fetch('/api/notifications/preferences',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:next})});
  if(!response.ok)throw new Error('Bildirim tercihi kaydedilemedi.');
  const data=await response.json();notificationsEnabled=data.enabled;memberPreferences={...memberPreferences,settingNotifications:data.enabled};if($('#settingNotifications'))$('#settingNotifications').checked=data.enabled;renderNotificationPreference();updateNotificationBadge(notificationUnreadCount);await loadNotifications();
 }catch(error){notify(error.message);}
 finally{notificationPreferenceToggle.disabled=false;}
});
document.addEventListener('click',e=>{
 if(!notificationsPopover.hidden&&!notificationsPopover.contains(e.target)&&!notificationsButton.contains(e.target)){notificationsPopover.hidden=true;notificationsButton.setAttribute('aria-expanded','false');}
});
async function pollNotificationCount(){
 if(!gameSignedIn){updateNotificationBadge(0);return;}
 try{const response=await fetch('/api/notifications',{credentials:'same-origin',cache:'no-store'});if(response.ok){const data=await response.json();memberPreferences={...preferenceDefaults,...memberPreferences,...(data.preferences||{})};notificationUnreadByCategory=data.unreadByCategory||{};syncNotificationCategoryControls();notificationsEnabled=data.enabled!==false;renderNotificationPreference();const unread=visibleUnreadCount(data);if(lastNotificationUnreadCount!==null&&unread>lastNotificationUnreadCount)playNotificationSound();lastNotificationUnreadCount=unread;updateNotificationBadge(unread);if(!notificationsPopover.hidden)loadNotifications();}}
 catch(_){}
}
pollNotificationCount();notificationPollTimer=setInterval(pollNotificationCount,30000);

const settingsDialog=$('#memberSettingsDialog');
$('#memberSettingsForm').addEventListener('submit',event=>event.preventDefault());
let memberAvatarData=null;
function paintMemberAvatar(value){
 memberAvatarData=value||null;
 const headerAvatar=$('#gameUserAvatar'),preview=$('#settingsAvatarPreview');
 [headerAvatar,preview].forEach(node=>{
  if(!node)return;
  if(memberAvatarData){node.textContent='';const img=document.createElement('img');img.src=memberAvatarData;img.alt='Avatar';img.className='member-avatar-image';node.append(img);}
  else node.textContent=(($('#gameUsername')?.textContent||'M').trim().charAt(0)||'M').toLocaleUpperCase('tr-TR');
 });
}
async function loadMemberAvatar(){
 if(!gameSignedIn){paintMemberAvatar(null);$('#settingAvatarStatus').textContent='Avatar seçmek için giriş yapmalısın.';return;}
 try{const r=await fetch('/api/account/avatar',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error();const data=await r.json();paintMemberAvatar(data.avatar);$('#settingAvatarStatus').textContent='Avatar hesabına kaydedildi.';}
 catch(_){$('#settingAvatarStatus').textContent='Avatar bilgisi alınamadı.';}
}
$('#settingAvatarFile').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1024*1024){$('#settingAvatarStatus').textContent='PNG, JPG veya WebP formatında en fazla 1 MB görsel seç.';e.target.value='';return;}
 if(!chatStyleAuthenticated){$('#settingAvatarStatus').textContent='Avatar yüklemek için giriş yapmalısın.';e.target.value='';return;}
 const reader=new FileReader();
 reader.onload=async()=>{
  const avatar=String(reader.result||'');$('#settingAvatarStatus').textContent='Avatar kaydediliyor…';
  try{const r=await fetch('/api/account/avatar',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({avatar})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Avatar kaydedilemedi.');paintMemberAvatar(data.avatar);$('#settingAvatarStatus').textContent='Avatarın kaydedildi.';notify('Avatarın güncellendi.');}
  catch(error){$('#settingAvatarStatus').textContent=error.message;}
  finally{$('#settingAvatarFile').value='';}
 };
 reader.onerror=()=>{$('#settingAvatarStatus').textContent='Görsel okunamadı.';$('#settingAvatarFile').value='';};
 reader.readAsDataURL(file);
});
$('#removeSettingAvatar').addEventListener('click',async()=>{
 if(!memberAvatarData){$('#settingAvatarStatus').textContent='Zaten varsayılan avatar kullanılıyor.';return;}
 if(!confirm('Mevcut avatarını kaldırıp varsayılan görsele dönmek istiyor musun?'))return;
 if(!chatStyleAuthenticated){$('#settingAvatarStatus').textContent='Avatarı kaldırmak için giriş yapmalısın.';return;}
 try{const r=await fetch('/api/account/avatar',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({avatar:null})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Avatar kaldırılamadı.');paintMemberAvatar(null);$('#settingAvatarFile').value='';$('#settingAvatarStatus').textContent='Avatar kaldırıldı.';notify('Avatar kaldırıldı.');}
 catch(error){$('#settingAvatarStatus').textContent=error.message;}
});
const settingsKeys=['settingNotifications','settingNotificationSound','settingPrivateMessages','settingFriendRequests','settingNotifyPlayers','settingNotifyGame','settingNotifySystem','settingNotifyManagement','settingNotifyRewards'];
let memberPreferences={};
const preferenceDefaults={settingNotifications:true,settingNotificationSound:false,settingPresenceStatus:'online',settingFriendRequests:true,settingNotifyPlayers:true,settingNotifyGame:true,settingNotifySystem:true,settingNotifyManagement:true,settingNotifyRewards:true};
function applyMemberSettings(values){
 notificationsEnabled=values.settingNotifications!==false;
 // Bildirim merkezi, bildirimler kapalıyken de ayarları yeniden açabilmek için erişilebilir kalır.
 $('#notificationsButton').hidden=false;
 renderNotificationPreference();
 updateNotificationBadge(visibleUnreadCount({unreadByCategory:notificationUnreadByCategory}));
 }
let preferenceSaveQueue=Promise.resolve();
async function saveMemberPreferences(patch){
 if(!chatStyleAuthenticated)throw new Error('Ayarları kaydetmek için giriş yapmalısın.');
 const save=async()=>{
  const response=await fetch('/api/account/preferences',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences:patch})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Ayarlar kaydedilemedi.');
  memberPreferences={...preferenceDefaults,...data.preferences};
  settingsKeys.forEach(id=>{if($('#'+id))$('#'+id).checked=!!memberPreferences[id]});
 if($('#settingPresenceStatus'))$('#settingPresenceStatus').value=memberPreferences.settingPresenceStatus||'online';
  applyMemberSettings(memberPreferences);
  if(Object.keys(patch).some(key=>key.startsWith('settingNotify')||key==='settingFriendRequests')&&!notificationsPopover.hidden)loadNotifications();
  $('#settingsSaveState').textContent='Değişiklikler hesabına kaydedildi.';
 };
 const pending=preferenceSaveQueue.then(save,save);
 preferenceSaveQueue=pending.catch(()=>{});
 return pending;
}
async function loadMemberSettings(){
 const saveState=$('#settingsSaveState');
 memberPreferences={...preferenceDefaults};
 if(chatStyleAuthenticated){
  try{const response=await fetch('/api/account/preferences',{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Ayarlar yüklenemedi.');memberPreferences={...preferenceDefaults,...data.preferences};saveState.textContent='Hesap ayarların yüklendi.';}
  catch(error){saveState.textContent=error.message;notify(error.message);}
 }else{saveState.textContent='Ayarları hesabına kaydetmek için giriş yap.';}
 settingsKeys.forEach(id=>{if($('#'+id))$('#'+id).checked=!!memberPreferences[id]});
 if($('#settingPresenceStatus'))$('#settingPresenceStatus').value=memberPreferences.settingPresenceStatus||'online';
 applyMemberSettings(memberPreferences);
 $('#settingProfileBio').value=memberPreferences.profileBio||'';
 $('#settingsAccountName').textContent=$('#gameUsername')?.textContent||'Üye hesabı';
 $('#settingsAccountStatus').textContent=chatStyleAuthenticated?'Oturum açık · Ayarların hesabına kaydedilir.':'Misafir oturumu · Değişiklikleri kaydetmek için giriş yap.';
}
function showSettingsCategory(category){
 Array.from(document.querySelectorAll('.settings-category')).forEach(button=>button.classList.toggle('active',button.dataset.settingsCategory===category));
 $$('.settings-page').forEach(page=>{const active=page.dataset.settingsPage===category;page.hidden=!active;page.classList.toggle('active',active);});
}
window.__ZIRVE_OPEN_SETTINGS=async()=>{showSettingsCategory('account');await loadMemberSettings();loadMemberAvatar();if(!settingsDialog.open)settingsDialog.showModal();};
window.__ZIRVE_OPEN_NOTIFICATION_SETTINGS=async()=>{notificationsPopover.hidden=true;notificationsButton.setAttribute('aria-expanded','false');await loadMemberSettings();showSettingsCategory('notifications');if(!settingsDialog.open)settingsDialog.showModal();};
Array.from(document.querySelectorAll('.settings-category')).forEach(button=>button.addEventListener('click',()=>showSettingsCategory(button.dataset.settingsCategory)));
Array.from(document.querySelectorAll('[data-settings-open]')).forEach(button=>button.addEventListener('click',()=>showSettingsCategory(button.dataset.settingsOpen)));
Array.from(document.querySelectorAll('.password-visibility-toggle')).forEach(button=>button.addEventListener('click',()=>{const input=$('#'+button.dataset.passwordTarget);if(!input)return;const reveal=input.type==='password';input.type=reveal?'text':'password';button.textContent=reveal?'Gizle':'Göster';button.setAttribute('aria-label',reveal?'Şifreyi gizle':'Şifreyi göster');}));
$('#closeMemberSettings').addEventListener('click',()=>settingsDialog.close());
settingsDialog.addEventListener('click',e=>{if(e.target===settingsDialog)settingsDialog.close()});
settingsDialog.addEventListener('close',()=>{
 ['currentPassword','newPassword','confirmNewPassword'].forEach(id=>{const input=$('#'+id);if(input){input.value='';input.type='password';}});
 Array.from(document.querySelectorAll('.password-visibility-toggle')).forEach(button=>{button.textContent='Göster';button.setAttribute('aria-label','Şifreyi göster');});
 $('#passwordChangeStatus').textContent='Şifren en az 10 karakter olmalıdır.';
});
$('#saveProfileBio').addEventListener('click',async()=>{
 const bio=$('#settingProfileBio').value.trim();$('#settingsSaveState').textContent='Kaydediliyor…';
 try{await saveMemberPreferences({profileBio:bio});$('#settingsSaveState').textContent='Profil açıklaman kaydedildi.';notify('Profil açıklaman güncellendi.');}
 catch(error){$('#settingsSaveState').textContent=error.message;notify(error.message);}
});
$('#settingPresenceStatus').addEventListener('change',async()=>{
 const value=$('#settingPresenceStatus').value;$('#settingsSaveState').textContent='Kaydediliyor…';
 try{await saveMemberPreferences({settingPresenceStatus:value});sendPresenceHeartbeat();loadOnlineMembers();}
 catch(error){$('#settingPresenceStatus').value=memberPreferences.settingPresenceStatus||'online';$('#settingsSaveState').textContent=error.message;notify(error.message);}
});
settingsKeys.forEach(id=>{const control=$('#'+id);if(!control)return;control.addEventListener('change',async()=>{
 const value=$('#'+id).checked;if(id==='settingNotificationSound'&&value)prepareNotificationAudio();$('#settingsSaveState').textContent='Kaydediliyor…';
 applyMemberSettings({...memberPreferences,[id]:value});
 try{
  await saveMemberPreferences({[id]:value});
  if(id==='settingNotifications'){
   notificationsEnabled=value;
   renderNotificationPreference();
  }
 }catch(error){
  $('#'+id).checked=!value;applyMemberSettings(memberPreferences);
  if(id==='settingNotifications'){notificationsEnabled=!value;renderNotificationPreference();}
  $('#settingsSaveState').textContent=error.message;notify(error.message);
 }
});});
function updateMemberColorPreview(){const name=$('#settingNickColor').value,text=$('#settingMessageColor').value,row=$('#settingRowColor')?.value||defaultChatStyle.rowColor;$('#memberColorPreviewName').style.color=name;$('#memberColorPreviewText').style.color=text;$('#memberColorPreview').style.background=row;}
$('#settingNickColor').addEventListener('input',updateMemberColorPreview);
$('#settingMessageColor').addEventListener('input',updateMemberColorPreview);
$('#settingRowColor').addEventListener('input',updateMemberColorPreview);
$('#changeAccountPassword').addEventListener('click',async()=>{
 const currentPassword=$('#currentPassword').value,newPassword=$('#newPassword').value,confirmPassword=$('#confirmNewPassword').value,status=$('#passwordChangeStatus'),button=$('#changeAccountPassword');
 if(!chatStyleAuthenticated){status.textContent='Şifre değiştirmek için giriş yapmalısın.';notify(status.textContent);return;}
 if(currentPassword.length<10||currentPassword.length>72){status.textContent='Mevcut şifren 10-72 karakter arasında olmalı.';return;}
 if(newPassword.length<10||newPassword.length>72){status.textContent='Yeni şifre 10-72 karakter arasında olmalı.';return;}
 if(newPassword===currentPassword){status.textContent='Yeni şifren mevcut şifrenle aynı olamaz.';return;}
 if(newPassword!==confirmPassword){status.textContent='Yeni şifreler eşleşmiyor.';return;}
 button.disabled=true;button.textContent='Güncelleniyor…';status.textContent='Şifre kontrol ediliyor…';
 try{const response=await fetch('/api/account/password',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Şifre değiştirilemedi.');$('#currentPassword').value='';$('#newPassword').value='';$('#confirmNewPassword').value='';status.textContent=data.message||'Şifren güncellendi.';notify(status.textContent);}
 catch(error){status.textContent=error.message;notify(error.message);}
 finally{button.disabled=false;button.textContent='Şifreyi güncelle';}
});
$('#saveMemberSettings').addEventListener('click',async()=>{
 const nameColor=$('#settingNickColor').value,textColor=$('#settingMessageColor').value,rowColor=$('#settingRowColor').value;
 if(!chatStyleAuthenticated){$('#memberColorStatus').textContent='Renk tercihlerini kaydetmek için giriş yapmalısın.';notify('Renk ayarları için giriş yapmalısın.');return;}
 const button=$('#saveMemberSettings');button.disabled=true;button.textContent='Kaydediliyor…';
 try{const response=await fetch('/api/account/chat-style',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({nameColor,textColor,rowColor})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Renk tercihleri kaydedilemedi.');const saved=data.chatStyle||{nameColor,textColor};setChatColorInputs(saved);if(chatStyleAccountId)applyLobbyChatStyles([{id:chatStyleAccountId,chat_name_color:saved.nameColor,chat_text_color:saved.textColor,chat_row_color:saved.rowColor}]);chatLastId=0;renderedChatMessageIds.clear();chatMessagesBox.replaceChildren();await loadLobbyMessages(true);$('#memberColorStatus').textContent='Nick, mesaj ve sohbet satırı renklerin kaydedildi.';notify('Renk tercihlerin kaydedildi.');}
 catch(error){$('#memberColorStatus').textContent=error.message;notify(error.message);}
 finally{button.disabled=false;button.textContent='Renkleri kaydet';}
});


let gameAuthMode='login';
function openGameAuth(mode='login'){
 gameAuthMode=mode;
 const registering=mode==='register',forgot=mode==='forgot';
 $('#gameAuthTitle').textContent=registering?'Üye Ol':forgot?'Şifremi Unuttum':'Giriş Yap';
 $('#gameAuthDesc').textContent=registering?'ZirveOkey ailesine katıl.':forgot?'Şifre sıfırlama bağlantısı için kayıtlı e-posta adresini gir.':'Hesabına giriş yap ve oyuna katıl.';
 $('#gameAuthSubmit').textContent=registering?'Üye Ol':forgot?'Sıfırlama Bağlantısı Gönder':'Giriş Yap';
 $('#gameAuthEmail').hidden=!(registering||forgot);
 $('#gameAuthEmail').required=registering||forgot;$('#gameAuthEmail').value='';
 $('#gameAuthIdentifier').hidden=forgot;
 $('#gameAuthIdentifier').required=!forgot;$('#gameAuthIdentifier').value='';$('#gameAuthIdentifier').placeholder=registering?'Kullanıcı adını gir':'Kullanıcı adı veya e-posta adresi';$('#gameAuthIdentifier').maxLength=registering?24:254;
 $('#gameAuthPassword').hidden=forgot;
 $('#gameAuthPassword').required=!forgot;$('#gameAuthPassword').value='';$('#gameAuthPassword').setAttribute('autocomplete',registering?'new-password':'current-password');
 $('#gameAuthProfileFields').hidden=!registering;
 $('#gameAuthCountry').required=registering;$('#gameAuthGender').required=registering;$('#gameAuthCountry').value='';$('#gameAuthGender').value='';
 $('#gameAuthLoginOptions').hidden=mode!=='login';
 $('#gameAuthSwitch').hidden=registering||forgot;
 $('#gameAuthLoginSwitch').hidden=!registering;
 $('#gameAuthMessage').textContent='';
 $('#gameLoginDialog').showModal();
}
let gameAuthCheckSequence=0;
async function refreshGameAccount(){
 const checkSequence=++gameAuthCheckSequence;
 let data;
 try{
  const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
  if(!r.ok)throw new Error('Oturum servisi kullanılamıyor');
  data=await r.json();
  if(data.authenticated===true&&!data.user)throw new Error('Oturum yanıtında kullanıcı bilgisi bulunamadı.');
 }catch(error){
  if(checkSequence!==gameAuthCheckSequence)return;
  // A network/5xx/JSON failure is not proof that the user's session ended.
  // Keep the last confirmed account state; only an explicit authenticated:false
  // response from /api/auth/me may switch the UI back to guest.
  $('#gameAccountState').textContent=gameSignedIn?'Bağlantı yenileniyor':'Oturum doğrulanamadı';
  if(!gameSignedIn){
   $('#gameAuthActions').hidden=false;$('#gameLogoutButton').hidden=true;
   $('#chatInput').placeholder='Oturum doğrulanamadı';
   $('#chatForm button[type="submit"]').disabled=true;
  }
  console.warn('Oyun hesabı geçici olarak doğrulanamadı; mevcut oturum durumu korundu:',error);
  return;
 }
 if(checkSequence!==gameAuthCheckSequence)return;
 const signed=data.authenticated===true;
 gameSignedIn=signed;chatDisplayEnabled=signed;
 if(!signed){chatMessagesBox.replaceChildren();renderedChatMessageIds.clear();}
 $('#gameUsername').textContent=signed?data.user.username:'Misafir Oyuncu';
 $('#gameAccountState').textContent=signed?'Üye hesabı':'Giriş yapılmadı';
 $('#gameUserAvatar').textContent=signed?data.user.username.slice(0,1).toLocaleUpperCase('tr-TR'):'M';
 $('#gameSeatUsername').textContent=signed?data.user.username:'Misafir Oyuncu';
 $('#gameSeatAvatar').textContent=signed?data.user.username.slice(0,1).toLocaleUpperCase('tr-TR'):'M';
 if(signed){try{await loadMemberAvatar();}catch(error){console.error('Profil avatarı yüklenemedi:',error);}}
 else paintMemberAvatar(null);
 $('#gameAuthActions').hidden=signed;$('#gameLogoutButton').hidden=!signed;
 $('#chatInput').disabled=false;$('#chatInput').placeholder=signed?'Mesajını yaz...':'Mesaj göndermek için üye ol';
 $('#chatForm button[type="submit"]').disabled=false;
 applyChatTextPreferences();
 // Profil/tercih uçları başarısız olsa bile doğrulanmış oturumu misafire düşürme.
 try{await loadChatStyle(signed,signed?data.user.id:null);}catch(error){console.error('Sohbet görünüm tercihleri yüklenemedi:',error);}
 try{await loadMemberSettings();}catch(error){console.error('Üye ayarları yüklenemedi:',error);}
}
$('#chatInput').addEventListener('focus',()=>{if(!gameSignedIn)requireGameMembership('Sohbete yazmak',()=>$('#chatInput').focus())});
 $('#chatInput').addEventListener('click',()=>{if(!gameSignedIn)requireGameMembership('Sohbete yazmak',()=>$('#chatInput').focus())});
 $('#gameLoginButton').addEventListener('click',()=>openGameAuth('login'));
$('#gameRegisterButton').addEventListener('click',()=>openGameAuth('register'));
$('#gameAuthClose').addEventListener('click',()=>$('#gameLoginDialog').close());
$('#gameAuthSwitch').addEventListener('click',()=>openGameAuth('register'));
$('#gameAuthLoginSwitch').addEventListener('click',()=>openGameAuth('login'));
$('#gameAuthForgotPassword').addEventListener('click',()=>openGameAuth('forgot'));
$('#gameAuthForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const mode=gameAuthMode,submit=$('#gameAuthSubmit');
 submit.disabled=true;submit.textContent='İşleniyor…';$('#gameAuthMessage').textContent='';
 let endpoint='/api/auth/'+mode,payload={};
 if(mode==='register'){
  payload={email:$('#gameAuthEmail').value.trim(),username:$('#gameAuthIdentifier').value.trim(),password:$('#gameAuthPassword').value,gender:$('#gameAuthGender').value,country:$('#gameAuthCountry').value};
 }else if(mode==='forgot'){
  endpoint='/api/auth/forgot-password';payload={email:$('#gameAuthEmail').value.trim()};
 }else{
  payload={username:$('#gameAuthIdentifier').value.trim(),password:$('#gameAuthPassword').value,rememberMe:$('#gameRememberMe').checked};
 }
 try{
  const r=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Üyelik işlemi tamamlanamadı.');
  if(mode==='forgot'){
   $('#gameAuthMessage').textContent=data.message||'Adres kayıtlıysa sıfırlama bağlantısı gönderilecektir.';
  }else{
   const verify=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});const verified=await verify.json().catch(()=>({}));
   if(!verify.ok||verified.authenticated!==true||String(verified.user?.id)!==String(data.user?.id))throw new Error('Giriş yanıtı alındı ancak oturum doğrulanamadı.');
   $('#gameLoginDialog').close();await refreshGameAccount();if(!gameSignedIn)throw new Error('Oturum oyun alanında doğrulanamadı.');
   await loadLobbyMessages(true);await sendPresenceHeartbeat();await sendActivityHeartbeat();notify('Hoş geldin, '+verified.user.username+'.');loadOnlineMembers();
   if(pendingMembershipAction){const resume=pendingMembershipAction;pendingMembershipAction=null;resume();}
  }
 }catch(error){$('#gameAuthMessage').textContent=error.message;}
 finally{submit.disabled=false;submit.textContent=mode==='register'?'Üye Ol':mode==='forgot'?'Sıfırlama Bağlantısı Gönder':'Giriş Yap';}
});
$('#gameLogoutButton').addEventListener('click',async()=>{
 try{const r=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});if(!r.ok)throw new Error('Çıkış yapılamadı.');await refreshGameAccount();chatMessagesBox.replaceChildren();renderedChatMessageIds.clear();chatLastId=0;loadOnlineMembers();notify('Oturum kapatıldı.');}
 catch(error){notify(error.message);}
});

refreshGameAccount().then(async()=>{await loadMemberSettings();await loadLobbyMessages(true);await loadOnlineMembers();sendPresenceHeartbeat();sendActivityHeartbeat();}).catch(error=>console.error('Hesap başlangıcı:',error));loadLobbyChatStyles();
window.setInterval(()=>{refreshGameAccount().catch(error=>console.error('Oturum yenileme hatası:',error));loadLobbyMessages(false);loadOnlineMembers();sendPresenceHeartbeat();sendActivityHeartbeat();},25000);
window.addEventListener('focus',()=>{refreshGameAccount().catch(error=>console.error('Oturum odak yenileme hatası:',error));});
window.addEventListener('pageshow',()=>{refreshGameAccount().catch(error=>console.error('Oturum sayfa yenileme hatası:',error));});
window.setInterval(loadLobbyChatStyles,10000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){loadLobbyMessages(false);loadLobbyChatStyles();loadOnlineMembers();sendPresenceHeartbeat();sendActivityHeartbeat();}});
renderTabs();renderLobby();renderRack();
})();