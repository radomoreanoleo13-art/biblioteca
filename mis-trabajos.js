const SUPABASE_URL = 'https://lfgrnnspnkggrxmfxzhs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cYHxv4FDcYVupETGgIsK_Q_Al_t4bXk';
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

/* =================
   DATOS — ARCHIVOS DESDE EL CODIGO
   Editá este objeto para agregar/quitar archivos fijos (los que subís vos
   editando el código, no se pueden borrar desde la página).
   Cada categoría es un array de items:
   { nombre, desc, fecha, tamano, url  ó  data }
================= */
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
let pendingFiles = [];

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
  try {
    const { data, error } = await supabaseClient
      .from('archivos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    uploads = { libros: [], apuntes: [], tareas: [], trabajos: [] };
    data.forEach(item => {
      if (uploads[item.categoria]) {
        uploads[item.categoria].push({
          id: item.id,
          nombre: item.nombre,
          desc: item.desc || '',
          fecha: item.fecha || '',
          tamano: item.tamano || '',
          type: item.type || '',
          url: item.url
        });
      }
    });
  } catch (e) {
    console.error('Error cargando archivos:', e);
    showToast('No se pudieron cargar los archivos');
  }
}

async function saveUploads(){
  const value = JSON.stringify(uploads);
  try{
    if(window.storage && typeof window.storage.set === 'function'){
      const res = await window.storage.set(STORE_KEY, value, true);
      if(res) return;
    }else{
      localStorage.setItem(STORE_KEY, value);
      return;
    }
  }catch(e){
    try{
      localStorage.setItem(STORE_KEY, value);
      return;
    }catch(localError){
      /* no se pudo guardar tampoco en local */
    }
  }
  showToast('No se pudo guardar. Intenta de nuevo.');
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
    btn.addEventListener('click', ()=>{
      activeCat = key;
      searchInput.value='';
      render();
    });
    shelf.appendChild(btn);
  });
}

function cardHtml(item){
  const href = item.url || item.data || '#';
  const secInfo = SECCIONES[item.cat];
  return `<div class="card">
    ${item.fixed ? '' : `<button class="card-del" data-id="${item.id}" data-cat="${item.cat}" title="Eliminar">✕</button>`}
    <span class="card-tag">${secInfo.icon} ${secInfo.label}</span>
    <div class="card-icon">${item.fixed ? secInfo.icon : iconForType(item.type)}</div>
    <div class="card-name">${escapeHtml(item.nombre)}</div>
    <div class="card-desc">${escapeHtml(item.desc)}</div>
    <div class="card-meta"><span>${escapeHtml(item.fecha)||''}</span><span>${escapeHtml(item.tamano)||''}</span></div>
    <div class="card-actions">
      <a class="card-dl" href="${href}" download="${item.nombre||''}" target="_blank" rel="noopener">Descargar</a>
    </div>
  </div>`;
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
  const files = Array.from(fileInput.files);
  const tooBig = files.filter(f => f.size > 4.5*1024*1024);
  const okFiles = files.filter(f => f.size <= 4.5*1024*1024);

  if(tooBig.length){
    showToast(tooBig.map(f=>f.name).join(', ') + ' muy pesado(s) (máx 4.5 MB c/u).');
  }
  if(!okFiles.length){
    fileInput.value = '';
    pendingFiles = [];
    return;
  }

  pendingFiles = okFiles;
  fnameEl.textContent = okFiles.length === 1
    ? okFiles[0].name + ' · ' + fmtSize(okFiles[0].size)
    : okFiles.length + ' archivos seleccionados · ' + fmtSize(okFiles.reduce((s,f)=>s+f.size,0));
  catSelect.value = activeCat in SECCIONES ? activeCat : 'trabajos';
  uploadPanel.classList.add('show');
});

document.getElementById('cancelUpload').addEventListener('click', ()=>{
  uploadPanel.classList.remove('show');
  fileInput.value = '';
  pendingFiles = [];
});

async function uploadOneFile(file, cat){
  const fileId = Date.now() + '-' + Math.random().toString(36).slice(2,8);
  const filePath = `${cat}/${fileId}-${file.name}`;

  // 1. Subir el archivo físicamente a Supabase Storage
  const { error: uploadError } = await supabaseClient
    .storage
    .from('archivos')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });
  if(uploadError) throw uploadError;

  // 2. Obtener una URL pública del archivo
  const { data: urlData } = supabaseClient
    .storage
    .from('archivos')
    .getPublicUrl(filePath);

  // 3. Guardar la información del archivo en la tabla
  const { data: dbData, error: dbError } = await supabaseClient
    .from('archivos')
    .insert({
      nombre: file.name,
      desc: '',
      fecha: new Date().toLocaleDateString('es-PE', { month: 'short', year: 'numeric' }),
      tamano: fmtSize(file.size),
      type: file.type,
      url: urlData.publicUrl,
      categoria: cat
    })
    .select()
    .single();
  if(dbError) throw dbError;

  // 4. Añadirlo temporalmente a la pantalla
  uploads[cat].push({
    id: dbData.id,
    nombre: dbData.nombre,
    desc: dbData.desc || '',
    fecha: dbData.fecha || '',
    tamano: dbData.tamano || '',
    type: dbData.type || '',
    url: dbData.url
  });
}

document.getElementById('confirmUpload').addEventListener('click', async ()=>{
  if(!pendingFiles.length) return;
  const cat = catSelect.value;
  const files = pendingFiles;

  uploadPanel.classList.remove('show');
  fileInput.value = '';
  pendingFiles = [];

  let ok = 0;
  const failed = [];

  for(const file of files){
    showToast(`Subiendo ${ok + failed.length + 1} de ${files.length}...`);
    try {
      await uploadOneFile(file, cat);
      ok++;
    } catch(error) {
      console.error('Error subiendo archivo:', file.name, error);
      failed.push(file.name);
    }
  }

  activeCat = cat;
  render();

  if(!failed.length){
    showToast(ok === 1 ? 'Subido a ' + SECCIONES[cat].label : `${ok} archivos subidos a ` + SECCIONES[cat].label);
  }else if(ok){
    showToast(`${ok} subidos, ${failed.length} fallaron (${failed.join(', ')})`);
  }else{
    showToast('No se pudo subir ningún archivo');
  }
});

searchInput.addEventListener('input', renderGrid);

(async function init(){
  await loadUploads();
  render();
})();