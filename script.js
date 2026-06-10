// ============ VARIABLES DE ESTADO ============
let mesas = JSON.parse(JSON.stringify(MESAS_INITIAL));
let mesaSeleccionada = null;
let catActiva = 'Todas';
let orden = [];
let tickets = [];
let ticketCounter = 100;
let ordenesPagadas = [];

// ============ RELOJ ============
function updateClock() {
  const clockEl = document.getElementById('clock');
  if (clockEl) {
    clockEl.textContent = new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
setInterval(updateClock, 1000);

// ============ AUTH & RUTAS ============
const USERS = {
  'admin':   { pass: '123', rol: 'admin',   home: 'reportes.html', nombre: 'Administrador' },
  'cocina':  { pass: '123', rol: 'cocina',  home: 'cocina.html',   nombre: 'Jefe de Cocina' },
  'mozo':    { pass: '123', rol: 'mozo',    home: 'pedidos.html',  nombre: 'Mozo de Salón' }
};

function handleLogin(e) {
  e.preventDefault();
  const u = document.getElementById('username').value;
  const p = document.getElementById('password').value;
  const err = document.getElementById('login-error');

  if (USERS[u] && USERS[u].pass === p) {
    localStorage.setItem('sabores_session', JSON.stringify({ user: u, ...USERS[u] }));
    err.style.display = 'none';
    window.location.href = USERS[u].home;
  } else {
    err.style.display = 'block';
  }
}

function logout() {
  localStorage.removeItem('sabores_session');
  window.location.href = 'index.html';
}

function checkPageAuth() {
  const session = JSON.parse(localStorage.getItem('sabores_session'));
  const path = window.location.pathname;
  const page = path.split('/').pop() || 'index.html';

  // Si no hay sesión y no estamos en login, ir a login
  if (!session && page !== 'index.html') {
    window.location.href = 'index.html';
    return;
  }

  // Si hay sesión
  if (session) {
    // Si está en login teniendo sesión, mandarlo a su home
    if (page === 'index.html') {
      window.location.href = session.home;
      return;
    }

    // Protección de rutas por archivo físico
    if (session.rol === 'mozo' && page !== 'pedidos.html') { window.location.href = 'pedidos.html'; return; }
    if (session.rol === 'cocina' && page !== 'cocina.html') { window.location.href = 'cocina.html'; return; }
    if (session.rol === 'admin' && page !== 'reportes.html') { window.location.href = 'reportes.html'; return; }

    // Actualizar UI de sesión
    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl) userInfoEl.textContent = `${session.nombre} (${session.rol})`;
  }
}

// Reemplazamos el router SPA por el validador de página
function initPage() {
  checkPageAuth();
  
  const path = window.location.pathname;
  const page = path.split('/').pop() || 'index.html';

  if (page === 'pedidos.html') { renderMesas(); renderMenuItems(); renderCatPills(); }
  if (page === 'cocina.html') renderCocina();
  if (page === 'reportes.html') renderReportes();
}

// ============ MESAS ============
function renderMesas() {
  const grid = document.getElementById('mesas-grid');
  if (!grid) return;
  grid.innerHTML = '';
  mesas.forEach((m, i) => {
    const card = document.createElement('div');
    card.className = `mesa-card ${m.estado} ${mesaSeleccionada === m.num ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="mesa-icon">${MESA_ICONS[i % MESA_ICONS.length]}</div>
      <div class="mesa-num">${m.num}</div>
      <div class="mesa-estado">${m.estado === 'libre' ? '✓ Libre' : '● Ocupada'}</div>
      <div class="mesa-info">${m.estado === 'ocupada' ? m.personas + ' personas' : 'Disponible'}</div>
    `;
    card.onclick = () => selectMesa(m.num);
    grid.appendChild(card);
  });
}

function selectMesa(num) {
  mesaSeleccionada = num;
  document.getElementById('mesa-selected-label').textContent = 'Mesa ' + num;
  document.getElementById('orden-mesa-label').textContent = 'Mesa ' + num;
  renderMesas();
}

// ============ MENU ============
function renderCatPills() {
  const c = document.getElementById('cat-pills');
  if (!c) return;
  c.innerHTML = '';
  CATEGORIAS.forEach(cat => {
    const pill = document.createElement('button');
    pill.className = `cat-pill ${catActiva === cat ? 'active' : ''}`;
    pill.textContent = cat;
    pill.onclick = () => { catActiva = cat; renderCatPills(); renderMenuItems(); };
    c.appendChild(pill);
  });
}

function filterMenu() { renderMenuItems(); }

function renderMenuItems() {
  const searchInput = document.getElementById('search-input');
  const q = searchInput ? searchInput.value.toLowerCase() : '';
  const grid = document.getElementById('menu-items-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const filtered = MENU.filter(i => {
    const catOk = catActiva === 'Todas' || i.cat === catActiva;
    const qOk = !q || i.nombre.toLowerCase().includes(q);
    return catOk && qOk;
  });
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🔍</div><div class="empty-state-text">Sin resultados</div></div>';
    return;
  }
  filtered.forEach(item => {
    const el = document.createElement('div');
    el.className = 'menu-item';
    el.innerHTML = `
      <span class="item-emoji">${item.emoji}</span>
      <div class="item-name">${item.nombre}</div>
      <div class="item-price">Gs. ${item.precio.toLocaleString('es-PY')}</div>
      <div class="item-cat">${item.cat}</div>
    `;
    el.onclick = () => agregarItem(item);
    grid.appendChild(el);
  });
}

