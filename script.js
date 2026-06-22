// ============ VARIABLES DE ESTADO ============
let mesas = [];
let menuItems = [];
let categorias = ['Todas'];
let mesaSeleccionada = null;
let catActiva = 'Todas';
let orden = [];
let tickets = [];
let ordenesPagadas = [];

const API_URL = ''; // Relativo al servidor
const MESA_ICONS = ['⛵','🚣','🎣','🐚','🌊','⚓','🦈','🐋','🪝','🗺️'];

// ============ API FETCH ============

async function fetchMenu() {
  try {
    const res = await fetch(`${API_URL}/api/menu`);
    menuItems = await res.json();
    categorias = ['Todas', ...new Set(menuItems.map(i => i.cat))];
    if (window.location.pathname.includes('pedidos.html')) {
      renderCatPills();
      renderMenuItems();
    }
  } catch (err) { console.error('Error fetching menu:', err); }
}

async function fetchMesas() {
  try {
    const res = await fetch(`${API_URL}/api/mesas`);
    mesas = await res.json();
    if (window.location.pathname.includes('pedidos.html')) renderMesas();
  } catch (err) { console.error('Error fetching mesas:', err); }
}

async function fetchTickets() {
  try {
    const res = await fetch(`${API_URL}/api/tickets`);
    const data = await res.json();
    // Normalizar hora/fecha
    tickets = data.map(t => ({
      ...t,
      hora: t.fecha ? new Date(t.fecha) : new Date()
    }));
    const page = window.location.pathname.split('/').pop() || 'index.html';
    if (page === 'cocina.html') renderCocina();
    if (page === 'pedidos.html') renderOrden();
    updateNotifBadge();
  } catch (err) { console.error('Error fetching tickets:', err); }
}

