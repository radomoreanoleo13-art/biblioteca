/* ================= DATOS — ARCHIVOS DESDE EL CODIGO =================
   Editá este objeto para agregar/quitar archivos fijos (los que
   subís vos editando el código, no se pueden borrar desde la
   página). Cada categoría es un array de items:

   {
     nombre: "Nombre visible",
     desc: "Una línea corta describiendo qué es",
     fecha: "Ago 2026",          // opcional
     tamano: "1.2 MB",           // opcional, solo texto
     url: "https://...",         // si está hosteado afuera (Drive, etc)
     // -- o, en vez de url --
     data: "data:application/pdf;base64,XXXXX"  // archivo embebido chico
   }
============================================================ */
const SECCIONES = {
  libros: { label:"Libros", icon:"📚", items:[
    // { nombre:"Clean Code", desc:"Robert C. Martin", fecha:"2024", tamano:"4.1 MB", url:"https://..." },
  ]},
  apuntes: { label:"Apuntes", icon:"📝", items:[
    // { nombre:"Apuntes React Native", desc:"Notas del curso de Expo", fecha:"Jul 2026", tamano:"320 KB", data:"data:application/pdf;base64,..." },
  ]},
  tareas: { label:"Tareas", icon:"📋", items:[
    // { nombre:"Tarea 3 - Bases de Datos", desc:"Modelo entidad-relación", fecha:"Jun 2026", tamano:"180 KB", url:"https://..." },
  ]},
  trabajos: { label:"Trabajos", icon:"💼", items:[
    // { nombre:"App de finanzas", desc:"Proyecto final - React Native", fecha:"Ago 2026", tamano:"2.3 MB", url:"https://..." },
  ]}
};
/* ===================================================================== */

const STORE_KEY = 'mis-trabajos-uploads';
let uploads = { libros:[], apuntes:[], tareas:[], trabajos:[] };
let activeCat = Object.keys(SECCIONES)[0];
let pendingFile = null;

const shelf = document.getElementById('shelf');
const grid = document.getElementById('grid');
const panelTitle = document.getElementById('panelTitle');
const panelCount = document.getElementById('panelCount');
const searchInput = document.getElementById('searchInput');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const uploadPanel = document.getElementById('uploadPanel');
const fnameEl = document.getElementById('fname');
const catSelect = document.getElementById('catSelect');
const toastEl = document.getElementById('toast');

function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(()=>toastEl.classList.remove('show'), 2200);
}

