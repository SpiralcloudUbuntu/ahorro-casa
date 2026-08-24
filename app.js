// Ahorro Casa PWA — v3
const App = {
  settings: {
    housePrice: 400000, entryPct: 10, taxesPct: 10, houseInc: 5,
    soloMonthly: 450, bothMonthly: 1500,
    spy: 316, msci: 58, gold: 51, cash: 1410, spyMonthly: 50,
    loan1: 5544, loan2: 15924, loanMonthly: 279
  },
  savings: [],
  housePrices: [],
  portfolio: [],
  scenario: 'solo',

  init() {
    this.load();
    FirebaseSync.init();
    this.bindEvents();
    this.setDefaultDates();
    this.render();
    this.pinNav();
  },
  pinNav() {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    nav.style.position = 'fixed';
    nav.style.bottom = '0';
    nav.style.left = '0';
    nav.style.right = '0';
    nav.style.width = '100%';
    nav.style.display = 'flex';
    nav.style.zIndex = '999999';
    nav.style.background = '#0a0a1a';
    nav.style.transform = 'none';
  },

  load() {
    try {
      const s = localStorage.getItem('ahc-settings');
      if (s) Object.assign(this.settings, JSON.parse(s));
      const sv = localStorage.getItem('ahc-savings');
      if (sv) this.savings = JSON.parse(sv);
      const hp = localStorage.getItem('ahc-house');
      if (hp) this.housePrices = JSON.parse(hp);
      const pf = localStorage.getItem('ahc-portfolio');
      if (pf) this.portfolio = JSON.parse(pf);
      if (!Array.isArray(this.portfolio) || this.portfolio.length === 0) this.seedPortfolio();
    } catch(e) {}
  },

  save() {
    localStorage.setItem('ahc-settings', JSON.stringify(this.settings));
    localStorage.setItem('ahc-savings', JSON.stringify(this.savings));
    localStorage.setItem('ahc-house', JSON.stringify(this.housePrices));
    localStorage.setItem('ahc-portfolio', JSON.stringify(this.portfolio));
  },

  setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('save-date').value = today;
    document.getElementById('house-date').value = today;
  },

  // --- Calculations ---
  get totalSaved() {
    return this.settings.spy + this.settings.msci + this.settings.gold + this.settings.cash;
  },

  get totalDebt() {
    return this.settings.loan1 + this.settings.loan2;
  },

  get netWorth() {
    return this.totalSaved - this.totalDebt;
  },

  get targetToday() {
    const h = this.settings.housePrice;
    return h * (this.settings.entryPct / 100) + h * (this.settings.taxesPct / 100);
  },

  get monthly() {
    return this.scenario === 'solo' ? this.settings.soloMonthly : this.settings.bothMonthly;
  },

  calcMonths() {
    const m = this.monthly + this.settings.spyMonthly;
    if (m <= 0) return Infinity;
    let acc = this.totalSaved;
    let mo = 0;
    while (mo < 360) {
      mo++;
      acc += m;
      const tgt = this.targetToday * Math.pow(1 + this.settings.houseInc / 100, mo / 12);
      if (acc >= tgt) return mo;
    }
    return 360;
  },

  // Better savings rate using linear regression
  calcSavingsRate() {
    if (this.savings.length < 2) return null;
    const sorted = [...this.savings].sort((a, b) => a.date.localeCompare(b.date));
    
    // Linear regression: y = mx + b
    const n = sorted.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const baseDate = new Date(sorted[0].date).getTime();
    
    sorted.forEach(s => {
      const x = (new Date(s.date).getTime() - baseDate) / (1000 * 60 * 60 * 24); // days
      const y = s.amount;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const daily = slope;
    const monthly = daily * 30;
    const totalDays = (new Date(sorted[n-1].date).getTime() - baseDate) / (1000 * 60 * 60 * 24);
    
    return { daily, monthly, days: totalDays, entries: n };
  },

  calcHouseRate() {
    if (this.housePrices.length < 2) return null;
    const sorted = [...this.housePrices].sort((a, b) => a.date.localeCompare(b.date));
    const n = sorted.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const baseDate = new Date(sorted[0].date).getTime();
    
    sorted.forEach(h => {
      const x = (new Date(h.date).getTime() - baseDate) / (1000 * 60 * 60 * 24);
      const y = h.price;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return { daily: slope, monthly: slope * 30 };
  },

  calcRealCountdown() {
    const sr = this.calcSavingsRate();
    const hr = this.calcHouseRate();
    if (!sr || sr.monthly <= 0) return null;

    const currentSaved = this.savings.length > 0 ? this.savings[this.savings.length - 1].amount : this.totalSaved;
    const currentHouse = this.housePrices.length > 0 ? this.housePrices[this.housePrices.length - 1].price : this.settings.housePrice;
    const entryPct = (this.settings.entryPct + this.settings.taxesPct) / 100;

    let months = 0;
    let saved = currentSaved;
    let housePrice = currentHouse;

    while (months < 360) {
      months++;
      saved += sr.monthly;
      if (hr) housePrice += hr.monthly;
      if (saved >= housePrice * entryPct) return months;
    }
    return null;
  },

  // Milestones
  getMilestone() {
    const pct = (this.totalSaved / this.targetToday) * 100;
    if (pct >= 100) return { emoji: '🎉', text: '¡Objetivo alcanzado!' };
    if (pct >= 75) return { emoji: '🔥', text: '¡Estás muy cerca!' };
    if (pct >= 50) return { emoji: '💪', text: '¡Mitad del camino!' };
    if (pct >= 25) return { emoji: '🚀', text: '¡Buen progreso!' };
    return null;
  },

  // --- Render ---
  render() {
    this.renderSituacion();
    this.renderCalculadora();
    this.renderCartera();
  },

  renderSituacion() {
    const months = this.calcMonths();
    const pct = Math.min(100, (this.totalSaved / this.targetToday) * 100);
    const houseThen = months < 360 ? this.settings.housePrice * Math.pow(1 + this.settings.houseInc / 100, months / 12) : this.settings.housePrice;
    const targetThen = houseThen * ((this.settings.entryPct + this.settings.taxesPct) / 100);

    // Ring
    const ring = document.getElementById('progress-ring');
    const c = 2 * Math.PI * 85;
    ring.style.strokeDasharray = c;
    ring.style.strokeDashoffset = c - (pct / 100) * c;
    ring.style.stroke = pct >= 80 ? '#00b894' : pct >= 50 ? '#fdcb6e' : '#6c5ce7';

    document.getElementById('progress-pct').textContent = Math.round(pct) + '%';
    document.getElementById('saved-amount').textContent = this.n(this.totalSaved);
    document.getElementById('target-amount').textContent = this.n(this.targetToday);

    // Milestone
    const milestone = this.getMilestone();
    const milestoneEl = document.getElementById('milestone');
    if (milestone && pct < 100) {
      milestoneEl.textContent = `${milestone.emoji} ${milestone.text}`;
      milestoneEl.classList.remove('hidden');
    } else {
      milestoneEl.classList.add('hidden');
    }

    // Countdown
    if (months <= 0) {
      document.getElementById('countdown').textContent = '¡Ya puedes!';
      document.getElementById('countdown-date').textContent = '';
    } else if (months >= 360) {
      document.getElementById('countdown').textContent = '+30 años';
      document.getElementById('countdown-date').textContent = 'Necesitas ahorrar más';
    } else {
      const y = Math.floor(months / 12), m = Math.round(months % 12);
      document.getElementById('countdown').textContent = y > 0 ? `${y}a ${m}m` : `${m} meses`;
      const d = new Date(); d.setMonth(d.getMonth() + months);
      document.getElementById('countdown-date').textContent = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }

    // Stats
    document.getElementById('stat-monthly').textContent = this.n(this.monthly) + ' €';
    document.getElementById('stat-house-now').textContent = this.n(this.settings.housePrice) + ' €';
    document.getElementById('stat-house-then').textContent = this.n(Math.round(houseThen)) + ' €';
    document.getElementById('stat-entry').textContent = this.n(Math.round(targetThen)) + ' €';

    // Breakdown - Patrimonio
    document.getElementById('bd-spy').textContent = this.n(this.settings.spy) + ' €';
    document.getElementById('bd-msci').textContent = this.n(this.settings.msci) + ' €';
    document.getElementById('bd-gold').textContent = this.n(this.settings.gold) + ' €';
    document.getElementById('bd-cash').textContent = this.n(this.settings.cash) + ' €';
    document.getElementById('bd-total').textContent = this.n(this.totalSaved) + ' €';

    // Breakdown - Préstamos
    document.getElementById('bd-loan1').textContent = this.n(this.settings.loan1) + ' €';
    document.getElementById('bd-loan2').textContent = this.n(this.settings.loan2) + ' €';
    document.getElementById('bd-loan-m').textContent = this.n(this.settings.loanMonthly) + ' €/mes';

    // Net worth
    const nw = this.netWorth;
    document.getElementById('bd-net-worth').textContent = (nw >= 0 ? '' : '-') + this.n(Math.abs(nw)) + ' €';
    document.getElementById('bd-net-worth').style.color = nw >= 0 ? '#00b894' : '#ff6b6b';

    // Scenario buttons
    document.querySelectorAll('.scenario-btn').forEach(b => b.classList.toggle('active', b.dataset.scenario === this.scenario));
  },

  renderCalculadora() {
    const sr = this.calcSavingsRate();
    const hr = this.calcHouseRate();
    const rc = this.calcRealCountdown();

    document.getElementById('est-daily').textContent = sr ? this.n(sr.daily) + ' €/día' : '—';
    document.getElementById('est-monthly').textContent = sr ? this.n(sr.monthly) + ' €/mes' : '—';
    document.getElementById('est-house').textContent = hr ? (hr.monthly >= 0 ? '+' : '') + this.n(hr.monthly) + ' €/mes' : '—';

    if (rc !== null) {
      const y = Math.floor(rc / 12), m = Math.round(rc % 12);
      document.getElementById('est-countdown').textContent = y > 0 ? `${y} años y ${m} meses` : `${m} meses`;
    } else {
      document.getElementById('est-countdown').textContent = sr ? 'Ahorro insuficiente' : 'Introduce 2+ datos';
    }

    // Savings list
    const sl = document.getElementById('savings-list');
    if (this.savings.length === 0) {
      sl.innerHTML = '<p class="data-empty">Sin datos. Pulsa "+ Añadir" para registrar tu ahorro actual.</p>';
    } else {
      const sorted = [...this.savings].sort((a, b) => b.date.localeCompare(a.date));
      sl.innerHTML = sorted.map(s => `
        <div class="data-item">
          <div>
            <div class="data-date">${this.fmtDate(s.date)}</div>
            ${s.note ? `<div class="data-note">${s.note}</div>` : ''}
          </div>
          <div class="data-right">
            <span class="data-value">${this.n(s.amount)} €</span>
            <button class="data-edit" data-type="saving" data-date="${s.date}" title="Editar">✏️</button>
            <button class="data-delete" data-type="saving" data-date="${s.date}" title="Eliminar">✕</button>
          </div>
        </div>
      `).join('');
    }

    // House price list
    const hl = document.getElementById('house-list');
    if (this.housePrices.length === 0) {
      hl.innerHTML = '<p class="data-empty">Sin datos. Pulsa "+ Añadir" cuando busques o actualices precio.</p>';
    } else {
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
        </div>
      `).join('');
    }

    // Chart
    this.renderChart();

    // Edit buttons
    document.querySelectorAll('.data-edit').forEach(btn => {
      btn.addEventListener('click', () => this.editEntry(btn.dataset.type, btn.dataset.date));
    });

    // Delete buttons
    document.querySelectorAll('.data-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('¿Eliminar esta entrada?')) return;
        const type = btn.dataset.type;
        const date = btn.dataset.date;
        if (type === 'saving') this.savings = this.savings.filter(s => s.date !== date);
        else this.housePrices = this.housePrices.filter(h => h.date !== date);
        this.save();
        if (FirebaseSync.isLoggedIn()) FirebaseSync.saveToCloud();
        this.render();
      });
    });
  },

  renderChart() {
    const canvas = document.getElementById('chart-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.offsetWidth - 40;
    const h = canvas.height = 160;
    ctx.clearRect(0, 0, w, h);

    if (this.savings.length < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Introduce 2+ datos para ver el gráfico', w/2, h/2);
      return;
    }

    const sorted = [...this.savings].sort((a, b) => a.date.localeCompare(b.date));
    const values = sorted.map(s => s.amount);
    const minV = Math.min(...values) * 0.9;
    const maxV = Math.max(...values) * 1.1;
    const range = maxV - minV || 1;

    const padX = 40, padY = 20;
    const chartW = w - padX * 2;
    const chartH = h - padY * 2;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padY + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - padX, y);
      ctx.stroke();
    }

    // Line
    ctx.strokeStyle = '#6c5ce7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    sorted.forEach((s, i) => {
      const x = padX + (i / (sorted.length - 1)) * chartW;
      const y = padY + chartH - ((s.amount - minV) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
    sorted.forEach((s, i) => {
      const x = padX + (i / (sorted.length - 1)) * chartW;
      const y = padY + chartH - ((s.amount - minV) / range) * chartH;
      ctx.fillStyle = '#6c5ce7';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(this.n(maxV) + '€', padX - 4, padY + 4);
    ctx.fillText(this.n(minV) + '€', padX - 4, padY + chartH + 4);
  },

  // --- Events ---
  bindEvents() {
    // Login
    document.getElementById('btn-login').addEventListener('click', () => this.open('modal-login'));
    document.getElementById('login-close').addEventListener('click', () => this.close('modal-login'));
    document.getElementById('modal-login').addEventListener('click', e => { if (e.target.id === 'modal-login') this.close('modal-login'); });
    document.getElementById('btn-google-login').addEventListener('click', async () => {
      try { await FirebaseSync.signInGoogle(); this.close('modal-login'); } catch (e) { alert('Error: ' + e.message); }
    });
    document.getElementById('form-email-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await FirebaseSync.signInEmail(document.getElementById('login-email').value, document.getElementById('login-password').value); this.close('modal-login'); } catch (err) { alert('Error: ' + err.message); }
    });
    document.getElementById('btn-logout').addEventListener('click', async () => {
      if (confirm('¿Cerrar sesión? Tus datos siguen en este dispositivo.')) await FirebaseSync.signOut();
    });

    // Bottom nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
        document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
        if (btn.dataset.tab === 'calculadora') this.renderChart();
        if (btn.dataset.tab === 'cartera') this.renderCartera();
      });
    });

    // Scenario
    document.querySelectorAll('.scenario-btn').forEach(btn => {
      btn.addEventListener('click', () => { this.scenario = btn.dataset.scenario; this.render(); });
    });

    // Settings
    document.getElementById('btn-settings').addEventListener('click', () => this.openSettings());
    document.getElementById('settings-close').addEventListener('click', () => this.close('modal-settings'));
    document.getElementById('btn-save-settings').addEventListener('click', () => this.saveSettings());
    document.getElementById('btn-reset').addEventListener('click', () => { if (confirm('¿Reset? Se borrarán todos los datos.')) { localStorage.clear(); location.reload(); } });

    // Add saving
    document.getElementById('btn-add-saving').addEventListener('click', () => this.openEntryModal('saving'));
    document.getElementById('saving-close').addEventListener('click', () => this.close('modal-saving'));
    document.getElementById('btn-do-save').addEventListener('click', () => this.saveEntry('saving'));

    // Add house
    document.getElementById('btn-add-house').addEventListener('click', () => this.openEntryModal('house'));
    document.getElementById('house-close').addEventListener('click', () => this.close('modal-house'));
    document.getElementById('btn-do-house').addEventListener('click', () => this.saveEntry('house'));

    // Portfolio (Cartera)
    document.getElementById('buy-close').addEventListener('click', () => this.close('modal-buy'));
    document.getElementById('value-close').addEventListener('click', () => this.close('modal-value'));
    document.getElementById('btn-do-buy').addEventListener('click', () => this.saveBuy());
    document.getElementById('btn-do-value').addEventListener('click', () => this.saveValue());

    // Close on backdrop
    ['modal-settings', 'modal-saving', 'modal-house', 'modal-buy', 'modal-value', 'modal-login'].forEach(id => {
      document.getElementById(id).addEventListener('click', e => { if (e.target === document.getElementById(id)) this.close(id); });
    });
  },

  openSettings() {
    const s = this.settings;
    const map = {
      'set-house-price': 'housePrice', 'set-entry-pct': 'entryPct', 'set-taxes-pct': 'taxesPct',
      'set-house-inc': 'houseInc', 'set-solo-m': 'soloMonthly', 'set-both-m': 'bothMonthly',
      'set-spy': 'spy', 'set-msci': 'msci', 'set-gold': 'gold', 'set-cash': 'cash',
      'set-spy-m': 'spyMonthly', 'set-l1': 'loan1', 'set-l2': 'loan2', 'set-lm': 'loanMonthly'
    };
    for (const [id, key] of Object.entries(map)) {
      document.getElementById(id).value = s[key];
    }
    this.open('modal-settings');
  },

  saveSettings() {
    const map = {
      'set-house-price': 'housePrice', 'set-entry-pct': 'entryPct', 'set-taxes-pct': 'taxesPct',
      'set-house-inc': 'houseInc', 'set-solo-m': 'soloMonthly', 'set-both-m': 'bothMonthly',
      'set-spy': 'spy', 'set-msci': 'msci', 'set-gold': 'gold', 'set-cash': 'cash',
      'set-spy-m': 'spyMonthly', 'set-l1': 'loan1', 'set-l2': 'loan2', 'set-lm': 'loanMonthly'
    };
    for (const [id, key] of Object.entries(map)) {
      this.settings[key] = +document.getElementById(id).value;
    }
    this.save();
    if (FirebaseSync.isLoggedIn()) FirebaseSync.saveToCloud();
    this.render();
    this.close('modal-settings');
  },

  // Unified entry modal (add + edit)
  _editing: null, // { type: 'saving'|'house', date: '...' }

  openEntryModal(type, existingData) {
    this._editing = existingData ? { type, date: existingData.date } : null;
    const modalId = type === 'saving' ? 'modal-saving' : 'modal-house';
    const dateEl = document.getElementById(type === 'saving' ? 'save-date' : 'house-date');
    const amountEl = document.getElementById(type === 'saving' ? 'save-amount' : 'house-amount');
    const noteEl = document.getElementById(type === 'saving' ? 'save-note' : 'house-note');
    const titleEl = document.querySelector(`#${modalId} .modal-header h2`);

    if (existingData) {
      dateEl.value = existingData.date;
      amountEl.value = existingData.amount || existingData.price;
      noteEl.value = existingData.note || '';
      titleEl.textContent = type === 'saving' ? '✏️ Editar ahorro' : '✏️ Editar precio';
    } else {
      dateEl.value = new Date().toISOString().split('T')[0];
      amountEl.value = '';
      noteEl.value = '';
      titleEl.textContent = type === 'saving' ? '💰 Registrar ahorro' : '🏠 Registrar precio';
    }
    this.open(modalId);
  },

  saveEntry(type) {
    const dateEl = document.getElementById(type === 'saving' ? 'save-date' : 'house-date');
    const amountEl = document.getElementById(type === 'saving' ? 'save-amount' : 'house-amount');
    const noteEl = document.getElementById(type === 'saving' ? 'save-note' : 'house-note');

    const date = dateEl.value;
    const amount = +amountEl.value;
    const note = noteEl.value.trim();
    if (!date || !amount) return;

    if (type === 'saving') {
      if (this._editing && this._editing.type === 'saving') {
        // Edit existing
        const idx = this.savings.findIndex(s => s.date === this._editing.date);
        if (idx >= 0) this.savings[idx] = { date, amount, note };
      } else {
        const idx = this.savings.findIndex(s => s.date === date);
        if (idx >= 0) this.savings[idx] = { date, amount, note };
        else this.savings.push({ date, amount, note });
      }
    } else {
      if (this._editing && this._editing.type === 'house') {
        const idx = this.housePrices.findIndex(h => h.date === this._editing.date);
        if (idx >= 0) this.housePrices[idx] = { date, price: amount, note };
      } else {
        const idx = this.housePrices.findIndex(h => h.date === date);
        if (idx >= 0) this.housePrices[idx] = { date, price: amount, note };
        else this.housePrices.push({ date, price: amount, note });
      }
      this.settings.housePrice = amount;
    }

    this._editing = null;
    this.save();
    if (FirebaseSync.isLoggedIn()) FirebaseSync.saveToCloud();
    this.render();
    this.close(type === 'saving' ? 'modal-saving' : 'modal-house');
    amountEl.value = '';
    noteEl.value = '';
  },

  editEntry(type, date) {
    const arr = type === 'saving' ? this.savings : this.housePrices;
    const entry = arr.find(e => e.date === date);
    if (entry) this.openEntryModal(type, entry);
  },

  // --- Portfolio / Cartera ---
  money(v) { return (v ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 2 }); },
  seedPortfolio() {
    this.portfolio = [
      { id: 'spy', name: 'S&P 500', lots: [], current: null },
      { id: 'msci', name: 'MSCI World', lots: [], current: null },
      { id: 'gold', name: 'Oro', lots: [], current: null }
    ];
  },
  assetById(id) { return this.portfolio.find(a => a.id === id); },
  costBasis(a) { return a.lots.reduce((s, l) => s + l.cost, 0); },
  assetValue(a) { return a.current !== null && a.current !== undefined ? a.current : this.costBasis(a); },

  renderCartera() {
    const totalCost = this.portfolio.reduce((s, a) => s + this.costBasis(a), 0);
    const totalVal = this.portfolio.reduce((s, a) => s + this.assetValue(a), 0);
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
      const dot = a.id === 'spy' ? '#3498db' : a.id === 'msci' ? '#2ecc71' : '#f39c12';
      const dot2 = a.id === 'spy' ? '#74b9ff' : a.id === 'msci' ? '#55efc4' : '#ffeaa7';
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
            <div class="breakdown-item"><span class="breakdown-dot" style="background:${dot}"></span><span class="breakdown-label">Coste</span><span class="breakdown-value">${this.money(cb)} €</span></div>
            <div class="breakdown-item"><span class="breakdown-dot" style="background:${dot2}"></span><span class="breakdown-label">Valor actual</span><span class="breakdown-value">${set ? this.money(val) + ' €' : '—'}</span></div>
            <div class="breakdown-item"><span class="breakdown-dot" style="background:transparent"></span><span class="breakdown-label">P/L</span><span class="breakdown-value" style="color:${acolor}">${apnl >= 0 ? '+' : '−'}${this.money(Math.abs(apnl))} € (${cb > 0 ? (apnl >= 0 ? '+' : '−') + this.money(Math.abs(apct)) + '%' : '—'})</span></div>
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
          this.save();
          if (FirebaseSync.isLoggedIn()) FirebaseSync.saveToCloud();
          this.render();
        }
      });
    });
  },

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
    if (this._buy && this._buy.date) {
      const idx = a.lots.findIndex(l => l.date === this._buy.date);
      if (idx >= 0) a.lots[idx] = { date, cost, note };
    } else {
      const idx = a.lots.findIndex(l => l.date === date);
      if (idx >= 0) a.lots[idx] = { date, cost, note };
      else a.lots.push({ date, cost, note });
    }
    this._buy = null;
    this.save();
    if (FirebaseSync.isLoggedIn()) FirebaseSync.saveToCloud();
    this.render();
    this.close('modal-buy');
    document.getElementById('buy-amount').value = '';
    document.getElementById('buy-note').value = '';
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
    this._valueAsset = null;
    this.save();
    if (FirebaseSync.isLoggedIn()) FirebaseSync.saveToCloud();
    this.render();
    this.close('modal-value');
    document.getElementById('value-input').value = '';
  },

  open(id) { document.getElementById(id).classList.remove('hidden'); },
  close(id) { document.getElementById(id).classList.add('hidden'); },
  n(v) { return Math.round(v).toLocaleString('es-ES'); },
  fmtDate(d) {
    const [y, m] = d.split('-');
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${months[+m - 1]} ${y}`;
  }
};

App.init();