// ============ ORDEN ============
function agregarItem(item) {
  if (!mesaSeleccionada) { showModal('⚠️ Sin mesa', 'Seleccioná una mesa antes de agregar platos.', null, null, true); return; }
  const ex = orden.find(i => i.id === item.id);
  if (ex) ex.qty++; else orden.push({ ...item, qty:1 });
  renderOrden();
}

function renderOrden() {
  const container = document.getElementById('orden-items');
  if (!container) return;
  if (!orden.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🦐</div><div class="empty-state-text">Agregá platos del menú</div></div>`;
    updateTotals(0); return;
  }
  container.innerHTML = '';
  let sub = 0;
  orden.forEach((item, idx) => {
    sub += item.precio * item.qty;
    const el = document.createElement('div');
    el.className = 'orden-item';
    el.innerHTML = `
      <span style="font-size:22px;">${item.emoji}</span>
      <div class="orden-item-info">
        <div class="orden-item-name">${item.nombre}</div>
        <div class="orden-item-price">Gs. ${(item.precio * item.qty).toLocaleString('es-PY')}</div>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="changeQty(${idx}, -1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
      </div>
    `;
    container.appendChild(el);
  });
  updateTotals(sub);
}

function changeQty(idx, delta) {
  orden[idx].qty += delta;
  if (orden[idx].qty <= 0) orden.splice(idx, 1);
  renderOrden();
}

function updateTotals(sub) {
  const iva = Math.round(sub * 0.10);
  document.getElementById('subtotal').textContent = 'Gs. ' + sub.toLocaleString('es-PY');
  document.getElementById('iva').textContent = 'Gs. ' + iva.toLocaleString('es-PY');
  document.getElementById('total').textContent = 'Gs. ' + (sub + iva).toLocaleString('es-PY');
}

function clearOrden() {
  orden = [];
  const notasInput = document.getElementById('notas-orden');
  if (notasInput) notasInput.value = '';
  renderOrden();
  document.getElementById('orden-mesa-label').textContent = 'sin mesa';
}

function enviarCocina() {
  if (!orden.length) { showModal('⚠️ Orden vacía', 'Agregá al menos un plato.', null, null, true); return; }
  if (!mesaSeleccionada) { showModal('⚠️ Sin mesa', 'Seleccioná una mesa primero.', null, null, true); return; }
  const notasInput = document.getElementById('notas-orden');
  const notas = notasInput ? notasInput.value : '';
  const ticket = { id: ++ticketCounter, mesa: mesaSeleccionada, items: JSON.parse(JSON.stringify(orden)), notas, estado: 'pendiente', hora: new Date() };
  tickets.push(ticket);
  const m = mesas.find(x => x.num === mesaSeleccionada);
  if (m) { m.estado = 'ocupada'; m.personas = Math.floor(Math.random() * 5) + 1; }
  updateNotifBadge();
  clearOrden();
  mesaSeleccionada = null;
  document.getElementById('mesa-selected-label').textContent = 'Sin selección';
  renderMesas();
  showModal('✅ Enviado', `Ticket #${ticket.id} enviado a cocina — Mesa ${ticket.mesa}.`, null, null, true);
}

function cobrarOrden() {
  if (!orden.length) { showModal('⚠️ Orden vacía', 'No hay nada que cobrar.', null, null, true); return; }
  const sub = orden.reduce((a, i) => a + i.precio * i.qty, 0);
  const total = sub + Math.round(sub * 0.10);
  showModal('💳 Cobrar Orden', `Mesa ${mesaSeleccionada || '—'} — Total: Gs. ${total.toLocaleString('es-PY')}`, () => {
    ordenesPagadas.push({ items: JSON.parse(JSON.stringify(orden)), total, fecha: new Date(), mesa: mesaSeleccionada });
    const m = mesas.find(x => x.num === mesaSeleccionada);
    if (m) { m.estado = 'libre'; m.personas = 0; }
    clearOrden();
    mesaSeleccionada = null;
    document.getElementById('mesa-selected-label').textContent = 'Sin selección';
    renderMesas();
  }, 'Confirmar cobro');
}

function updateNotifBadge() {
  const pend = tickets.filter(t => t.estado === 'pendiente').length;
  const badge = document.getElementById('notif-badge');
  if (badge) badge.textContent = pend + ' pendientes';
}

// ============ COCINA ============
function renderCocina() {
  const pend = tickets.filter(t => t.estado === 'pendiente');
  const proc = tickets.filter(t => t.estado === 'proceso');
  const list = tickets.filter(t => t.estado === 'listo');
  document.getElementById('stat-pendiente').textContent = pend.length + ' Pendientes';
  document.getElementById('stat-proceso').textContent = proc.length + ' En proceso';
  document.getElementById('stat-listo').textContent = list.length + ' Listos';
  renderTickets('col-pendiente-items', pend, 'pendiente');
  renderTickets('col-proceso-items', proc, 'proceso');
  renderTickets('col-listo-items', list, 'listo');
  updateNotifBadge();
}

function renderTickets(containerId, ticketList, estado) {
  const c = document.getElementById(containerId);
  if (!c) return;
  if (!ticketList.length) {
    c.innerHTML = `<div style="text-align:center;padding:34px;color:var(--muted);font-size:12px;">Sin tickets 🌊</div>`;
    return;
  }
  c.innerHTML = '';
  ticketList.forEach(t => {
    const mins = Math.round((new Date() - t.hora) / 60000);
    const urgente = mins >= 20 && estado === 'pendiente';
    const el = document.createElement('div');
    el.className = `ticket-card ${urgente ? 'urgente' : ''}`;
    let btns = '';
    if (estado === 'pendiente') btns = `<button class="ticket-btn iniciar" onclick="cambiarEstado(${t.id},'proceso')">▶ Iniciar</button>`;
    if (estado === 'proceso')   btns = `<button class="ticket-btn listo"   onclick="cambiarEstado(${t.id},'listo')">✓ Listo</button>`;
    if (estado === 'listo')     btns = `<button class="ticket-btn entregar" onclick="cambiarEstado(${t.id},'entregado')">🚀 Entregar</button>`;
    el.innerHTML = `
      <div class="ticket-top">
        <div class="ticket-mesa">Mesa ${t.mesa}</div>
        <div class="ticket-time ${urgente ? 'urgente' : ''}">⏱ ${mins}m</div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px;">#${t.id} · ${t.hora.toLocaleTimeString('es-PY',{hour:'2-digit',minute:'2-digit'})}</div>
      <ul class="ticket-items">
        ${t.items.map(i => `<li class="ticket-item"><span class="ticket-item-qty">×${i.qty}</span><span>${i.emoji} ${i.nombre}</span></li>`).join('')}
      </ul>
      ${t.notas ? `<div style="font-size:11px;background:rgba(56,201,192,0.07);border:1px solid rgba(56,201,192,0.18);border-radius:8px;padding:7px 10px;color:var(--accent);margin-bottom:10px;">📝 ${t.notas}</div>` : ''}
      <div class="ticket-btn-group">${btns}</div>
    `;
    c.appendChild(el);
  });
}

function cambiarEstado(id, nuevoEstado) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  if (nuevoEstado === 'entregado') tickets = tickets.filter(x => x.id !== id);
  else t.estado = nuevoEstado;
  renderCocina();
}

