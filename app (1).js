const $=id=>document.getElementById(id);
const ld=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
// Pastas comuns
const FOLDERS=[{id:'mp3',name:'🎵 MP3'},{id:'filmes',name:'🎬 Filmes'},{id:'chaves',name:'📺 Seriado Chaves'},{id:'grafith',name:'🎸 Banda Grafith'}];
// Pastas com senha (criptografadas)
const LOCKED=[{id:'imagens',name:'Desbloquear funções PREMIUM',store:'mp_vault_img'},{id:'cofre',name:'🤖 SISTEMA',store:'mp_vault'}];
const V={};LOCKED.forEach(l=>V[l.id]={arr:null,key:null,salt:null,store:l.store});
const isL=id=>id in V;
const nameOf=id=>(FOLDERS.concat(LOCKED).find(f=>f.id===id)||{}).name||'';
let items=ld('mp_items',[]);
let cur=-1,playSrc='main',playCtx='all',view='all',shuffle=ld('mp_shuf',false),repeat=ld('mp_rep',true),speed=ld('mp_speed','1'),timer=null,el=null;
const icon={video:'🎞️',audio:'🎵',image:'🖼️'};
const arrOf=s=>s==='main'?items:(V[s].arr||[]);
const viewSrc=()=>isL(view)?view:'main';
const curItem=()=>arrOf(playSrc)[cur];
const inView=(it,s,v=view)=>s!=='main'?true:v==='fav'?!!it.fav:FOLDERS.some(f=>f.id===v)?it.folder===v:!it.folder;

// ---- Pastas com senha (AES-GCM, chave derivada da senha) ----
const b64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64=t=>Uint8Array.from(atob(t),c=>c.charCodeAt(0));
async function derive(pw,salt){
  const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function saveVault(id){
  const v=V[id];if(!v.key)return;
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},v.key,new TextEncoder().encode(JSON.stringify(v.arr)));
  sv(v.store,{s:b64(v.salt),i:b64(iv),d:b64(ct)});
}
async function unlock(){
  const id=view,v=V[id];if(!v)return;
  const pw=$('pw').value,m=$('vmsg');
  if(!crypto.subtle){m.textContent='Pasta com senha exige conexão segura (https).';return}
  const rec=ld(v.store,null);
  try{
    if(!rec){
      if(pw.length<4){m.textContent='Escolha uma senha com pelo menos 4 caracteres.';return}
      v.salt=crypto.getRandomValues(new Uint8Array(16));v.key=await derive(pw,v.salt);v.arr=[];await saveVault(id);
    }else{
      v.salt=unb64(rec.s);const k=await derive(pw,v.salt);
      const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(rec.i)},k,unb64(rec.d));
      v.key=k;v.arr=JSON.parse(new TextDecoder().decode(pt));
    }
    $('pw').value='';m.textContent='';vaultUI();render();
  }catch(e){m.textContent='Senha incorreta.'}
}
function stop(){clearTimeout(timer);$('stage').innerHTML='';$('playerCard').hidden=true;cur=-1;el=null}
function lock(id){
  if(playSrc===id)stop();
  V[id].arr=null;V[id].key=null;vaultUI();render();
}
function vaultUI(){
  const v=V[view];$('vaultBox').hidden=!v;
  if(v){
    const open=!!v.arr,has=!!ld(v.store,null);
    $('pw').hidden=open;$('unlock').hidden=open;$('lockBtn').hidden=!open;
    $('unlock').textContent=has?'Abrir pasta':'Criar senha da pasta';
    if(!open&&!has&&!$('vmsg').textContent)$('vmsg').textContent='Primeira vez: a senha que você digitar agora será a senha desta pasta. Se esquecer, não há como recuperar.';
  }
  refreshSelects();
}
function refreshSelects(){
  const d=$('dest');
  d.innerHTML='<option value="">📁 Salvar em: sem pasta</option>'
    +FOLDERS.map(f=>`<option value="${f.id}">${f.name}</option>`).join('')
    +LOCKED.filter(l=>V[l.id].arr).map(l=>`<option value="${l.id}">${l.name} 🔒</option>`).join('');
  d.value=[...d.options].some(o=>o.value===view)?view:'';
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)LOCKED.forEach(l=>{if(V[l.id].arr)lock(l.id)})});

