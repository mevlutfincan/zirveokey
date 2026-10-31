(()=>{'use strict';
const $=s=>document.querySelector(s);
const toast=$('#gameToast');let toastTimer;
function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2600)}
let tables=[],activeTable=null,selectedTile=null,idleTimer=null;
let gameSignedIn=false,pendingMembershipAction=null;
function requireGameMembership(action,onSuccess){if(gameSignedIn)return true;pendingMembershipAction=typeof onSuccess==='function'?onSuccess:null;openGameAuth('register');$('#gameAuthMessage').textContent=action+' için önce ücretsiz üyelik oluşturmalısın.';notify('Devam etmek için üye olmalısın.');return false;}
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
 const defaultChatStyle={nameColor:'#111111',textColor:'#111111'};
 const fixedChatRowColor='rgba(232,239,232,.92)';
 function validChatHex(value){return /^#[0-9a-f]{6}$/i.test(String(value||''));}
 function updateChatColorPreview(){
  const name=$('#chatNameColor').value,text=$('#chatBodyColor').value;
  $('#chatColorPreview').style.setProperty('--chat-row-color',fixedChatRowColor);
  $('#chatColorPreviewName').style.color=name;$('#chatColorPreviewText').style.color=text;
  $('#chatColorSave').disabled=!chatStyleAuthenticated||chatStyleSaving;
  $('#chatColorStatus').textContent=!chatStyleAuthenticated?'Renkleri kaydetmek için giriş yapın.':chatStyleSaving?'Kaydediliyor…':'Seçtiğin tüm renkler kaydedilebilir ve diğer üyelere aynen görünür.';
 }
 function setChatColorInputs(style){
  $('#chatNameColor').value=validChatHex(style?.nameColor)?style.nameColor:defaultChatStyle.nameColor;
  $('#chatBodyColor').value=validChatHex(style?.textColor)?style.textColor:defaultChatStyle.textColor;
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
  if(chatStyleAccountId)applyLobbyChatStyles([{id:chatStyleAccountId,chat_name_color:savedStyle.nameColor,chat_text_color:savedStyle.textColor}]);
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
  item.style.setProperty('--chat-author-color',nameColor);item.style.setProperty('--chat-body-color',textColor);item.style.setProperty('--chat-row-color',fixedChatRowColor);
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
   chatMessagesBox.querySelectorAll('.chat-message').forEach(item=>{
    if(item.dataset.userId!==userId)return;
    item.style.setProperty('--chat-author-color',nameColor);
    item.style.setProperty('--chat-body-color',textColor);
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
  const data=await r.json(),root=$('#onlineList');root.innerHTML='';
  (data.members||[]).forEach(member=>{
   const row=document.createElement('div');row.className='online-member';
   const dot=document.createElement('i');dot.className='online-member-dot';
   const name=document.createElement('b');name.textContent=member.username;
   row.append(dot,name);root.append(row);
  });
  if(!root.children.length){const empty=document.createElement('div');empty.className='side-empty';empty.innerHTML='<span>♙</span><b>Şu anda çevrimiçi üye yok</b>';root.append(empty);}
  updateOnlineCount(Number(data.count)||0);
 }catch(error){console.warn('Çevrimiçi üye listesi yüklenemedi.');}
}
async function sendPresenceHeartbeat(){
 try{await fetch('/api/presence/heartbeat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({showOnline:readMemberSettings().settingShowOnline!==false})});}
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
notificationsButton.addEventListener('click',()=>{
 const opening=notificationsPopover.hidden;
 notificationsPopover.hidden=!opening;
 notificationsButton.setAttribute('aria-expanded',String(opening));
});
document.addEventListener('click',e=>{
 if(!notificationsPopover.hidden&&!notificationsPopover.contains(e.target)&&!notificationsButton.contains(e.target)){
  notificationsPopover.hidden=true;notificationsButton.setAttribute('aria-expanded','false');
 }
});

const settingsDialog=$('#memberSettingsDialog');
const settingsKeys=['settingAnimations','settingDarkMode','settingNotifications','settingShowOnline'];
function applyMemberSettings(values){
 document.body.classList.toggle('member-reduce-motion',!values.settingAnimations);
 document.body.classList.toggle('member-light-theme',!values.settingDarkMode);
 $('#notificationsButton').hidden=!values.settingNotifications;
 $('.user-online-count').hidden=!values.settingShowOnline;
}
function readMemberSettings(){
 const defaults={settingAnimations:true,settingDarkMode:true,settingNotifications:true,settingShowOnline:true};
 try{return {...defaults,...JSON.parse(localStorage.getItem('zirveMemberSettings')||'{}')}}catch{return defaults}
}
function loadMemberSettings(){
 const values=readMemberSettings();
 settingsKeys.forEach(id=>{$('#'+id).checked=!!values[id]});
 applyMemberSettings(values);
}
$('#settingsButton').addEventListener('click',()=>{loadMemberSettings();settingsDialog.showModal()});
$('#memberSettingsForm').addEventListener('submit',e=>{
 e.preventDefault();
 const values={};settingsKeys.forEach(id=>values[id]=$('#'+id).checked);
 try{localStorage.setItem('zirveMemberSettings',JSON.stringify(values))}catch{}
 applyMemberSettings(values);
 settingsDialog.close();
 sendPresenceHeartbeat();
 loadOnlineMembers();
 notify('Üye ayarların kaydedildi.');
});
settingsDialog.addEventListener('click',e=>{if(e.target===settingsDialog)settingsDialog.close()});
loadMemberSettings();

const fullscreenButton=$('#fullscreenButton');
fullscreenButton.addEventListener('click',async()=>{
 try{
  if(!document.fullscreenElement)await document.documentElement.requestFullscreen();
  else await document.exitFullscreen();
 }catch(error){notify('Tam ekran bu tarayıcıda kullanılamıyor.');}
});
document.addEventListener('fullscreenchange',()=>{
 const active=!!document.fullscreenElement;
 fullscreenButton.textContent=active?'⛶':'⛶';
 fullscreenButton.title=active?'Tam ekrandan çık':'Tam ekran';
 fullscreenButton.setAttribute('aria-label',active?'Tam ekrandan çık':'Tam ekran');
});


let gameAuthMode='login';
function openGameAuth(mode='login'){
 gameAuthMode=mode;
 const registering=mode==='register',forgot=mode==='forgot';
 $('#gameAuthTitle').textContent=registering?'Üye Ol':forgot?'Şifremi Unuttum':'Giriş Yap';
 $('#gameAuthDesc').textContent=registering?'ZirveOkey ailesine katıl.':forgot?'Şifre sıfırlama bağlantısı için kayıtlı e-posta adresini gir.':'Hesabına giriş yap ve oyuna katıl.';
 $('#gameAuthSubmit').textContent=registering?'Üye Ol':forgot?'Sıfırlama Bağlantısı Gönder':'Giriş Yap';
 $('#gameAuthEmailRow').hidden=!(registering||forgot);
 $('#gameAuthEmail').required=registering||forgot;$('#gameAuthEmail').value='';
 $('#gameAuthIdentifierLabel').hidden=forgot;
 $('#gameAuthIdentifier').required=!forgot;$('#gameAuthIdentifier').value='';$('#gameAuthIdentifier').placeholder='Kullanıcı adını gir';$('#gameAuthIdentifier').maxLength=24;
 $('#gameAuthPasswordRow').hidden=forgot;
 $('#gameAuthPassword').required=!forgot;$('#gameAuthPassword').value='';$('#gameAuthPassword').setAttribute('autocomplete',registering?'new-password':'current-password');
 $('#gameAuthProfileFields').hidden=!registering;
 $('#gameAuthCountry').required=registering;$('#gameAuthGender').required=registering;$('#gameAuthCountry').value='';$('#gameAuthGender').value='';
 $('#gameAuthLoginOptions').hidden=mode!=='login';
 $('#gameAuthSwitch').hidden=registering||forgot;
 $('#gameAuthLoginSwitch').hidden=!registering;
 $('#gameAuthMessage').textContent='';
 $('#gameLoginDialog').showModal();
}
async function refreshGameAccount(){
 try{
  const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
  if(!r.ok)throw new Error('Oturum servisi kullanılamıyor');
  const data=await r.json(),signed=!!data.authenticated;
  gameSignedIn=signed;
  chatDisplayEnabled=signed;
  if(!signed){chatMessagesBox.replaceChildren();renderedChatMessageIds.clear();}
  $('#gameUsername').textContent=signed?data.user.username:'Misafir Oyuncu';
  $('#gameAccountState').textContent=signed?'Üye hesabı':'Giriş yapılmadı';
  $('#gameUserAvatar').textContent=signed?data.user.username.slice(0,1).toLocaleUpperCase('tr-TR'):'M';
  $('#gameAuthActions').hidden=signed;$('#gameLogoutButton').hidden=!signed;
  $('#chatInput').disabled=false;$('#chatInput').placeholder=signed?'Mesajını yaz...':'Mesaj göndermek için üye ol';
  $('#chatForm button[type="submit"]').disabled=false;
  applyChatTextPreferences();
  await loadChatStyle(signed,signed?data.user.id:null);
 }catch(error){$('#gameAccountState').textContent='Hesap bağlantısı yok';}
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
   $('#gameLoginDialog').close();await refreshGameAccount();await loadLobbyMessages(true);await sendPresenceHeartbeat();await sendActivityHeartbeat();notify('Hoş geldin, '+data.user.username+'.');loadOnlineMembers();
   if(mode==='register'&&pendingMembershipAction){const resume=pendingMembershipAction;pendingMembershipAction=null;resume();}
  }
 }catch(error){$('#gameAuthMessage').textContent=error.message;}
 finally{submit.disabled=false;submit.textContent=mode==='register'?'Üye Ol':mode==='forgot'?'Sıfırlama Bağlantısı Gönder':'Giriş Yap';}
});
$('#gameLogoutButton').addEventListener('click',async()=>{
 try{const r=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});if(!r.ok)throw new Error('Çıkış yapılamadı.');await refreshGameAccount();chatMessagesBox.replaceChildren();renderedChatMessageIds.clear();chatLastId=0;loadOnlineMembers();notify('Oturum kapatıldı.');}
 catch(error){notify(error.message);}
});

refreshGameAccount().then(()=>loadLobbyMessages(true));loadLobbyChatStyles();loadOnlineMembers();sendPresenceHeartbeat();sendActivityHeartbeat();
window.setInterval(()=>{loadLobbyMessages(false);loadOnlineMembers();sendPresenceHeartbeat();sendActivityHeartbeat();},25000);
window.setInterval(loadLobbyChatStyles,1000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){loadLobbyMessages(false);loadLobbyChatStyles();loadOnlineMembers();sendPresenceHeartbeat();sendActivityHeartbeat();}});
renderTabs();renderLobby();renderRack();
})();