// ============ REPORTES ============
function renderReportes() {
  const periodoSelect = document.getElementById('rep-periodo');
  const periodo = periodoSelect ? periodoSelect.value : 'hoy';
  const d = ventasDemo[periodo];

  const kpis = [
    { label:'Ventas Totales', val:'Gs. ' + (d.total/1000000).toFixed(1) + 'M', delta:'+14%', dir:'up', cls:'k1' },
    { label:'Pedidos', val:d.pedidos, delta:'+9%', dir:'up', cls:'k2' },
    { label:'Ticket Promedio', val:'Gs. ' + Math.round(d.ticket/1000) + 'K', delta:'+5%', dir:'up', cls:'k3' },
    { label:'Mesas Atendidas', val:d.mesa_avg, delta:'-1%', dir:'down', cls:'k4' },
  ];

  const kpiGrid = document.getElementById('kpi-grid');
  if (kpiGrid) {
    kpiGrid.innerHTML = kpis.map(k => `
      <div class="kpi-card ${k.cls}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.val}</div>
        <div class="kpi-delta ${k.dir}">${k.dir === 'up' ? '↑' : '↓'} ${k.delta} vs período anterior</div>
      </div>
    `).join('');
  }

  renderBarChart(d.horas);
  renderDonut(d.cats);
  renderTablaProductos();
}