// ---- Player ----
function detect(u){
  const p=u.split('?')[0].toLowerCase();
  if(/\.(mp4|webm|mkv|mov|m4v|ogv|m3u8)$/.test(p))return'video';
  if(/\.(mp3|m4a|aac|wav|ogg|oga|flac|opus)$/.test(p))return'audio';
  if(/\.(jpe?g|png|gif|webp|svg|bmp|avif)$/.test(p))return'image';
  return'video';
}
function fname(it){
  const last=decodeURIComponent(it.url.split('?')[0].split('/').pop()||'');
  return last||it.title.replace(/[^\w\-]+/g,'_');
}
const persist=s=>s==='main'?sv('mp_items',items):saveVault(s);
function visible(){return arrOf(viewSrc()).map((it,i)=>({it,i})).filter(o=>inView(o.it,viewSrc()))}
function render(){
  const l=$('list');l.innerHTML='';
  if(isL(view)&&!V[view].arr){l.innerHTML='<p class="mu">🔒 Pasta bloqueada.</p>';return}
  const v=visible();
  if(!v.length){l.innerHTML='<p class="mu">Nada por aqui ainda.</p>';return}
  v.forEach(({it,i})=>{
    const d=document.createElement('div');d.className='item'+(i===cur&&playSrc===viewSrc()?' cur':'');
    d.innerHTML=`<span>${icon[it.type]}</span><b></b><span class="tag"></span><span>${it.fav?'⭐':''}</span><button class="cp" title="Copiar link">📋</button><button class="x" title="Remover">×</button>`;
    d.querySelector('b').textContent=it.title;
    d.querySelector('.tag').textContent=(viewSrc()==='main'&&(view==='all'||view==='fav')&&it.folder)?nameOf(it.folder):'';
    d.onclick=()=>play(i);
    const cb=d.querySelector('.cp');
    cb.onclick=async e=>{e.stopPropagation();const ok=await copyText(it.url);cb.textContent=ok?'✔':'✖';setTimeout(()=>cb.textContent='📋',1500)};
    d.querySelector('.x').onclick=e=>{
      e.stopPropagation();const s=viewSrc();
      if(playSrc===s){if(cur===i)stop();else if(cur>i)cur--}
      arrOf(s).splice(i,1);persist(s);render();
    };
    l.appendChild(d);
  });
}
function play(i,s,ctx){
  s=s||viewSrc();playCtx=ctx||view;const arr=arrOf(s);
  if(i<0||i>=arr.length)return;
  clearTimeout(timer);playSrc=s;cur=i;const it=arr[i];
  $('playerCard').hidden=false;$('now').textContent=it.title;$('msg').textContent='';
  const st=$('stage');st.innerHTML='';
  el=document.createElement(it.type==='image'?'img':it.type);
  el.src=it.url;
  if(it.type==='image'){timer=setTimeout(next,5000)}
  else{el.controls=true;el.autoplay=true;el.preload='auto';el.playsInline=true;el.playbackRate=+speed;el.onended=next}
  el.onerror=()=>{$('msg').textContent='Não foi possível carregar este item. Pulando em 3 s...';timer=setTimeout(next,3000)};
  st.appendChild(el);
  $('fav').textContent=it.fav?'⭐ Favorito':'☆ Favoritar';
  render();scrollTo({top:0,behavior:'smooth'});
}
function pool(){
  const arr=arrOf(playSrc);
  const p=arr.map((it,i)=>i).filter(i=>inView(arr[i],playSrc,playCtx));
  return p.length?p:arr.map((_,i)=>i);
}
function next(){
  const p=pool();if(!p.length)return;
  if(shuffle){play(p[Math.floor(Math.random()*p.length)],playSrc,playCtx);return}
  const k=p.indexOf(cur);
  if(k>=0&&k<p.length-1)play(p[k+1],playSrc,playCtx);
  else if(repeat)play(p[0],playSrc,playCtx);
}
function prev(){const p=pool(),k=p.indexOf(cur);play(k>0?p[k-1]:p[p.length-1],playSrc,playCtx)}
function sync(){$('shuf').className=shuffle?'on':'sec';$('rep').className=repeat?'on':'sec';$('speed').value=speed}
$('shuf').onclick=()=>{shuffle=!shuffle;sv('mp_shuf',shuffle);sync()};
$('rep').onclick=()=>{repeat=!repeat;sv('mp_rep',repeat);sync()};
$('speed').onchange=e=>{speed=e.target.value;sv('mp_speed',speed);if(el&&el.playbackRate!==undefined)el.playbackRate=+speed};
$('next').onclick=next;$('prev').onclick=prev;
$('fav').onclick=()=>{const it=curItem();if(!it)return;it.fav=!it.fav;persist(playSrc);$('fav').textContent=it.fav?'⭐ Favorito':'☆ Favoritar';render()};