function fmtSize(bytes){
  if(bytes < 1024) return bytes + ' B';
  if(bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(2) + ' MB';
}

function iconForType(type){
  if(!type) return '📄';
  if(type.startsWith('image/')) return '🖼';
  if(type.startsWith('video/')) return '🎬';
  if(type.startsWith('audio/')) return '🎧';
  if(type.includes('pdf')) return '📄';
  if(type.includes('zip')||type.includes('rar')||type.includes('compressed')) return '🗜';
  return '📦';
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

async function loadUploads(){
  try{
    const res = await window.storage.get(STORE_KEY, true);
    if(res) uploads = JSON.parse(res.value);
  }catch(e){ /* nada subido todavía */ }
}

async function saveUploads(){
  try{
    const res = await window.storage.set(STORE_KEY, JSON.stringify(uploads), true);
    if(!res) showToast('No se pudo guardar. Intenta de nuevo.');
  }catch(e){
    showToast('Error guardando: archivo muy pesado o sin conexión.');
  }
}

function allItemsFor(cat){
  return [
    ...SECCIONES[cat].items.map(it=>({...it, cat, fixed:true})),
    ...uploads[cat].map(it=>({...it, cat, fixed:false}))
  ];
}

function renderTabs(){
  shelf.innerHTML = '';
  Object.keys(SECCIONES).forEach(key=>{
    const sec = SECCIONES[key];
    const total = sec.items.length + uploads[key].length;
    const btn = document.createElement('button');
    btn.className = 'tab' + (key===activeCat ? ' active' : '');
    btn.dataset.cat = key;
    btn.innerHTML = `${sec.icon} ${sec.label} <span class="n">${total}</span>`;
    btn.addEventListener('click', ()=>{ activeCat = key; searchInput.value=''; render(); });
    shelf.appendChild(btn);
  });
}

function cardHtml(item){
  const href = item.url || item.data || '#';
  const secInfo = SECCIONES[item.cat];
  return `
    <div class="card">
      ${item.fixed ? '' : `<button class="card-del" data-id="${item.id}" data-cat="${item.cat}" title="Eliminar">✕</button>`}
      <span class="card-tag">${secInfo.icon} ${secInfo.label}</span>
      <div class="card-icon">${item.fixed ? secInfo.icon : iconForType(item.type)}</div>
      <div class="card-name">${escapeHtml(item.nombre)}</div>
      <div class="card-desc">${escapeHtml(item.desc)}</div>
      <div class="card-meta"><span>${escapeHtml(item.fecha)||''}</span><span>${escapeHtml(item.tamano)||''}</span></div>
      <div class="card-actions">
        <a class="card-dl" href="${href}" download="${item.nombre||''}" target="_blank" rel="noopener">Descargar</a>
      </div>
    </div>
  `;
}

function renderGrid(){
  const query = searchInput.value.trim().toLowerCase();

  if(query){
    shelf.classList.add('dimmed');
    let results = [];
    Object.keys(SECCIONES).forEach(cat=>{
      allItemsFor(cat).forEach(item=>{
        const hay = (item.nombre + ' ' + (item.desc||'')).toLowerCase();
        if(hay.includes(query)) results.push(item);
      });
    });
    panelTitle.textContent = `Resultados para "${searchInput.value.trim()}"`;
    panelCount.textContent = results.length + (results.length===1 ? ' resultado' : ' resultados');
    grid.innerHTML = results.length
      ? results.map(cardHtml).join('')
      : `<div class="empty" style="grid-column:1/-1;">No encontré nada con eso. Prueba otra palabra.</div>`;
  }else{
    shelf.classList.remove('dimmed');
    const sec = SECCIONES[activeCat];
    const items = allItemsFor(activeCat);
    panelTitle.textContent = sec.label;
    panelCount.textContent = items.length + (items.length===1 ? ' archivo' : ' archivos');
    grid.innerHTML = items.length
      ? items.map(cardHtml).join('')
      : `<div class="empty" style="grid-column:1/-1;">Todavía no hay nada acá en ${sec.label.toLowerCase()}.</div>`;
  }

  grid.querySelectorAll('.card-del').forEach(btn=>{
    btn.addEventListener('click', ()=>deleteUpload(btn.dataset.cat, btn.dataset.id));
  });
}

function render(){
  renderTabs();
  renderGrid();
}

async function deleteUpload(cat, id){
  uploads[cat] = uploads[cat].filter(x=>x.id!==id);
  render();
  await saveUploads();
  showToast('Eliminado');
}

/* ---- subir archivo ---- */
uploadBtn.addEventListener('click', ()=>fileInput.click());

fileInput.addEventListener('change', ()=>{
  if(!fileInput.files.length) return;
  pendingFile = fileInput.files[0];
  if(pendingFile.size > 4.5*1024*1024){
    showToast(pendingFile.name + ' es muy pesado (máx 4.5 MB).');
    fileInput.value = '';
    pendingFile = null;
    return;
  }
  fnameEl.textContent = pendingFile.name + ' · ' + fmtSize(pendingFile.size);
  catSelect.value = activeCat in SECCIONES ? activeCat : 'trabajos';
  uploadPanel.classList.add('show');
});

document.getElementById('cancelUpload').addEventListener('click', ()=>{
  uploadPanel.classList.remove('show');
  fileInput.value = '';
  pendingFile = null;
});

document.getElementById('confirmUpload').addEventListener('click', async ()=>{
  if(!pendingFile) return;
  const cat = catSelect.value;
  const reader = new FileReader();
  reader.onload = async ()=>{
    uploads[cat].push({
      id: Date.now() + '-' + Math.random().toString(36).slice(2,8),
      nombre: pendingFile.name,
      desc: '',
      fecha: new Date().toLocaleDateString('es-PE', {month:'short', year:'numeric'}),
      tamano: fmtSize(pendingFile.size),
      type: pendingFile.type,
      data: reader.result
    });
    activeCat = cat;
    uploadPanel.classList.remove('show');
    fileInput.value = '';
    pendingFile = null;
    render();
    await saveUploads();
    showToast('Subido a ' + SECCIONES[cat].label);
  };
  reader.readAsDataURL(pendingFile);
});

searchInput.addEventListener('input', renderGrid);

(async function init(){
  await loadUploads();
  render();
})();