// ============ RELOJ ============
function updateClock() {
  const clockEl = document.getElementById('clock');
  if (clockEl) {
    clockEl.textContent = new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
setInterval(updateClock, 1000);

// ============ AUTH & RUTAS ============
async function handleLogin(e) {
  e.preventDefault();
  const u = document.getElementById('username').value;
  const p = document.getElementById('password').value;
  const err = document.getElementById('login-error');

  try {
    const res = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    
    if (data.success) {
      localStorage.setItem('sabores_session', JSON.stringify(data.user));
      err.style.display = 'none';
      window.location.href = data.user.home_page;
    } else {
      err.style.display = 'block';
    }
  } catch (err) {
    console.error('Error logging in:', err);
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

  if (!session && page !== 'index.html') {
    window.location.href = 'index.html';
    return;
  }

  if (session) {
    if (page === 'index.html') {
      window.location.href = session.home_page;
      return;
    }
    // Protección de rutas dinámica basada en el rol y la home_page asignada
    if (session.rol === 'mozo' && page !== 'pedidos.html') { window.location.href = 'pedidos.html'; return; }
    if (session.rol === 'cocina' && page !== 'cocina.html') { window.location.href = 'cocina.html'; return; }
    // El rol admin ahora puede acceder a todas las páginas

    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl) userInfoEl.textContent = `${session.nombre} (${session.rol})`;

    if (session.rol === 'admin') {
      renderAdminNav(page);
    }
  }
}

function renderAdminNav(currentPage) {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;

  // Evitar duplicar el menú de navegación
  if (document.getElementById('admin-nav')) return;

  const nav = document.createElement('div');
  nav.id = 'admin-nav';
  nav.className = 'admin-nav';

  const pages = [
    { name: '📋 Pedidos', url: 'pedidos.html' },
    { name: '🍳 Cocina', url: 'cocina.html' },
    { name: '📊 Reportes', url: 'reportes.html' }
  ];

  pages.forEach(p => {
    const link = document.createElement('a');
    link.href = p.url;
    link.textContent = p.name;
    
    if (currentPage === p.url) {
      link.classList.add('active');
    }

    nav.appendChild(link);
  });

  const logo = topbar.querySelector('.logo');
  if (logo) {
    logo.after(nav);
  } else {
    topbar.insertBefore(nav, topbar.firstChild);
  }
}

function initPage() {
  checkPageAuth();
  const path = window.location.pathname;
  const page = path.split('/').pop() || 'index.html';

  if (page === 'pedidos.html') {
    fetchMenu();
    fetchMesas();
    fetchTickets();
    setInterval(() => {
      fetchMesas();
      fetchTickets();
    }, 10000);
  }
  if (page === 'cocina.html') {
    fetchTickets();
    setInterval(fetchTickets, 10000);
  }
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
  orden = []; // Reiniciar la selección de platos al cambiar de mesa
  const notasInput = document.getElementById('notas-orden');
  if (notasInput) notasInput.value = '';
  const label1 = document.getElementById('mesa-selected-label');
  const label2 = document.getElementById('orden-mesa-label');
  if (label1) label1.textContent = 'Mesa ' + num;
  if (label2) label2.textContent = 'Mesa ' + num;
  renderMesas();
  renderOrden();
}

// ============ MENU ============
function renderCatPills() {
  const c = document.getElementById('cat-pills');
  if (!c) return;
  c.innerHTML = '';
  categorias.forEach(cat => {
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
  const filtered = menuItems.filter(i => {
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

  // Si no hay mesa seleccionada, mostrar mensaje inicial
  if (!mesaSeleccionada) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🦐</div>
        <div class="empty-state-text">Seleccioná una mesa<br>y elegí del menú</div>
      </div>
    `;
    updateTotals(0);
    return;
  }

  // Buscar todos los pedidos no cobrados para esta mesa
  const historialTickets = tickets.filter(t => t.mesa === mesaSeleccionada && t.estado !== 'cobrado');
  
  if (historialTickets.length === 0 && orden.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🍽️</div>
        <div class="empty-state-text">Mesa vacía<br>Agregá platos del menú</div>
      </div>
    `;
    updateTotals(0);
    return;
  }

  container.innerHTML = '';
  let subtotalAcumulado = 0;

  // 1. Renderizar Historial de Consumo si existe
  if (historialTickets.length > 0) {
    const histSec = document.createElement('div');
    histSec.className = 'historial-seccion';
    histSec.innerHTML = `<div class="seccion-title">📜 Consumos Enviados</div>`;

    historialTickets.forEach(t => {
      let estadoTexto = '';
      let badgeClass = '';
      if (t.estado === 'pendiente') { estadoTexto = 'En cocina'; badgeClass = 'badge-pendiente'; }
      else if (t.estado === 'proceso') { estadoTexto = 'Cocinando'; badgeClass = 'badge-proceso'; }
      else if (t.estado === 'listo') { estadoTexto = 'Listo'; badgeClass = 'badge-listo'; }
      else if (t.estado === 'entregado') { estadoTexto = 'Servido'; badgeClass = 'badge-entregado'; }

      const card = document.createElement('div');
      card.className = 'historial-ticket-card';
      
      let itemsHtml = '';
      t.items.forEach(item => {
        subtotalAcumulado += item.precio * item.qty;
        itemsHtml += `
          <div class="historial-item">
            <span>${item.emoji} ${item.nombre} <span class="historial-qty">x${item.qty}</span></span>
            <span>Gs. ${(item.precio * item.qty).toLocaleString('es-PY')}</span>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="historial-ticket-header">
          <span class="ticket-id">Pedido #${t.id}</span>
          <span class="ticket-estado-badge ${badgeClass}">${estadoTexto}</span>
        </div>
        <div class="historial-ticket-items">
          ${itemsHtml}
        </div>
        ${t.notas ? `<div class="historial-notas">📝 ${t.notas}</div>` : ''}
      `;
      histSec.appendChild(card);
    });
    container.appendChild(histSec);
  }

  // 2. Renderizar platos nuevos agregados
  if (orden.length > 0) {
    const nuevosSec = document.createElement('div');
    nuevosSec.className = 'nuevos-seccion';
    nuevosSec.innerHTML = `<div class="seccion-title">✨ Nuevos platos a enviar</div>`;

    orden.forEach((item, idx) => {
      subtotalAcumulado += item.precio * item.qty;
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
      nuevosSec.appendChild(el);
    });
    container.appendChild(nuevosSec);
  }

  updateTotals(subtotalAcumulado);
}

function changeQty(idx, delta) {
  orden[idx].qty += delta;
  if (orden[idx].qty <= 0) orden.splice(idx, 1);
  renderOrden();
}

function updateTotals(sub) {
  const iva = Math.round(sub * 0.10);
  const subEl = document.getElementById('subtotal');
  const ivaEl = document.getElementById('iva');
  const totEl = document.getElementById('total');
  if (subEl) subEl.textContent = 'Gs. ' + sub.toLocaleString('es-PY');
  if (ivaEl) ivaEl.textContent = 'Gs. ' + iva.toLocaleString('es-PY');
  if (totEl) totEl.textContent = 'Gs. ' + (sub + iva).toLocaleString('es-PY');
}

function clearOrden() {
  orden = [];
  const notasInput = document.getElementById('notas-orden');
  if (notasInput) notasInput.value = '';
  renderOrden();
  const label = document.getElementById('orden-mesa-label');
  if (label) label.textContent = 'sin mesa';
}

async function enviarCocina() {
  if (!orden.length) { showModal('⚠️ Orden vacía', 'Agregá al menos un plato.', null, null, true); return; }
  if (!mesaSeleccionada) { showModal('⚠️ Sin mesa', 'Seleccioná una mesa primero.', null, null, true); return; }
  const notasInput = document.getElementById('notas-orden');
  const notas = notasInput ? notasInput.value : '';
  
  try {
    const res = await fetch(`${API_URL}/api/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesa: mesaSeleccionada, items: orden, notas })
    });
    if (res.ok) {
      showModal('✅ Enviado', `Pedido enviado a cocina para Mesa ${mesaSeleccionada}.`, null, null, true);
      clearOrden();
      mesaSeleccionada = null;
      const label = document.getElementById('mesa-selected-label');
      if (label) label.textContent = 'Sin selección';
      fetchMesas();
      fetchTickets();
    }
  } catch (err) { console.error('Error sending to kitchen:', err); }
}

async function cobrarOrden() {
  if (!mesaSeleccionada) { showModal('⚠️ Sin mesa', 'Seleccioná una mesa para cobrar.', null, null, true); return; }
  const m = mesas.find(x => x.num === mesaSeleccionada);
  if (!m || m.estado === 'libre') { showModal('⚠️ Mesa libre', 'Esta mesa no tiene consumos pendientes.', null, null, true); return; }

  showModal('💳 Cobrar Mesa', `¿Confirmar el cobro y liberación de la Mesa ${mesaSeleccionada}?`, async () => {
    try {
      const res = await fetch(`${API_URL}/api/cobrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesa: mesaSeleccionada })
      });
      if (res.ok) {
        mesaSeleccionada = null;
        const label = document.getElementById('mesa-selected-label');
        if (label) label.textContent = 'Sin selección';
        fetchMesas();
        fetchTickets();
      }
    } catch (err) { console.error('Error charging:', err); }
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
  
  const sPend = document.getElementById('stat-pendiente');
  const sProc = document.getElementById('stat-proceso');
  const sList = document.getElementById('stat-listo');
  
  if (sPend) sPend.textContent = pend.length + ' Pendientes';
  if (sProc) sProc.textContent = proc.length + ' En proceso';
  if (sList) sList.textContent = list.length + ' Listos';
  
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

async function cambiarEstado(id, nuevoEstado) {
  try {
    const res = await fetch(`${API_URL}/api/tickets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado })
    });
    if (res.ok) fetchTickets();
  } catch (err) { console.error('Error changing state:', err); }
}

// ============ REPORTES ============
let reportData = null;

async function renderReportes() {
  const periodoSelect = document.getElementById('rep-periodo');
  const periodo = periodoSelect ? periodoSelect.value : 'hoy';
  
  try {
    const res = await fetch(`${API_URL}/api/reportes?periodo=${periodo}`);
    reportData = await res.json();
    const { kpis, ventasHora, ventasCat, topProductos } = reportData;

    const kpiItems = [
      { label:'Ventas Totales', val:'Gs. ' + Math.round(kpis.total_ventas).toLocaleString('es-PY'), cls:'k1' },
      { label:'Pedidos', val:kpis.total_pedidos, cls:'k2' },
      { label:'Ticket Promedio', val:'Gs. ' + Math.round(kpis.ticket_promedio).toLocaleString('es-PY'), cls:'k3' },
      { label:'Mesas Atendidas', val:kpis.total_pedidos > 0 ? (kpis.total_pedidos / 1.5).toFixed(0) : 0, cls:'k4' },
    ];

    const kpiGrid = document.getElementById('kpi-grid');
    if (kpiGrid) {
      kpiGrid.innerHTML = kpiItems.map(k => `
        <div class="kpi-card ${k.cls}">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value">${k.val}</div>
        </div>
      `).join('');
    }

    renderBarChart(ventasHora);
    renderDonut(ventasCat);
    renderTablaProductos(topProductos);
  } catch (err) { console.error('Error rendering reports:', err); }
}

function renderBarChart(ventasHora) {
  const c = document.getElementById('chart-ventas-hora');
  if (!c) return;
  c.innerHTML = '';
  
  const horasFull = Array.from({ length: 24 }, (_, i) => ({ hora: i, pedidos: 0 }));
  ventasHora.forEach(vh => { horasFull[parseInt(vh.hora)].pedidos = parseInt(vh.pedidos); });
  
  const relevantHours = horasFull.slice(8, 23); // De 8h a 22h
  const max = Math.max(...relevantHours.map(h => h.pedidos)) || 1;

  relevantHours.forEach(h => {
    const pct = (h.pedidos / max) * 100;
    const el = document.createElement('div');
    el.className = 'bar-group';
    el.innerHTML = `
      <div class="bar" style="height:${pct}%;background:linear-gradient(to top, var(--accent), rgba(56,201,192,0.3));">
        <span class="bar-val">${h.pedidos}</span>
      </div>
      <div class="bar-label">${h.hora}h</div>
    `;
    c.appendChild(el);
  });
}

function renderDonut(ventasCat) {
  const colors = ['#38c9c0','#2ec47a','#d4a840','#e05c2a','#7b8fd4'];
  const total = ventasCat.reduce((a, c) => a + parseInt(c.count), 0) || 1;
  let offset = 25;
  
  const segments = ventasCat.map((cat, i) => {
    const pct = (parseInt(cat.count) / total) * 100;
    const dash = (pct / 100) * 283;
    const gap = 283 - dash;
    const seg = `<circle r="45" cx="60" cy="60" fill="none" stroke="${colors[i % colors.length]}" stroke-width="18" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset * 2.83 + 283 * 0.25}" style="transition:all 0.5s;" />`;
    offset += pct;
    return { seg, color: colors[i % colors.length], name: cat.n, pct: pct.toFixed(1) };
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

function renderTablaProductos(productos) {
  if (!productos) return;
  const totalIng = productos.reduce((a, p) => a + parseInt(p.ingresos), 0) || 1;
  const maxVend = Math.max(...productos.map(p => parseInt(p.vendidos))) || 1;
  const rankClasses = ['gold','silver','bronze','','',''];
  const tbody = document.getElementById('tabla-productos-body');
  if (tbody) {
    tbody.innerHTML = productos.map((p, i) => `
      <tr>
        <td><span class="rank-num ${rankClasses[i]||''}">${i+1}</span></td>
        <td>${p.emoji} ${p.nombre}</td>
        <td><span style="background:rgba(56,201,192,0.08);color:var(--accent);padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${p.cat}</span></td>
        <td>${p.vendidos}</td>
        <td>Gs. ${parseInt(p.ingresos).toLocaleString('es-PY')}</td>
        <td style="min-width:130px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="progress-bar-wrap" style="flex:1;">
              <div class="progress-bar-fill" style="width:${(parseInt(p.vendidos)/maxVend*100).toFixed(0)}%"></div>
            </div>
            <span style="font-size:11px;color:var(--muted);white-space:nowrap;">${(parseInt(p.ingresos)/totalIng*100).toFixed(1)}%</span>
          </div>
        </td>
      </tr>
    `).join('');
  }
}

// ============ MODAL ============
let modalCallback = null;

function showModal(title, sub, onConfirm, confirmLabel, infoOnly) {
  const mTitle = document.getElementById('modal-title');
  const mSub = document.getElementById('modal-sub');
  const mBody = document.getElementById('modal-body');
  const mBtn = document.getElementById('modal-confirm-btn');
  const mOverlay = document.getElementById('modal-overlay');

  if (mTitle) mTitle.textContent = title;
  if (mSub) mSub.textContent = sub;
  if (mBody) mBody.innerHTML = '';
  
  if (mBtn) {
    if (infoOnly) {
      mBtn.textContent = 'Entendido';
      mBtn.onclick = closeModal;
    } else {
      mBtn.textContent = confirmLabel || 'Confirmar';
      modalCallback = onConfirm;
      mBtn.onclick = () => { if (modalCallback) modalCallback(); closeModal(); };
    }
  }
  if (mOverlay) mOverlay.classList.add('open');
}

function closeModal() {
  const mOverlay = document.getElementById('modal-overlay');
  if (mOverlay) mOverlay.classList.remove('open');
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
  if (!reportData || !reportData.topProductos) return;
  const rows = [['Producto','Categoría','Vendidos','Ingresos (Gs.)']];
  reportData.topProductos.forEach(p => {
    rows.push([p.nombre, p.cat, p.vendidos, p.ingresos]);
  });
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
  initPage();
});
