
const DB='armario-inteligente-v1',TABLE='prendas';let db,items=[],activeFilter='Todas',selectedSuggestion=[],editingId=null,cropImg=null,cropScale=1,cropX=0,cropY=0,cropDrag=null,croppedData=null;
const $=id=>document.getElementById(id);
function openDB(){return new Promise((resolve,reject)=>{let r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(TABLE,{keyPath:'id'});r.onsuccess=()=>{db=r.result;resolve()};r.onerror=()=>reject(r.error)})}
function store(mode,fn){return new Promise((resolve,reject)=>{let tx=db.transaction(TABLE,mode),r=fn(tx.objectStore(TABLE));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function safe(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function go(id){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.id===id));if(id==='armario')renderWardrobe();if(id==='looks')renderSaved();window.scrollTo(0,0)}
function tile(p,showDelete=true){let colors=[p.color,p.color2].filter(Boolean).join(' + ');return '<article class="garment"><img src="'+p.photo+'" alt="'+safe(p.name)+'"><div class="info"><strong>'+safe(p.name)+'</strong><div class="meta">'+safe(p.category)+' · '+safe(colors)+'</div><span class="tag">'+safe(p.style)+'</span><span class="tag">'+safe(p.print||'Liso')+'</span><span class="tag">'+safe(p.season)+'</span>'+(showDelete?'<div class="row" style="margin-top:8px"><button class="btn light" onclick="editItem(\\''+p.id+'\\')">Editar</button><button class="btn red" onclick="removeItem(\\''+p.id+'\\')">Eliminar</button></div>':'')+'</div></article>'}
function refresh(){ $('count').textContent=items.length;$('lookCount').textContent=JSON.parse(localStorage.getItem('armarioLooks')||'[]').length;$('homeRecent').innerHTML=items.length?'<div class="panel"><h2>Últimas prendas</h2><div class="grid">'+items.slice(-2).reverse().map(p=>tile(p,false)).join('')+'</div></div>':'<div class="empty"><span>👚</span>Tu armario empieza aquí. Añade una prenda para verla aparecer.</div>';renderWardrobe();renderSaved()}
function renderWardrobe(){if(!$('wardrobeGrid'))return;let cats=['Todas',...new Set(items.map(p=>p.category))];$('filters').innerHTML=cats.map(c=>'<button class="'+(activeFilter===c?'sel':'')+'" onclick="setFilter(\''+safe(c)+'\')">'+safe(c)+'</button>').join('');let a=items.filter(p=>activeFilter==='Todas'||p.category===activeFilter);$('wardrobeGrid').innerHTML=a.length?a.map(p=>tile(p)).join(''):'<div class="empty" style="grid-column:1/-1"><span>🧥</span>Aún no hay prendas. Pulsa «Añadir» para empezar.</div>'}
function setFilter(c){activeFilter=c;renderWardrobe()}
$('photo').addEventListener('change',e=>{let f=e.target.files[0];if(f)startCrop(f)});
function startCrop(file){let url=URL.createObjectURL(file),im=new Image();im.onload=()=>{cropImg=im;cropScale=1;cropX=0;cropY=0;$('zoom').value=1;$('cropPanel').hidden=false;$('preview').hidden=true;drawCrop();URL.revokeObjectURL(url)};im.src=url}
function drawCrop(){if(!cropImg)return;let c=$('cropCanvas'),ctx=c.getContext('2d'),w=c.width,h=c.height,base=Math.max(w/cropImg.width,h/cropImg.height),sc=base*cropScale,iw=cropImg.width*sc,ih=cropImg.height*sc;cropX=Math.max(w-iw,Math.min(0,cropX));cropY=Math.max(h-ih,Math.min(0,cropY));ctx.fillStyle='#eee5dc';ctx.fillRect(0,0,w,h);ctx.drawImage(cropImg,cropX,cropY,iw,ih)}
$('zoom').addEventListener('input',e=>{cropScale=Number(e.target.value);drawCrop()});
$('cropCanvas').addEventListener('pointerdown',e=>{cropDrag={x:e.clientX,y:e.clientY,ox:cropX,oy:cropY};e.currentTarget.setPointerCapture(e.pointerId)});
$('cropCanvas').addEventListener('pointermove',e=>{if(!cropDrag)return;let r=e.currentTarget.getBoundingClientRect();cropX=cropDrag.ox+(e.clientX-cropDrag.x)*320/r.width;cropY=cropDrag.oy+(e.clientY-cropDrag.y)*320/r.height;drawCrop()});
$('cropCanvas').addEventListener('pointerup',()=>cropDrag=null);$('cropCanvas').addEventListener('pointercancel',()=>cropDrag=null);
let garmentModel=null;
async function analyzeGarment(){
 const status=$('analysisStatus'),btn=$('analyzeBtn'),photo=croppedData;
 if(!photo){status.textContent='Selecciona una foto y confirma el recorte primero.';return}
 btn.disabled=true;status.textContent='Cargando el modelo en este dispositivo…';
 try{
  if(!window.mobilenet||!window.tf)throw Error('No se pudo cargar el modelo. Comprueba la conexión.');
  if(!garmentModel){await tf.ready();garmentModel=await mobilenet.load({version:2,alpha:1.0})}
  const im=new Image();im.src=photo;await im.decode();
  const preds=await garmentModel.classify(im,5);const labels=preds.map(x=>x.className.toLowerCase()).join(' ');
  const rules=[[/running shoe|sneaker|loafer|clog|boot|sandal|high heel|shoe/,'Calzado','Calzado'],[/jean|denim|trouser|pant|shorts|skirt|miniskirt/,'Parte de abajo','Pantalón o falda'],[/jersey|sweatshirt|cardigan|sweater|shirt|tee shirt|t-shirt|polo|coat|jacket/,'Parte de arriba','Prenda de arriba'],[/dress|gown/,'Vestido / Mono','Vestido'],[/backpack|handbag|purse|scarf|necklace/,'Accesorio','Accesorio']];
  let found=null;for(const rule of rules){if(rule[0].test(labels)){found=rule;break}}
  if(found){$('category').value=found[1];if(!$('name').value.trim())$('name').value=found[2]}
  if(/running shoe|sneaker|jersey|sweatshirt/i.test(labels))$('style').value='Deportivo';
  const c=document.createElement('canvas');c.width=48;c.height=48;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0,48,48);const d=ctx.getImageData(0,0,48,48).data;let rr=0,gg=0,bb=0,n=0;for(let i=0;i<d.length;i+=16){rr+=d[i];gg+=d[i+1];bb+=d[i+2];n++}rr/=n;gg/=n;bb/=n;
  const mx=Math.max(rr,gg,bb),mn=Math.min(rr,gg,bb),h=Math.atan2(Math.sqrt(3)*(gg-bb),2*rr-gg-bb)*180/Math.PI;let color=mx<65?'Negro':mn>220?'Blanco':mx-mn<28?(mx<145?'Gris':'Beige'):h<0?'Rojo':h<45?'Marrón':h<75?'Amarillo':h<165?'Verde':h<205?'Turquesa':h<255?'Azul':'Morado';if([...$('color').options].some(o=>o.text===color))$('color').value=color;
  status.textContent='Sugerencias: '+preds.slice(0,3).map(p=>p.className+' ('+Math.round(p.probability*100)+'%)').join(' · ')+'. Revisa los campos: el modelo general puede confundir prendas.';
 }catch(e){status.textContent=e.message||'No se ha podido analizar la imagen.'}finally{btn.disabled=false}
}
function applyCrop(){croppedData=$('cropCanvas').toDataURL('image/jpeg',.88);$('preview').src=croppedData;$('preview').hidden=false;$('cropPanel').hidden=true};$('analyzeBtn').disabled=false;$('analysisStatus').textContent='Foto lista. Pulsa Analizar foto automáticamente.'
function editItem(id){let p=items.find(x=>x.id===id);if(!p)return;editingId=id;croppedData=p.photo;$('name').value=p.name||'';$('category').value=p.category||'Parte de arriba';$('style').value=p.style||'Casual';$('color').value=p.color||'Negro';$('color2').value=p.color2||'';$('print').value=p.print||'Liso';$('season').value=p.season||'Todo el año';$('notes').value=p.notes||'';$('preview').src=p.photo;$('preview').hidden=false;$('photo').required=false;$('saveGarment').textContent='Guardar cambios';$('cancelEdit').hidden=false;document.querySelector('#add h2').textContent='Editar prenda';go('add')}
function cancelEdit(){editingId=null;croppedData=null;$('form').reset();$('preview').hidden=true;$('cropPanel').hidden=true;$('photo').required=true;$('saveGarment').textContent='Guardar prenda';$('cancelEdit').hidden=true;document.querySelector('#add h2').textContent='Nueva prenda'}
$('form').addEventListener('submit',async e=>{e.preventDefault();let old=editingId?items.find(x=>x.id===editingId):null,photo=croppedData||(old&&old.photo);if(!photo){alert('Elige una foto y confirma el recorte.');return}let p={...(old||{}),id:editingId||crypto.randomUUID(),photo,name:$('name').value.trim(),category:$('category').value,style:$('style').value,color:$('color').value,color2:$('color2').value,print:$('print').value,season:$('season').value,notes:$('notes').value,added:old?.added||Date.now(),worn:old?.worn||0};await store('readwrite',st=>st.put(p));if(old)items=items.map(x=>x.id===p.id?p:x);else items.push(p);e.target.reset();$('preview').hidden=true;$('cropPanel').hidden=true;$('photo').required=true;editingId=null;croppedData=null;$('saveGarment').textContent='Guardar prenda';$('cancelEdit').hidden=true;document.querySelector('#add h2').textContent='Nueva prenda';refresh();go('armario')});

async function removeItem(id){if(!confirm('¿Eliminar esta prenda del armario?'))return;await store('readwrite',s=>s.delete(id));items=items.filter(p=>p.id!==id);refresh()}
const neutrals=['Negro','Blanco','Beige','Marrón','Gris','Azul marino'];
function matchesSeason(p,w){return w==='Todo el año'||p.season==='Todo el año'||p.season===w}
function makeSuggestion(){
let season=$('wantSeason').value,occasion=$('wantOccasion').value;
let allowed=occasion==='Deporte'?['Deportivo','Versátil','Ambos']:occasion==='Oficina'||occasion==='Elegante'||occasion==='Fiesta'?['Elegante','Formal','Versátil','Ambos']:['Casual','Versátil','Ambos'];
let pool=items.filter(p=>matchesSeason(p,season)&&allowed.includes(p.style)&&(occasion==='Deporte'||(p.category!=='Ropa deportiva'&&p.style!=='Deportivo')));
let pick=a=>a.length?a[Math.floor(Math.random()*a.length)]:null;
let dresses=pool.filter(p=>p.category==='Vestido / Mono'),tops=pool.filter(p=>p.category==='Parte de arriba'),bottoms=pool.filter(p=>p.category==='Parte de abajo');
let chosen=[],dress=pick(dresses);
if(dress)chosen=[dress];
else{
 let top=pick(tops),bottom=null;
 if(top){
  let candidates=bottoms.filter(b=>{
   let topSport=top.style==='Deportivo'||top.category==='Ropa deportiva',bottomSport=b.style==='Deportivo'||b.category==='Ropa deportiva';
   if(topSport!==bottomSport)return false;
   let topPattern=top.print&&top.print!=='Liso',bottomPattern=b.print&&b.print!=='Liso';
   if(topPattern&&bottomPattern)return false;
   let tc=[top.color,top.color2].filter(Boolean),bc=[b.color,b.color2].filter(Boolean);
   return tc.some(c=>bc.includes(c)||['Negro','Blanco','Marfil','Beige','Crudo','Gris','Azul marino'].includes(c))||bc.some(c=>['Negro','Blanco','Marfil','Beige','Crudo','Gris','Azul marino'].includes(c));
  });
  bottom=pick(candidates);
  if(bottom)chosen=[top,bottom];
 }
}
if(occasion==='Deporte'&&!chosen.length){let active=pick(pool.filter(p=>p.category==='Ropa deportiva'));if(active)chosen=[active]}
let shoesPool=pool.filter(p=>p.category==='Calzado');
if(occasion==='Deporte')shoesPool=shoesPool.filter(p=>/zapatill|deportiv|running|sport/i.test(p.name+' '+p.notes+' '+p.style));
else shoesPool=shoesPool.filter(p=>!/botas de montaña|zapatilla deportiva|running|sport/i.test(p.name+' '+p.notes));
let shoes=pick(shoesPool);if(shoes&&chosen.length)chosen.push(shoes);
let coats=pool.filter(p=>p.category==='Abrigo');if(['Otoño','Invierno'].includes(season)&&chosen.length){let coat=pick(coats);if(coat)chosen.push(coat)}
selectedSuggestion=chosen.map(p=>p.id);
$('suggestion').innerHTML=chosen.length?'<div class="panel"><div class="eyebrow">Propuesta · '+safe(occasion)+'</div><div class="grid">'+chosen.map(p=>tile(p,false)).join('')+'</div><p class="muted">He priorizado prendas de la misma ocasión y estilo, y he evitado mezclar estampados protagonistas. La compatibilidad depende también de las notas y el nombre que añadas a cada prenda.</p><div class="row"><button class="btn" onclick="saveSuggestion()">Guardar look</button><button class="btn light" onclick="makeSuggestion()">Probar otro</button></div></div>':'<div class="panel empty"><span>🪄</span>No encuentro prendas suficientes y compatibles para esta ocasión. Añade más prendas de ese estilo o prueba otra ocasión.</div>';
}
function saveSuggestion(){if(!selectedSuggestion.length)return;let a=JSON.parse(localStorage.getItem('armarioLooks')||'[]');a.unshift({ids:selectedSuggestion,date:new Date().toLocaleDateString('es-ES')});localStorage.setItem('armarioLooks',JSON.stringify(a));refresh();alert('Look guardado en tu colección.')}
function renderSaved(){let a=JSON.parse(localStorage.getItem('armarioLooks')||'[]');$('savedLooks').innerHTML=a.length?a.map((l,i)=>'<div class="lookitem"><div style="flex:1"><strong>Look '+(a.length-i)+'</strong><div class="meta">'+safe(l.date)+' · '+l.ids.length+' prendas</div></div><button class="btn red" onclick="deleteLook('+i+')">Borrar</button></div>'+l.ids.map(id=>items.find(p=>p.id===id)).filter(Boolean).map(p=>'<div class="lookitem"><img src="'+p.photo+'"><div><strong>'+safe(p.name)+'</strong><div class="meta">'+safe(p.category)+'</div></div></div>').join('')).join(''):'Todavía no has guardado ningún look.'}
function deleteLook(i){let a=JSON.parse(localStorage.getItem('armarioLooks')||'[]');a.splice(i,1);localStorage.setItem('armarioLooks',JSON.stringify(a));refresh()}
function backup(){let data={version:1,prendas:items,looks:JSON.parse(localStorage.getItem('armarioLooks')||'[]')};let url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));let a=document.createElement('a');a.href=url;a.download='copia-mi-armario.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function restore(e){let f=e.target.files[0];if(!f)return;try{let data=JSON.parse(await f.text());if(!Array.isArray(data.prendas))throw Error('Formato incorrecto');for(let p of data.prendas)await store('readwrite',s=>s.put(p));items=await store('readonly',s=>s.getAll());localStorage.setItem('armarioLooks',JSON.stringify(data.looks||[]));refresh();alert('Copia importada correctamente.')}catch(err){alert('No se ha podido importar. Comprueba que sea una copia de Mi Armario Inteligente.')}e.target.value=''}
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
openDB().then(()=>store('readonly',s=>s.getAll())).then(data=>{items=data;refresh()}).catch(err=>console.error(err));
