// Ahorro Casa PWA — v2
const App = {
  settings: {
    housePrice: 400000, entryPct: 10, taxesPct: 10, houseInc: 5,
    soloMonthly: 450, bothMonthly: 1500,
    spy: 316, msci: 58, gold: 51, cash: 1410, spyMonthly: 50,
    loan1: 5544, loan2: 15924, loanMonthly: 279
  },
  savings: [],   // {date, amount, note}
  housePrices: [], // {date, price, note}
  scenario: 'solo',

  init() {
    this.load();
    this.bindEvents();
    this.setDefaultDates();
    this.render();
  },

  load() {
    try {
      const s = localStorage.getItem('ahc-settings');
      if (s) Object.assign(this.settings, JSON.parse(s));
      const sv = localStorage.getItem('ahc-savings');
      if (sv) this.savings = JSON.parse(sv);
      const hp = localStorage.getItem('ahc-house');
      if (hp) this.housePrices = JSON.parse(hp);
    } catch(e) {}
  },

  save() {
    localStorage.setItem('ahc-settings', JSON.stringify(this.settings));
    localStorage.setItem('ahc-savings', JSON.stringify(this.savings));
    localStorage.setItem('ahc-house', JSON.stringify(this.housePrices));
  },

  setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const ym = today.substring(0, 7);
    document.getElementById('save-date').value = today;
    document.getElementById('house-date').value = today;
  },

  // --- Calculations ---
  get totalSaved() {
    return this.settings.spy + this.settings.msci + this.settings.gold + this.settings.cash;
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

  // Calculator averages
  calcSavingsRate() {
    if (this.savings.length < 2) return null;
    const sorted = [...this.savings].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const days = (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24);
    if (days <= 0) return null;
    const amountDiff = last.amount - first.amount;
    const daily = amountDiff / days;
    const monthly = daily * 30;
    return { daily, monthly, days };
  },

  calcHouseRate() {
    if (this.housePrices.length < 2) return null;
    const sorted = [...this.housePrices].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const days = (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24);
    if (days <= 0) return null;
    const priceDiff = last.price - first.price;
    const daily = priceDiff / days;
    const monthly = daily * 30;
    return { daily, monthly };
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
    const maxMonths = 360;

    while (months < maxMonths) {
      months++;
      saved += sr.monthly;
      if (hr) housePrice += hr.monthly;
      const target = housePrice * entryPct;
      if (saved >= target) return months;
    }
    return null;
  },

  // --- Render ---
  render() {
    this.renderSituacion();
    this.renderCalculadora();
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

    // Breakdown
    document.getElementById('bd-spy').textContent = this.n(this.settings.spy) + ' €';
    document.getElementById('bd-msci').textContent = this.n(this.settings.msci) + ' €';
    document.getElementById('bd-gold').textContent = this.n(this.settings.gold) + ' €';
    document.getElementById('bd-cash').textContent = this.n(this.settings.cash) + ' €';
    document.getElementById('bd-total').textContent = this.n(this.totalSaved) + ' €';
    document.getElementById('bd-loan1').textContent = this.n(this.settings.loan1) + ' €';
    document.getElementById('bd-loan2').textContent = this.n(this.settings.loan2) + ' €';
    document.getElementById('bd-loan-m').textContent = this.n(this.settings.loanMonthly) + ' €/mes';

    // Scenario buttons
    document.querySelectorAll('.scenario-btn').forEach(b => b.classList.toggle('active', b.dataset.scenario === this.scenario));
  },

  renderCalculadora() {
    // Savings rate estimate
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
      document.getElementById('est-countdown').textContent = 'Necesita más datos';
    }

    // Savings list
    const sl = document.getElementById('savings-list');
    if (this.savings.length === 0) {
      sl.innerHTML = '<p class="data-empty">Sin datos. Pulsa "+ Añadir" cada vez que quieras registrar.</p>';
    } else {
      const sorted = [...this.savings].sort((a, b) => b.date.localeCompare(a.date));
      sl.innerHTML = sorted.map((s, i) => `
        <div class="data-item">
          <div>
            <div class="data-date">${this.fmtDate(s.date)}</div>
            ${s.note ? `<div class="data-note">${s.note}</div>` : ''}
          </div>
          <div class="data-right">
            <span class="data-value">${this.n(s.amount)} €</span>
            <button class="data-delete" data-type="saving" data-date="${s.date}">✕</button>
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
            <button class="data-delete" data-type="house" data-date="${h.date}">✕</button>
          </div>
        </div>
      `).join('');
    }

    // Delete buttons
    document.querySelectorAll('.data-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const date = btn.dataset.date;
        if (type === 'saving') this.savings = this.savings.filter(s => s.date !== date);
        else this.housePrices = this.housePrices.filter(h => h.date !== date);
        this.save();
        this.render();
      });
    });
  },

  // --- Events ---
  bindEvents() {
    // Bottom nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
        document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
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
    document.getElementById('btn-reset').addEventListener('click', () => { if (confirm('¿Reset?')) { localStorage.clear(); location.reload(); } });

    // Add saving
    document.getElementById('btn-add-saving').addEventListener('click', () => this.open('modal-saving'));
    document.getElementById('saving-close').addEventListener('click', () => this.close('modal-saving'));
    document.getElementById('btn-do-save').addEventListener('click', () => this.addSaving());

    // Add house
    document.getElementById('btn-add-house').addEventListener('click', () => this.open('modal-house'));
    document.getElementById('house-close').addEventListener('click', () => this.close('modal-house'));
    document.getElementById('btn-do-house').addEventListener('click', () => this.addHouse());

    // Close on backdrop
    ['modal-settings', 'modal-saving', 'modal-house'].forEach(id => {
      document.getElementById(id).addEventListener('click', e => { if (e.target === document.getElementById(id)) this.close(id); });
    });
  },

  openSettings() {
    const s = this.settings;
    ['set-house-price', 'set-entry-pct', 'set-taxes-pct', 'set-house-inc', 'set-solo-m', 'set-both-m',
     'set-spy', 'set-msci', 'set-gold', 'set-cash', 'set-spy-m', 'set-l1', 'set-l2', 'set-lm'].forEach(id => {
      const el = document.getElementById(id);
      const key = {
        'set-house-price': 'housePrice', 'set-entry-pct': 'entryPct', 'set-taxes-pct': 'taxesPct',
        'set-house-inc': 'houseInc', 'set-solo-m': 'soloMonthly', 'set-both-m': 'bothMonthly',
        'set-spy': 'spy', 'set-msci': 'msci', 'set-gold': 'gold', 'set-cash': 'cash',
        'set-spy-m': 'spyMonthly', 'set-l1': 'loan1', 'set-l2': 'loan2', 'set-lm': 'loanMonthly'
      }[id];
      if (key) el.value = s[key];
    });
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
    this.render();
    this.close('modal-settings');
  },

  addSaving() {
    const date = document.getElementById('save-date').value;
    const amount = +document.getElementById('save-amount').value;
    const note = document.getElementById('save-note').value.trim();
    if (!date || !amount) return;

    // Update or add
    const idx = this.savings.findIndex(s => s.date === date);
    if (idx >= 0) this.savings[idx] = { date, amount, note };
    else this.savings.push({ date, amount, note });

    this.settings.cash = amount; // Update current cash
    this.save();
    this.render();
    this.close('modal-saving');
    document.getElementById('save-amount').value = '';
    document.getElementById('save-note').value = '';
  },

  addHouse() {
    const date = document.getElementById('house-date').value;
    const price = +document.getElementById('house-amount').value;
    const note = document.getElementById('house-note').value.trim();
    if (!date || !price) return;

    const idx = this.housePrices.findIndex(h => h.date === date);
    if (idx >= 0) this.housePrices[idx] = { date, price, note };
    else this.housePrices.push({ date, price, note });

    this.settings.housePrice = price;
    this.save();
    this.render();
    this.close('modal-house');
    document.getElementById('house-amount').value = '';
    document.getElementById('house-note').value = '';
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