function renderBarChart(horas) {
  const labels = ['8h','9h','10h','11h','12h','13h','14h','15h','16h','17h','18h','19h','20h'];
  const max = Math.max(...horas);
  const c = document.getElementById('chart-ventas-hora');
  if (!c) return;
  c.innerHTML = '';
  horas.forEach((val, i) => {
    const pct = (val / max) * 100;
    const el = document.createElement('div');
    el.className = 'bar-group';
    el.innerHTML = `
      <div class="bar" style="height:${pct}%;background:linear-gradient(to top, var(--accent), rgba(56,201,192,0.3));">
        <span class="bar-val">${val}k</span>
      </div>
      <div class="bar-label">${labels[i]}</div>
    `;
    c.appendChild(el);
  });
}

function renderDonut(cats) {
  const colors = ['#38c9c0','#2ec47a','#d4a840','#e05c2a','#7b8fd4'];
  let offset = 25;
  const segments = cats.map((cat, i) => {
    const pct = typeof cat.p === 'function' ? cat.p() : cat.p;
    const dash = (pct / 100) * 283;
    const gap = 283 - dash;
    const seg = `<circle r="45" cx="60" cy="60" fill="none" stroke="${colors[i]}" stroke-width="18" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset * 2.83 + 283 * 0.25}" style="transition:all 0.5s;" />`;
    offset += pct;
    return { seg, color: colors[i], name: cat.n, pct };
  });
  const chartCats = document.getElementById('chart-categorias');
  if (chartCats) {
    chartCats.innerHTML = `
      <svg class="donut-svg" width="120" height="120" viewBox="0 0 120 120">
        <circle r="45" cx="60" cy="60" fill="none" stroke="var(--surface2)" stroke-width="18"/>
        ${segments.map(s => s.seg).join('')}
      </svg>
      <div class="donut-legend">
        ${segments.map(s => `
          <div class="legend-item">
            <div class="legend-dot" style="background:${s.color}"></div>
            <span class="legend-name">${s.name}</span>
            <span class="legend-pct">${s.pct}%</span>
          </div>
        `).join('')}
      </div>
    `;
  }
}