// ---- Abas ----
function buildTabs(){
  const t=$('tabs');t.innerHTML='';
  [{id:'all',name:'Todos'},{id:'fav',name:'⭐ Favoritos'}].concat(FOLDERS,LOCKED).forEach(f=>{
    const b=document.createElement('button');
    b.className=f.id===view?'on':'sec';b.textContent=f.name+(isL(f.id)?' 🔒':'');
    b.onclick=()=>setView(f.id);t.appendChild(b);
  });
  const p=document.createElement('button');p.className='sec';p.textContent='▶ Tocar tudo';p.onclick=playAll;t.appendChild(p);
}
function setView(v){view=v;$('vmsg').textContent='';buildTabs();vaultUI();render()}
function playAll(){
  const s=viewSrc();if(isL(s)&&!V[s].arr)return;
  const arr=arrOf(s),p=arr.map((_,i)=>i).filter(i=>inView(arr[i],s));
  if(p.length)play(shuffle?p[Math.floor(Math.random()*p.length)]:p[0],s);
}
$('unlock').onclick=unlock;
$('pw').onkeydown=e=>{if(e.key==='Enter')unlock()};
$('lockBtn').onclick=()=>{lock(view);$('vmsg').textContent='Pasta bloqueada.'};

// ---- Mover entre pastas ----
$('mvSel').innerHTML='<option value="">📁 Mover para...</option><option value="none">Sem pasta</option>'
  +FOLDERS.map(f=>`<option value="${f.id}">${f.name}</option>`).join('')
  +LOCKED.map(l=>`<option value="${l.id}">${l.name} 🔒</option>`).join('');
$('mvSel').onchange=async e=>{
  const to=e.target.value;e.target.value='';
  const it=curItem();if(!it||!to||to===playSrc)return;
  if(isL(to)&&!V[to].arr){$('msg').textContent='Abra a pasta '+nameOf(to)+' primeiro (na aba dela) para mover itens para lá.';return}
  if(!isL(to)&&playSrc==='main'){it.folder=to==='none'?'':to;persist('main');render();$('msg').textContent='Movido ✔';return}
  const from=playSrc;
  arrOf(from).splice(cur,1);
  if(isL(to)){it.folder='';V[to].arr.unshift(it)}else{it.folder=to==='none'?'':to;items.unshift(it)}
  persist('main');
  for(const id of [from,to])if(isL(id))await saveVault(id);
  stop();render();
};
$('add').onclick=()=>{
  const url=$('url').value.trim();if(!url)return;
  let type=$('type').value;if(type==='auto')type=detect(url);
  const title=$('title').value.trim()||decodeURIComponent(url.split('?')[0].split('/').pop())||'Sem título';
  const d=$('dest').value,to=(isL(d)&&V[d].arr)?d:'main';
  arrOf(to).unshift({title,url,type,fav:false,folder:to==='main'?d:''});persist(to);
  $('title').value='';$('url').value='';
  const dv=to==='main'?(d||'all'):to;setView(dv);play(0,to,dv);
};
async function copyText(t){
  try{await navigator.clipboard.writeText(t);return true}catch(e){}
  try{
    const a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;opacity:0';
    document.body.appendChild(a);a.select();const ok=document.execCommand('copy');a.remove();return ok;
  }catch(e){return false}
}
$('copy').onclick=async()=>{
  const it=curItem();if(!it)return;
  $('msg').textContent=(await copyText(it.url))?'Link copiado ✔ Agora é só colar no navegador.':'Não foi possível copiar. Use "Abrir" e copie o endereço da barra.';
};
$('open').onclick=()=>{const it=curItem();if(it)window.open(it.url,'_blank')};

// TV: Chromecast (Remote Playback API) e AirPlay (Safari)
$('cast').onclick=async()=>{
  const m=$('msg'),it=curItem();
  if(!el||!it){m.textContent='Toque em um item primeiro.';return}
  if(it.type==='image'){m.textContent='Imagens não podem ser transmitidas direto. Use "Transmitir tela" do celular ou do navegador.';return}
  el.disableRemotePlayback=false;
  try{
    if(el.remote){await el.remote.prompt();m.textContent='Transmitindo para a TV...'}
    else if(el.webkitShowPlaybackTargetPicker){el.webkitShowPlaybackTargetPicker()}
    else m.textContent='Este navegador não suporta transmissão direta. Use o Chrome (Chromecast) ou Safari (AirPlay), ou o menu do navegador > Transmitir.';
  }catch(e){
    m.textContent=e&&e.name==='NotFoundError'?'Nenhuma TV encontrada. Confirme que ela está na mesma rede Wi-Fi.':'Não foi possível transmitir. Tente o menu do navegador > Transmitir.';
  }
};

$('dl').onclick=async()=>{
  const it=curItem();if(!it)return;
  $('msg').textContent='Baixando...';
  try{
    const r=await fetch(it.url);if(!r.ok)throw 0;
    const b=await r.blob();
    const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fname(it);
    document.body.appendChild(a);a.click();a.remove();
    $('msg').textContent='Download iniciado ✔';
  }catch(e){
    const a=document.createElement('a');a.href=it.url;a.download=fname(it);a.target='_blank';a.rel='noopener';
    document.body.appendChild(a);a.click();a.remove();
    $('msg').textContent='O servidor bloqueou o download direto. O arquivo abriu em outra aba: use "Salvar como" ou segure o dedo sobre ele.';
  }
};
sync();buildTabs();vaultUI();render();
