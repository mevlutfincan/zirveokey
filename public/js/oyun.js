(()=>{'use strict';
const $=s=>document.querySelector(s);
const toast=$('#gameToast');let toastTimer;
function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2600)}
let tables=[],activeTable=null,selectedTile=null,idleTimer=null;
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
 $('#onlineCount').textContent='—';
}
function renderRack(){
 const root=$('#tileRack');root.innerHTML='';
 sampleTiles.forEach((tile,i)=>{const el=document.createElement('button');el.type='button';el.className='rack-tile '+tile.c+(selectedTile===i?' selected':'');el.textContent=tile.v;el.setAttribute('aria-label',tile.v+' numaralı taş');el.addEventListener('click',()=>{selectedTile=selectedTile===i?null:i;renderRack()});root.append(el)});
 $('#rackCount').textContent=sampleTiles.length+' taş • örnek dizilim';
}
function openTable(id){activeTable=id;const t=tables.find(x=>x.id===id);if(!t)return;$('#lobbyView').hidden=true;$('#tableView').hidden=false;$('#tableTitle').textContent='Masa '+String(t.id).padStart(3,'0');$('.table-number').textContent='MASA #'+String(t.id).padStart(3,'0');$('#roundStatus').textContent=t.type+' • Oyuncular bekleniyor';renderTabs();renderRack();resetIdleTimer()}
function closeTable(id){if(!confirm('Masayı kapatmak istediğinizden emin misiniz?'))return;clearIdleTimer();tables=tables.filter(t=>t.id!==id);if(activeTable===id){activeTable=null;$('#tableView').hidden=true;$('#lobbyView').hidden=false}renderTabs();renderLobby();lobbyNotice(String(id).padStart(3,'0')+' nolu masadan kendi isteğinle çıkış yaptın.');notify('Masa kapatıldı.')}
function createTable(){
 if(tables.length>=1){notify('Bu önizlemede aynı anda yalnızca bir masa açılabilir.');return}
 const name=$('#newTableName').value.trim()||'Klasik Okey';const id=1;
 tables.push({id,name,type:$('#gameType').value,privacy:$('#tablePrivacy').value,style:$('#tableStyle').value,isTest:true});activeTable=id;
 $('#createDialog').close();renderTabs();renderLobby();openTable(id);notify('Masa arayüzü oluşturuldu. Oyun sunucusu henüz bağlı değil.');
}
$('#openCreateTable').addEventListener('click',()=>$('#createDialog').showModal());
$('#lobbyCreateTable').addEventListener('click',()=>$('#createDialog').showModal());
$('.lobby-tab').addEventListener('click',()=>{clearIdleTimer();activeTable=null;$('#tableView').hidden=true;$('#lobbyView').hidden=false;renderTabs();});
$('#createTableForm').addEventListener('submit',e=>{e.preventDefault();createTable()});
$('#leaveTable').addEventListener('click',()=>{if(!activeTable)return;const id=activeTable;if(!confirm('Masadan çıkmak istediğinizden emin misiniz?'))return;clearIdleTimer();tables=tables.filter(t=>t.id!==id);activeTable=null;$('#tableView').hidden=true;$('#lobbyView').hidden=false;renderTabs();renderLobby();lobbyNotice(String(id).padStart(3,'0')+' nolu masadan kendi isteğinle çıkış yaptın.');notify('Masadan ayrıldın.')});
$('#sortTiles').addEventListener('click',()=>{sampleTiles.sort((a,b)=>a.c.localeCompare(b.c)||a.v-b.v);selectedTile=null;renderRack();notify('Taşlar renge ve sayıya göre sıralandı (örnek).')});
$('#sortPairs').addEventListener('click',()=>{sampleTiles.sort((a,b)=>a.v-b.v);selectedTile=null;renderRack();notify('Çift dizme önizlemesi uygulandı.')});
$('#discardTile').addEventListener('click',()=>{if(selectedTile===null){notify('Önce atmak istediğin taşı seç.');return}const tile=sampleTiles.splice(selectedTile,1)[0];discarded.push(tile);const target=$('#discardedTile');target.textContent=tile.v;target.classList.add('has-tile');target.style.color=tile.c==='red'?'#d42e29':tile.c==='blue'?'#2566c6':tile.c==='yellow'?'#c49b18':'#171717';selectedTile=null;renderRack();notify('Taş atma görsel önizlemesi uygulandı.');});
$('#startGame').addEventListener('click',()=>notify('Oyun motoru henüz bağlı değil.'));
$('#tableView').addEventListener('pointerdown',resetIdleTimer);
$('#tableView').addEventListener('keydown',resetIdleTimer);
$('#chatForm').addEventListener('submit',e=>{e.preventDefault();const input=$('#chatInput');if(!input.value.trim())return;notify('Sohbet sunucusu bağlı olmadığı için mesaj gönderilmedi.');input.value='';});
renderTabs();renderLobby();renderRack();
})();