function renderTablaProductos() {
  const productos = [
    { nombre:'Dorado al Limón',           cat:'Pescados de Río', emoji:'🍊', vendidos:52, ingresos:4680000 },
    { nombre:'Cazuela de Mariscos',        cat:'Mariscos',        emoji:'🍲', vendidos:44, ingresos:4312000 },
    { nombre:'Surubí a la Plancha',        cat:'Pescados de Río', emoji:'🐠', vendidos:40, ingresos:3120000 },
    { nombre:'Pulpo a la Gallega',         cat:'Mariscos',        emoji:'🐙', vendidos:35, ingresos:3325000 },
    { nombre:'Risotto de Camarones',       cat:'Arroces & Pastas',emoji:'🍚', vendidos:30, ingresos:1950000 },
    { nombre:'Camarones al Pil Pil',       cat:'Mariscos',        emoji:'🦐', vendidos:28, ingresos:2296000 },
  ];
  const maxVend = Math.max(...productos.map(p => p.vendidos));
  const totalIng = productos.reduce((a, p) => a + p.ingresos, 0);
  const rankClasses = ['gold','silver','bronze','','',''];
  const tbody = document.getElementById('tabla-productos-body');
  if (tbody) {
    tbody.innerHTML = productos.map((p, i) => `
      <tr>
        <td><span class="rank-num ${rankClasses[i]||''}">${i+1}</span></td>
        <td>${p.emoji} ${p.nombre}</td>
        <td><span style="background:rgba(56,201,192,0.08);color:var(--accent);padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${p.cat}</span></td>
        <td>${p.vendidos}</td>
        <td>Gs. ${p.ingresos.toLocaleString('es-PY')}</td>
        <td style="min-width:130px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="progress-bar-wrap" style="flex:1;">
              <div class="progress-bar-fill" style="width:${(p.vendidos/maxVend*100).toFixed(0)}%"></div>
            </div>
            <span style="font-size:11px;color:var(--muted);white-space:nowrap;">${(p.ingresos/totalIng*100).toFixed(1)}%</span>
          </div>
        </td>
      </tr>
    `).join('');
  }
}

// ============ MODAL ============
let modalCallback = null;

function showModal(title, sub, onConfirm, confirmLabel, infoOnly) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-sub').textContent = sub;
  document.getElementById('modal-body').innerHTML = '';
  const btn = document.getElementById('modal-confirm-btn');
  if (infoOnly) {
    btn.textContent = 'Entendido';
    btn.onclick = closeModal;
  } else {
    btn.textContent = confirmLabel || 'Confirmar';
    modalCallback = onConfirm;
    btn.onclick = () => { if (modalCallback) modalCallback(); closeModal(); };
  }
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  modalCallback = null;
}

const modalOverlay = document.getElementById('modal-overlay');
if (modalOverlay) {
  modalOverlay.addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
}

// ============ EXPORT ============
function exportarCSV() {
  const rows = [['Producto','Categoría','Vendidos','Ingresos (Gs.)'],
    ['Dorado al Limón','Pescados de Río',52,4680000],
    ['Cazuela de Mariscos','Mariscos',44,4312000],
    ['Surubí a la Plancha','Pescados de Río',40,3120000],
    ['Pulpo a la Gallega','Mariscos',35,3325000],
    ['Risotto de Camarones','Arroces & Pastas',30,1950000],
    ['Camarones al Pil Pil','Mariscos',28,2296000],
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'sabores-del-rio-reporte.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  updateClock();

  tickets = [
    { id:101, mesa:2, items:[{id:5,nombre:'Surubí a la Plancha',emoji:'🐠',precio:78000,qty:2},{id:21,nombre:'Vino Blanco Copa',emoji:'🥂',precio:32000,qty:2}], notas:'Sin picante', estado:'pendiente', hora:new Date(Date.now()-7*60000) },
    { id:102, mesa:4, items:[{id:12,nombre:'Cazuela de Mariscos',emoji:'🍲',precio:98000,qty:1},{id:1,nombre:'Ceviche de Surubí',emoji:'🍋',precio:52000,qty:2}], notas:'Alergia al gluten', estado:'proceso', hora:new Date(Date.now()-14*60000) },
    { id:103, mesa:6, items:[{id:7,nombre:'Dorado al Limón',emoji:'🍊',precio:90000,qty:1},{id:11,nombre:'Pulpo a la Gallega',emoji:'🐙',precio:95000,qty:1}], notas:'', estado:'listo', hora:new Date(Date.now()-21*60000) },
  ];
  updateNotifBadge();

  // Iniciar validación de página
  initPage();
});
