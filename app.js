// Ahorro Casa PWA — v4 (rediseño: Situación + Ahorro + Cartera + Deudas)
const App = {
  houseParams: { entryPct: 10, taxesPct: 10, houseInc: 5 },
  savings: [],
  housePrices: [],
  portfolio: [],
  debts: [],

  init() {
    this.load();
    FirebaseSync.init();
    this.bindEvents();
    this.setDefaultDates();
    this.render();
  },

  load() {
    try {
      const hp = localStorage.getItem('ahc-hparams');
      if (hp) Object.assign(this.houseParams, JSON.parse(hp));
      const sv = localStorage.getItem('ahc-savings');
      if (sv) this.savings = JSON.parse(sv);
      const hs = localStorage.getItem('ahc-house');
      if (hs) this.housePrices = JSON.parse(hs);
      const pf = localStorage.getItem('ahc-portfolio');
      if (pf) this.portfolio = JSON.parse(pf);
      if (!Array.isArray(this.portfolio) || this.portfolio.length === 0) this.seedPortfolio();
      const db = localStorage.getItem('ahc-debts');
      if (db) this.debts = JSON.parse(db);
      if (!Array.isArray(this.debts) || this.debts.length === 0) this.seedDebts();
      this.normalize();
    } catch (e) {}
  },

  save() {
    localStorage.setItem('ahc-hparams', JSON.stringify(this.houseParams));
    localStorage.setItem('ahc-savings', JSON.stringify(this.savings));
    localStorage.setItem('ahc-house', JSON.stringify(this.housePrices));
    localStorage.setItem('ahc-portfolio', JSON.stringify(this.portfolio));
    localStorage.setItem('ahc-debts', JSON.stringify(this.debts));
  },

  seedPortfolio() {
    this.portfolio = [
      { id: 'spy', name: 'S&P 500', lots: [], current: null, history: [] },
      { id: 'msci', name: 'MSCI World', lots: [], current: null, history: [] },
      { id: 'gold', name: 'Oro', lots: [], current: null, history: [] }
    ];
  },

  seedDebts() {
    this.debts = [
      { id: 'l1', name: 'Préstamo *8602', initial: 5544, remaining: 5544, tin: 4.2, tae: null, totalMonths: null, remainingMonths: null, monthly: 69 },
      { id: 'l2', name: 'Préstamo *7491', initial: 15924, remaining: 15924, tin: 4.2, tae: null, totalMonths: null, remainingMonths: null, monthly: 210 }
    ];
  },

  normalize() {
    if (!Array.isArray(this.portfolio) || this.portfolio.length === 0) this.seedPortfolio();
    this.portfolio.forEach(a => {
      if (!a.lots || !Array.isArray(a.lots)) a.lots = [];
      if (!Array.isArray(a.history)) a.history = [];
    });
    if (!Array.isArray(this.debts) || this.debts.length === 0) this.seedDebts();
    this.debts.forEach(d => {
      if (d.remaining === undefined && d.pending !== undefined) d.remaining = d.pending;
      if (d.initial === undefined) d.initial = d.remaining !== undefined ? d.remaining : 0;
      if (d.tin === undefined) d.tin = null;
      if (d.tae === undefined) d.tae = null;
      if (d.totalMonths === undefined) d.totalMonths = null;
      if (d.remainingMonths === undefined) d.remainingMonths = null;
      if (d.monthly === undefined) d.monthly = null;
    });
  },

  setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('save-date').value = today;
    document.getElementById('house-date').value = today;
  },

  // ---- Cálculos ----
  get ahorroCash() {
    return this.savings.length > 0 ? this.savings[this.savings.length - 1].amount : 0;
  },
  costBasis(a) { return (a.lots || []).reduce((s, l) => s + (l.cost || 0), 0); },
  assetValue(a) { return a.current !== null && a.current !== undefined ? a.current : this.costBasis(a); },
  get portfolioValue() { return this.portfolio.reduce((s, a) => s + this.assetValue(a), 0); },
  get totalSaved() { return this.ahorroCash + this.portfolioValue; },
  get totalDebt() { return this.debts.reduce((s, d) => s + d.pending, 0); },
  get netWorth() { return this.totalSaved - this.totalDebt; },
  get houseNow() {
    return this.housePrices.length > 0 ? this.housePrices[this.housePrices.length - 1].price : 400000;
  },
  get targetToday() {
    const ratio = (this.houseParams.entryPct + this.houseParams.taxesPct) / 100;
    return this.houseNow * ratio;
  },

  calcSavingsRate() {
    if (this.savings.length < 2) return null;
    const sorted = [...this.savings].sort((a, b) => a.date.localeCompare(b.date));
    const n = sorted.length;
    let sx = 0, sy = 0, sxy = 0, sx2 = 0;
    const base = new Date(sorted[0].date).getTime();
    sorted.forEach(s => {
      const x = (new Date(s.date).getTime() - base) / 86400000;
      const y = s.amount;
      sx += x; sy += y; sxy += x * y; sx2 += x * x;
    });
    const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
    const daily = slope;
    return { daily, monthly: daily * 30 };
  },

  calcHouseRate() {
    if (this.housePrices.length < 2) return null;
    const sorted = [...this.housePrices].sort((a, b) => a.date.localeCompare(b.date));
    const n = sorted.length;
    let sx = 0, sy = 0, sxy = 0, sx2 = 0;
    const base = new Date(sorted[0].date).getTime();
    sorted.forEach(h => {
      const x = (new Date(h.date).getTime() - base) / 86400000;
      const y = h.price;
      sx += x; sy += y; sxy += x * y; sx2 += x * x;
    });
    const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
    return { daily: slope, monthly: slope * 30 };
  },

  calcMonths() {
    const sr = this.calcSavingsRate();
    if (!sr || sr.monthly <= 0) return Infinity;
    const ratio = (this.houseParams.entryPct + this.houseParams.taxesPct) / 100;
    let saved = this.totalSaved;
    let mo = 0;
    while (mo < 360) {
      mo++;
      saved += sr.monthly;
      const tgt = this.houseNow * Math.pow(1 + this.houseParams.houseInc / 100, mo / 12) * ratio;
      if (saved >= tgt) return mo;
    }
    return 360;
  },

  // ---- Render ----
  render() {
    try { this.renderSituacion(); } catch (e) { console.error('situacion', e); }
    try { this.renderAhorro(); } catch (e) { console.error('ahorro', e); }
    try { this.renderCartera(); } catch (e) { console.error('cartera', e); }
    try { this.renderDeudas(); } catch (e) { console.error('deudas', e); }
  },

  renderSituacion() {
    const months = this.calcMonths();
    const saved = this.totalSaved;
    const tgt = this.targetToday;
    const pct = Math.min(100, tgt > 0 ? (saved / tgt) * 100 : 0);

    const ring = document.getElementById('progress-ring');
    const c = 2 * Math.PI * 85;
    ring.style.strokeDasharray = c;
    ring.style.strokeDashoffset = c - (pct / 100) * c;
    ring.style.stroke = pct >= 80 ? '#00b894' : pct >= 50 ? '#fdcb6e' : '#6c5ce7';
    document.getElementById('progress-pct').textContent = Math.round(pct) + '%';
    document.getElementById('saved-amount').textContent = this.n(saved);
    document.getElementById('target-amount').textContent = this.n(tgt);

    const milestone = pct >= 100 ? { emoji: '🎉', text: '¡Objetivo alcanzado!' } : pct >= 75 ? { emoji: '🔥', text: '¡Estás muy cerca!' } : pct >= 50 ? { emoji: '💪', text: '¡Mitad del camino!' } : pct >= 25 ? { emoji: '🚀', text: '¡Buen progreso!' } : null;
    const msEl = document.getElementById('milestone');
    if (milestone && pct < 100) { msEl.textContent = `${milestone.emoji} ${milestone.text}`; msEl.classList.remove('hidden'); }
    else msEl.classList.add('hidden');

    const cdEl = document.getElementById('countdown');
    if (!isFinite(months)) { cdEl.textContent = '+30 años'; document.getElementById('countdown-date').textContent = 'Registra 2+ ahorros'; }
    else if (months <= 0) { cdEl.textContent = '¡Ya puedes!'; document.getElementById('countdown-date').textContent = ''; }
    else if (months >= 360) { cdEl.textContent = '+30 años'; document.getElementById('countdown-date').textContent = 'Necesitas ahorrar más'; }
    else {
      const y = Math.floor(months / 12), m = Math.round(months % 12);
      cdEl.textContent = y > 0 ? `${y}a ${m}m` : `${m} meses`;
      const d = new Date(); d.setMonth(d.getMonth() + months);
      document.getElementById('countdown-date').textContent = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }

    document.getElementById('stat-cash').textContent = this.n(this.ahorroCash) + ' €';
    document.getElementById('stat-portfolio').textContent = this.n(this.portfolioValue) + ' €';
    document.getElementById('stat-house-now').textContent = this.n(this.houseNow) + ' €';
    document.getElementById('stat-entry').textContent = this.n(tgt) + ' €';

    // Patrimonio breakdown
    let assets = `<div class="breakdown-item"><span class="breakdown-dot" style="background:#9b59b6"></span><span class="breakdown-label">Efectivo</span><span class="breakdown-value">${this.n(this.ahorroCash)} €</span></div>`;
    assets += this.portfolio.map(a => `<div class="breakdown-item"><span class="breakdown-dot" style="background:${this.pfColor(a.id)}"></span><span class="breakdown-label">${a.name}</span><span class="breakdown-value">${this.n(this.assetValue(a))} €</span></div>`).join('');
    assets += `<div class="breakdown-item total"><span class="breakdown-dot" style="background:transparent"></span><span class="breakdown-label">Total</span><span class="breakdown-value">${this.n(this.totalSaved)} €</span></div>`;
    document.getElementById('bd-assets').innerHTML = assets;

    // Deudas breakdown
    let debts = this.debts.map(d => `<div class="breakdown-item"><span class="breakdown-dot" style="background:#e74c3c"></span><span class="breakdown-label">${d.name}</span><span class="breakdown-value">${this.n(d.pending)} €</span></div>`).join('');
    const tMonthly = this.debts.reduce((s, d) => s + d.monthly, 0);
    debts += `<div class="breakdown-item"><span class="breakdown-dot" style="background:#e74c3c"></span><span class="breakdown-label">Cuota mensual</span><span class="breakdown-value">${this.n(tMonthly)} €/mes</span></div>`;
    document.getElementById('bd-debts').innerHTML = debts;

    const nw = this.netWorth;
    const nwEl = document.getElementById('bd-net-worth');
    nwEl.textContent = (nw >= 0 ? '' : '-') + this.n(Math.abs(nw)) + ' €';
    nwEl.style.color = nw >= 0 ? '#00b894' : '#ff6b6b';
  },

  renderAhorro() {
    const sr = this.calcSavingsRate();
    const hr = this.calcHouseRate();
    const months = this.calcMonths();

    document.getElementById('est-daily').textContent = sr ? this.money(sr.daily) + ' €/día' : '—';
    document.getElementById('est-monthly').textContent = sr ? this.money(sr.monthly) + ' €/mes' : '—';
    document.getElementById('est-house').textContent = hr ? (hr.monthly >= 0 ? '+' : '') + this.n(hr.monthly) + ' €/mes' : '—';
    const est = document.getElementById('est-countdown');
    if (!isFinite(months) || months >= 360) est.textContent = 'Necesitas 2+ datos';
    else if (months <= 0) est.textContent = '¡Ya puedes!';
    else est.textContent = `${Math.floor(months / 12)} años y ${Math.round(months % 12)} meses`;

    // House params
    document.getElementById('set-entry-pct').value = this.houseParams.entryPct;
    document.getElementById('set-taxes-pct').value = this.houseParams.taxesPct;
    document.getElementById('set-house-inc').value = this.houseParams.houseInc;

    // Savings list
    const sl = document.getElementById('savings-list');
    if (this.savings.length === 0) sl.innerHTML = '<p class="data-empty">Sin datos. Pulsa "+ Añadir" para registrar tu ahorro.</p>';
    else {
      const sorted = [...this.savings].sort((a, b) => b.date.localeCompare(a.date));
      sl.innerHTML = sorted.map(s => `
        <div class="data-item">
          <div>
            <div class="data-date">${this.fmtDate(s.date)}</div>
            ${s.note ? `<div class="data-note">${s.note}</div>` : ''}
          </div>
          <div class="data-right">
            <span class="data-value">${this.money(s.amount)} €</span>
            <button class="data-edit" data-type="saving" data-date="${s.date}" title="Editar">✏️</button>
            <button class="data-delete" data-type="saving" data-date="${s.date}" title="Eliminar">✕</button>
          </div>
        </div>`).join('');
    }

    // House list
    const hl = document.getElementById('house-list');
    if (this.housePrices.length === 0) hl.innerHTML = '<p class="data-empty">Sin datos. Pulsa "+ Precio" para registrar.</p>';
    else {
      const sorted = [...this.housePrices].sort((a, b) => b.date.localeCompare(a.date));
      hl.innerHTML = sorted.map(h => `
        <div class="data-item">
          <div>
            <div class="data-date">${this.fmtDate(h.date)}</div>
            ${h.note ? `<div class="data-note">${h.note}</div>` : ''}
          </div>
          <div class="data-right">
            <span class="data-value">${this.n(h.price)} €</span>
            <button class="data-edit" data-type="house" data-date="${h.date}" title="Editar">✏️</button>
            <button class="data-delete" data-type="house" data-date="${h.date}" title="Eliminar">✕</button>
          </div>
        </div>`).join('');
    }

    sl.querySelectorAll('.data-edit').forEach(b => b.addEventListener('click', () => this.editEntry('saving', b.dataset.date)));
    sl.querySelectorAll('.data-delete').forEach(b => b.addEventListener('click', () => this.delEntry('saving', b.dataset.date)));
    hl.querySelectorAll('.data-edit').forEach(b => b.addEventListener('click', () => this.editEntry('house', b.dataset.date)));
    hl.querySelectorAll('.data-delete').forEach(b => b.addEventListener('click', () => this.delEntry('house', b.dataset.date)));
  },

  renderCartera() {
    const totalCost = this.portfolio.reduce((s, a) => s + this.costBasis(a), 0);
    const totalVal = this.portfolioValue;
    const pnl = totalVal - totalCost;
    const pct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
    const color = pnl > 0 ? '#00b894' : pnl < 0 ? '#ff6b6b' : '#e8e8f0';

    document.getElementById('pf-cost').textContent = this.money(totalCost) + ' €';
    document.getElementById('pf-value').textContent = this.money(totalVal) + ' €';
    const pnlEl = document.getElementById('pf-pnl');
    pnlEl.textContent = (pnl >= 0 ? '+' : '−') + this.money(Math.abs(pnl)) + ' €';
    pnlEl.style.color = color;
    const pctEl = document.getElementById('pf-pct');
    pctEl.textContent = totalCost > 0 ? (pnl >= 0 ? '+' : '−') + this.money(Math.abs(pct)) + '%' : '—';
    pctEl.style.color = color;

    const list = document.getElementById('portfolio-list');
    list.innerHTML = this.portfolio.map(a => {
      const cb = this.costBasis(a);
      const val = this.assetValue(a);
      const apnl = val - cb;
      const apct = cb > 0 ? (apnl / cb) * 100 : 0;
      const acolor = apnl > 0 ? '#00b894' : apnl < 0 ? '#ff6b6b' : 'var(--text-dim)';
      const set = a.current !== null && a.current !== undefined;
      const lotsHtml = a.lots.length === 0
        ? '<p class="data-empty">Sin compras aún.</p>'
        : [...a.lots].sort((x, y) => y.date.localeCompare(x.date)).map(l => `
          <div class="data-item">
            <div>
              <div class="data-date">${this.fmtDate(l.date)}</div>
              ${l.note ? `<div class="data-note">${l.note}</div>` : ''}
            </div>
            <div class="data-right">
              <span class="data-value">${this.money(l.cost)} €</span>
              <button class="data-edit" data-act="editlot" data-id="${a.id}" data-date="${l.date}" title="Editar">✏️</button>
              <button class="data-delete" data-act="dellot" data-id="${a.id}" data-date="${l.date}" title="Eliminar">✕</button>
            </div>
          </div>`).join('');
      return `
        <div class="calc-section">
          <div class="calc-header">
            <h3>📊 ${a.name}</h3>
            <button class="btn-small" data-act="buy" data-id="${a.id}" title="Registrar compra">＋ Compra</button>
          </div>
          <div class="breakdown-list" style="margin-bottom:10px">
            <div class="breakdown-item"><span class="breakdown-dot" style="background:${this.pfColor(a.id)}"></span><span class="breakdown-label">Coste</span><span class="breakdown-value">${this.money(cb)} €</span></div>
            <div class="breakdown-item"><span class="breakdown-dot" style="background:${this.pfColor2(a.id)}"></span><span class="breakdown-label">Valor actual</span><span class="breakdown-value">${set ? this.money(val) + ' €' : '—'}</span></div>
            <div class="breakdown-item"><span class="breakdown-dot" style="background:transparent"></span><span class="breakdown-label">P/L</span><span class="breakdown-value" style="color:${acolor}">${apnl >= 0 ? '+' : '−'}${this.money(Math.abs(apnl))} € (${cb > 0 ? (apnl >= 0 ? '+' : '−') + this.money(Math.abs(apct)) + '%' : '—'})</span></div>
          </div>
          <div class="chart-container">
            <canvas id="chart-${a.id}"></canvas>
          </div>
          <div class="calc-header" style="border-top:1px solid var(--card-border); padding-top:10px">
            <span style="font-size:12px;color:var(--text-dim)">Compras</span>
            <button class="btn-small" data-act="value" data-id="${a.id}" title="Actualizar valor actual">🔄 Valor</button>
          </div>
          <div class="data-list">${lotsHtml}</div>
        </div>`;
    }).join('');

    list.querySelectorAll('[data-act]').forEach(el => {
      el.addEventListener('click', () => {
        const act = el.dataset.act, id = el.dataset.id, date = el.dataset.date;
        if (act === 'buy') this.openBuyModal(id);
        else if (act === 'value') this.openValueModal(id);
        else if (act === 'editlot') this.openBuyModal(id, this.assetById(id).lots.find(l => l.date === date));
        else if (act === 'dellot') {
          if (!confirm('¿Eliminar esta compra?')) return;
          this.assetById(id).lots = this.assetById(id).lots.filter(l => l.date !== date);
          this.save(); if (FirebaseSync.isLoggedIn()) FirebaseSync.saveToCloud();
          this.render();
        }
      });
    });

    this.portfolio.forEach(a => this.renderAssetChart(a));
  },

  renderAssetChart(a) {
    const canvas = document.getElementById('chart-' + a.id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = (canvas.parentElement.offsetWidth || 300) - 6;
    const h = canvas.height = 140;
    ctx.clearRect(0, 0, w, h);
    if (!Array.isArray(a.history) || a.history.length < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Actualiza el valor al menos 2 días para ver la gráfica', w / 2, h / 2);
      return;
    }
    const sorted = [...(a.history || [])].sort((x, y) => x.date.localeCompare(y.date));
    const vp = sorted.map(p => p.value);
    const cb = this.costBasis(a);
    const gp = sorted.map(p => p.value - cb);
    const all = [...vp, ...gp];
    const minV = Math.min(...all, 0) * 1.05;
    const maxV = Math.max(...all) * 1.05;
    const range = maxV - minV || 1;
    const padX = 8, padY = 12;
    const cw = w - padX * 2, ch = h - padY * 2;
    const X = i => padX + (i / (sorted.length - 1)) * cw;
    const Y = v => padY + ch - ((v - minV) / range) * ch;

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 3; g++) { const y = padY + (ch / 3) * g; ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(w - padX, y); ctx.stroke(); }

    // gain line (dashed)
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = gp.some(v => v < 0) ? '#ff6b6b' : '#00b894';
    ctx.lineWidth = 2;
    ctx.beginPath();
    gp.forEach((v, i) => { i === 0 ? ctx.moveTo(X(i), Y(v)) : ctx.lineTo(X(i), Y(v)); });
    ctx.stroke();
    ctx.setLineDash([]);

    // value line (solid)
    ctx.strokeStyle = '#6c5ce7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    vp.forEach((v, i) => { i === 0 ? ctx.moveTo(X(i), Y(v)) : ctx.lineTo(X(i), Y(v)); });
    ctx.stroke();

    // points
    vp.forEach((v, i) => { ctx.fillStyle = '#a29bfe'; ctx.beginPath(); ctx.arc(X(i), Y(v), 3, 0, Math.PI * 2); ctx.fill(); });

    // legend
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#a29bfe'; ctx.fillRect(8, 2, 8, 8); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText('Valor', 20, 10);
    ctx.fillStyle = gp.some(v => v < 0) ? '#ff6b6b' : '#00b894'; ctx.fillRect(58, 2, 8, 8); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText('Ganancia', 70, 10);
  },

  renderDeudas() {
    const t = this.debts.reduce((s, d) => s + (d.remaining || 0), 0);
    const cuotaTot = this.debts.reduce((s, d) => s + this.debtCuota(d), 0);
    document.getElementById('dq-total').textContent = this.n(t) + ' €';
    document.getElementById('dq-monthly').textContent = this.n(cuotaTot) + ' €/mes';

    const list = document.getElementById('debt-list');
    list.innerHTML = this.debts.map(d => {
      const cuota = this.debtCuota(d);
      const restMon = d.remainingMonths !== null ? d.remainingMonths : '—';
      const totMon = d.totalMonths !== null ? d.totalMonths : '—';
      const pct = d.initial && d.initial > 0 ? Math.min(100, Math.round((1 - d.remaining / d.initial) * 100)) : 0;
      return `
        <div class="calc-section">
          <div class="calc-header">
            <h3>🏦 ${d.name}</h3>
            <div style="display:flex;gap:6px">
              <button class="btn-small" data-pay="${d.id}" title="Descontar mes">📉 Pagar mes</button>
              <button class="btn-small" data-editdeb="${d.id}" title="Editar">✏️</button>
            </div>
          </div>
          <div class="breakdown-list">
            <div class="breakdown-item"><span class="breakdown-dot" style="background:#e74c3c"></span><span class="breakdown-label">Inicial</span><span class="breakdown-value">${this.n(d.initial || 0)} €</span></div>
            <div class="breakdown-item"><span class="breakdown-dot" style="background:#ff7675"></span><span class="breakdown-label">Restante</span><span class="breakdown-value">${this.n(d.remaining)} €</span></div>
            <div class="breakdown-item"><span class="breakdown-dot" style="background:#74b9ff"></span><span class="breakdown-label">TIN / TAE</span><span class="breakdown-value">${d.tin ?? '—'}% / ${d.tae ?? '—'}%</span></div>
            <div class="breakdown-item"><span class="breakdown-dot" style="background:#55efc4"></span><span class="breakdown-label">Meses rest/total</span><span class="breakdown-value">${restMon} / ${totMon}</span></div>
            <div class="breakdown-item"><span class="breakdown-dot" style="background:transparent"></span><span class="breakdown-label">Cuota aprox.</span><span class="breakdown-value">${cuota > 0 ? this.n(cuota) + ' €' : '—'}</span></div>
            <div class="breakdown-item"><span class="breakdown-dot" style="background:transparent"></span><span class="breakdown-label">Progreso</span><span class="breakdown-value" style="color:#a29bfe">${pct}% pagado</span></div>
          </div>
        </div>`;
    }).join('');
    list.querySelectorAll('[data-pay]').forEach(b => b.addEventListener('click', () => this.payDebtMonth(b.dataset.pay)));
    list.querySelectorAll('[data-editdeb]').forEach(b => b.addEventListener('click', () => this.openDebtModal(b.dataset.editdeb)));
  },

  debtCuota(d) {
    if (d.monthly && d.monthly > 0) return d.monthly;
    if (d.remainingMonths && d.remainingMonths > 0) return Math.round(d.remaining / d.remainingMonths);
    return 0;
  },

  payDebtMonth(id) {
    const d = this.debts.find(x => x.id === id);
    if (!d) return;
    const cuota = this.debtCuota(d) || Math.round(d.remaining);
    const amt = prompt('Cuota pagada este mes (€):', cuota);
    if (amt === null) return;
    const p = +amt;
    if (!(p > 0)) return;
    d.remaining = Math.max(0, d.remaining - p);
    if (d.remainingMonths !== null && d.remainingMonths > 0) d.remainingMonths -= 1;
    this.save(); if (FirebaseSync.isLoggedIn()) FirebaseSync.saveToCloud();
    this.render();
  },

  pfColor(id) { return id === 'spy' ? '#3498db' : id === 'msci' ? '#2ecc71' : '#f39c12'; },
  pfColor2(id) { return id === 'spy' ? '#74b9ff' : id === 'msci' ? '#55efc4' : '#ffeaa7'; },

  // ---- Modals ----
  openEntryModal(type, existing) {
    this._edit = existing ? { type, date: existing.date } : null;
    const id = type === 'saving' ? 'modal-saving' : 'modal-house';
    const dateEl = document.getElementById(type === 'saving' ? 'save-date' : 'house-date');
    const amt = document.getElementById(type === 'saving' ? 'save-amount' : 'house-amount');
    const note = document.getElementById(type === 'saving' ? 'save-note' : 'house-note');
    const title = document.querySelector(`#${id} .modal-header h2`);
    if (existing) { dateEl.value = existing.date; amt.value = existing.amount || existing.price; note.value = existing.note || ''; title.textContent = '✏️ Editar'; }
    else { dateEl.value = new Date().toISOString().split('T')[0]; amt.value = ''; note.value = ''; title.textContent = type === 'saving' ? '💰 Registrar ahorro' : '🏠 Registrar precio'; }
    this.open(id);
  },

  saveEntry(type) {
    const dateEl = document.getElementById(type === 'saving' ? 'save-date' : 'house-date');
    const amtEl = document.getElementById(type === 'saving' ? 'save-amount' : 'house-amount');
    const noteEl = document.getElementById(type === 'saving' ? 'save-note' : 'house-note');
    const date = dateEl.value, amt = +amtEl.value, note = noteEl.value.trim();
    if (!date || !(amt >= 0)) return;
    if (type === 'saving') {
      if (this._edit && this._edit.type === 'saving') { const i = this.savings.findIndex(s => s.date === this._edit.date); if (i >= 0) this.savings[i] = { date, amount: amt, note }; }
      else { const i = this.savings.findIndex(s => s.date === date); if (i >= 0) this.savings[i] = { date, amount: amt, note }; else this.savings.push({ date, amount: amt, note }); }
      this.close('modal-saving');
    } else {
      if (this._edit && this._edit.type === 'house') { const i = this.housePrices.findIndex(h => h.date === this._edit.date); if (i >= 0) this.housePrices[i] = { date, price: amt, note }; }
      else { const i = this.housePrices.findIndex(h => h.date === date); if (i >= 0) this.housePrices[i] = { date, price: amt, note }; else this.housePrices.push({ date, price: amt, note }); }
      this.close('modal-house');
    }
    this._edit = null;
    this.save(); if (FirebaseSync.isLoggedIn()) FirebaseSync.saveToCloud();
    this.render();
  },

  editEntry(type, date) {
    const arr = type === 'saving' ? this.savings : this.housePrices;
    const e = arr.find(x => x.date === date);
    if (e) this.openEntryModal(type, e);
  },

  delEntry(type, date) {
    if (!confirm('¿Eliminar esta entrada?')) return;
    if (type === 'saving') this.savings = this.savings.filter(s => s.date !== date);
    else this.housePrices = this.housePrices.filter(h => h.date !== date);
    this.save(); if (FirebaseSync.isLoggedIn()) FirebaseSync.saveToCloud();
    this.render();
  },

  assetById(id) { return this.portfolio.find(a => a.id === id); },

  _buy: null,
  _valueAsset: null,
  openBuyModal(assetId, existingLot) {
    this._buy = existingLot ? { assetId, date: existingLot.date } : null;
    const a = this.assetById(assetId);
    document.getElementById('buy-asset').value = a.name;
    document.getElementById('buy-title').textContent = existingLot ? '✏️ Editar compra' : '💸 Registrar compra';
    document.getElementById('buy-date').value = existingLot ? existingLot.date : new Date().toISOString().split('T')[0];
    document.getElementById('buy-amount').value = existingLot ? existingLot.cost : '';
    document.getElementById('buy-note').value = existingLot ? (existingLot.note || '') : '';
    this.open('modal-buy');
  },
  saveBuy() {
    const assetId = this._buy ? this._buy.assetId : null;
    const a = this.assetById(assetId);
    if (!a) return;
    const date = document.getElementById('buy-date').value;
    const cost = +document.getElementById('buy-amount').value;
    const note = document.getElementById('buy-note').value.trim();
    if (!date || !(cost >= 0)) return;
    if (this._buy && this._buy.date) { const i = a.lots.findIndex(l => l.date === this._buy.date); if (i >= 0) a.lots[i] = { date, cost, note }; }
    else { const i = a.lots.findIndex(l => l.date === date); if (i >= 0) a.lots[i] = { date, cost, note }; else a.lots.push({ date, cost, note }); }
    this._buy = null;
    this.save(); if (FirebaseSync.isLoggedIn()) FirebaseSync.saveToCloud();
    this.render(); this.close('modal-buy');
    document.getElementById('buy-amount').value = ''; document.getElementById('buy-note').value = '';
  },
  openValueModal(assetId) {
    this._valueAsset = assetId;
    const a = this.assetById(assetId);
    document.getElementById('value-asset').value = a.name;
    document.getElementById('value-input').value = a.current !== null && a.current !== undefined ? a.current : '';
    this.open('modal-value');
  },
  saveValue() {
    const a = this.assetById(this._valueAsset);
    if (!a) return;
    const v = +document.getElementById('value-input').value;
    if (!(v >= 0)) return;
    a.current = v;
    const today = new Date().toISOString().split('T')[0];
    const existing = a.history.find(p => p.date === today);
    if (existing) existing.value = v; else a.history.push({ date: today, value: v });
    a.history = a.history.slice(-30);
    this._valueAsset = null;
    this.save(); if (FirebaseSync.isLoggedIn()) FirebaseSync.saveToCloud();
    this.render(); this.close('modal-value');
    document.getElementById('value-input').value = '';
  },

  _debt: null,
  openDebtModal(id) {
    this._debt = id;
    const d = this.debts.find(x => x.id === id);
    if (!d) return;
    document.getElementById('debt-name').value = d.name;
    document.getElementById('debt-initial').value = d.initial || 0;
    document.getElementById('debt-remaining').value = d.remaining;
    document.getElementById('debt-tin').value = d.tin ?? '';
    document.getElementById('debt-tae').value = d.tae ?? '';
    document.getElementById('debt-total-months').value = d.totalMonths ?? '';
    document.getElementById('debt-rem-months').value = d.remainingMonths ?? '';
    document.getElementById('debt-monthly').value = d.monthly ?? '';
    this.open('modal-debt');
  },
  saveDebt() {
    const d = this.debts.find(x => x.id === this._debt);
    if (!d) return;
    const num = el => { const v = +document.getElementById(el).value; return isNaN(v) ? 0 : v; };
    const blank = el => document.getElementById(el).value === '';
    d.initial = Math.max(0, num('debt-initial'));
    d.remaining = Math.max(0, num('debt-remaining'));
    d.tin = blank('debt-tin') ? null : num('debt-tin');
    d.tae = blank('debt-tae') ? null : num('debt-tae');
    d.totalMonths = blank('debt-total-months') ? null : Math.max(0, num('debt-total-months'));
    d.remainingMonths = blank('debt-rem-months') ? null : Math.max(0, num('debt-rem-months'));
    d.monthly = blank('debt-monthly') ? null : num('debt-monthly');
    this._debt = null;
    this.save(); if (FirebaseSync.isLoggedIn()) FirebaseSync.saveToCloud();
    this.render(); this.close('modal-debt');
  },

  saveHouseParams() {
    this.houseParams.entryPct = +document.getElementById('set-entry-pct').value || 0;
    this.houseParams.taxesPct = +document.getElementById('set-taxes-pct').value || 0;
    this.houseParams.houseInc = +document.getElementById('set-house-inc').value || 0;
    this.save(); if (FirebaseSync.isLoggedIn()) FirebaseSync.saveToCloud();
    this.render();
  },

  // ---- Events ----
  bindEvents() {
    document.getElementById('btn-login').addEventListener('click', () => this.open('modal-login'));
    document.getElementById('login-close').addEventListener('click', () => this.close('modal-login'));
    document.getElementById('modal-login').addEventListener('click', e => { if (e.target.id === 'modal-login') this.close('modal-login'); });
    document.getElementById('btn-google-login').addEventListener('click', async () => { try { await FirebaseSync.signInGoogle(); this.close('modal-login'); } catch (e) { alert('Error: ' + e.message); } });
    document.getElementById('form-email-login').addEventListener('submit', async (e) => { e.preventDefault(); try { await FirebaseSync.signInEmail(document.getElementById('login-email').value, document.getElementById('login-password').value); this.close('modal-login'); } catch (err) { alert('Error: ' + err.message); } });
    document.getElementById('btn-logout').addEventListener('click', async () => { if (confirm('¿Cerrar sesión?')) await FirebaseSync.signOut(); });

    // Nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
        document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
        if (btn.dataset.tab === 'cartera') this.portfolio.forEach(a => this.renderAssetChart(a));
      });
    });

    // House params live save
    ['set-entry-pct', 'set-taxes-pct', 'set-house-inc'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this.saveHouseParams());
    });

    // Saving modal
    document.getElementById('btn-add-saving').addEventListener('click', () => this.openEntryModal('saving'));
    document.getElementById('saving-close').addEventListener('click', () => this.close('modal-saving'));
    document.getElementById('btn-do-save').addEventListener('click', () => this.saveEntry('saving'));

    // House modal
    document.getElementById('btn-add-house').addEventListener('click', () => this.openEntryModal('house'));
    document.getElementById('house-close').addEventListener('click', () => this.close('modal-house'));
    document.getElementById('btn-do-house').addEventListener('click', () => this.saveEntry('house'));

    // Buy modal
    document.getElementById('buy-close').addEventListener('click', () => this.close('modal-buy'));
    document.getElementById('btn-do-buy').addEventListener('click', () => this.saveBuy());

    // Value modal
    document.getElementById('value-close').addEventListener('click', () => this.close('modal-value'));
    document.getElementById('btn-do-value').addEventListener('click', () => this.saveValue());

    // Debt modal
    document.getElementById('debt-close').addEventListener('click', () => this.close('modal-debt'));
    document.getElementById('btn-do-debt').addEventListener('click', () => this.saveDebt());

    // Backdrop
    ['modal-login', 'modal-saving', 'modal-house', 'modal-buy', 'modal-value', 'modal-debt'].forEach(id => {
      document.getElementById(id).addEventListener('click', e => { if (e.target === document.getElementById(id)) this.close(id); });
    });
  },

  open(id) { document.getElementById(id).classList.remove('hidden'); },
  close(id) { document.getElementById(id).classList.add('hidden'); },
  n(v) { return Math.round(v).toLocaleString('es-ES'); },
  money(v) { return (v ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 2 }); },
  fmtDate(d) {
    const [y, m] = d.split('-');
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${months[+m - 1]} ${y}`;
  }
};

App.init();