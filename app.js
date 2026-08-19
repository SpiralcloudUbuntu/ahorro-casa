// Ahorro Casa — PWA
const App = {
  settings: {
    housePrice: 400000,
    entryPct: 10,
    taxesPct: 10,
    houseIncrease: 5,
    soloMonthly: 450,
    bothMonthly: 1500,
    spy: 316,
    msci: 58,
    gold: 51,
    cash: 1410,
    spyMonthly: 50,
    loan1: 5544,
    loan2: 15924,
    loanMonthly: 279
  },
  history: [],
  currentScenario: 'solo',

  init() {
    this.load();
    this.render();
    this.bindEvents();
  },

  load() {
    try {
      const s = localStorage.getItem('ahorro-settings');
      if (s) Object.assign(this.settings, JSON.parse(s));
      const h = localStorage.getItem('ahorro-history');
      if (h) this.history = JSON.parse(h);
    } catch (e) {}
  },

  save() {
    localStorage.setItem('ahorro-settings', JSON.stringify(this.settings));
    localStorage.setItem('ahorro-history', JSON.stringify(this.history));
  },

  // Calculations
  get totalSaved() {
    return this.settings.spy + this.settings.msci + this.settings.gold + this.settings.cash;
  },

  get targetToday() {
    const entry = this.settings.housePrice * (this.settings.entryPct / 100);
    const taxes = this.settings.housePrice * (this.settings.taxesPct / 100);
    return entry + taxes;
  },

  get monthly() {
    return this.currentScenario === 'solo' ? this.settings.soloMonthly : this.settings.bothMonthly;
  },

  calcMonthsToTarget() {
    const monthly = this.monthly + this.settings.spyMonthly;
    const target = this.targetToday;
    const saved = this.totalSaved;
    const annualIncrease = this.settings.houseIncrease / 100;

    if (saved >= target) return 0;
    if (monthly <= 0) return Infinity;

    let accum = saved;
    let months = 0;
    const maxMonths = 360; // 30 years cap

    while (months < maxMonths) {
      months++;
      accum += monthly;
      // House price increases monthly
      const currentTarget = target * Math.pow(1 + annualIncrease, months / 12);
      if (accum >= currentTarget) return months;
    }
    return maxMonths;
  },

  calcHousePriceAt(months) {
    return this.settings.housePrice * Math.pow(1 + this.settings.houseIncrease / 100, months / 12);
  },

  calcTargetAt(months) {
    const house = this.calcHousePriceAt(months);
    const entry = house * (this.settings.entryPct / 100);
    const taxes = house * (this.settings.taxesPct / 100);
    return entry + taxes;
  },

  calcSavedAt(months) {
    const monthly = this.monthly + this.settings.spyMonthly;
    return this.totalSaved + (monthly * months);
  },

  // Render
  render() {
    const months = this.calcMonthsToTarget();
    const pct = Math.min(100, (this.totalSaved / this.targetToday) * 100);
    const houseThen = months > 0 ? this.calcHousePriceAt(months) : this.settings.housePrice;
    const targetThen = months > 0 ? this.calcTargetAt(months) : this.targetToday;

    // Progress ring
    const ring = document.getElementById('progress-ring');
    const circumference = 2 * Math.PI * 85;
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = circumference - (pct / 100) * circumference;

    // Change ring color based on progress
    if (pct >= 80) ring.style.stroke = '#00b894';
    else if (pct >= 50) ring.style.stroke = '#fdcb6e';
    else ring.style.stroke = '#6c5ce7';

    // Numbers
    document.getElementById('progress-pct').textContent = Math.round(pct) + '%';
    document.getElementById('saved-amount').textContent = this.formatNum(this.totalSaved);
    document.getElementById('target-amount').textContent = this.formatNum(this.targetToday);

    // Countdown
    if (months <= 0) {
      document.getElementById('countdown').textContent = '¡Ya puedes comprar!';
      document.getElementById('countdown-date').textContent = '';
    } else if (months >= 360) {
      document.getElementById('countdown').textContent = 'Más de 30 años';
      document.getElementById('countdown-date').textContent = 'Necesitas ahorrar más';
    } else {
      const years = Math.floor(months / 12);
      const rem = Math.round(months % 12);
      document.getElementById('countdown').textContent = years > 0 ? `${years} años y ${rem} meses` : `${rem} meses`;
      const date = new Date();
      date.setMonth(date.getMonth() + months);
      document.getElementById('countdown-date').textContent = `Fecha estimada: ${date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
    }

    // Stats
    document.getElementById('stat-monthly').textContent = this.formatNum(this.monthly) + ' €';
    document.getElementById('stat-house-now').textContent = this.formatNum(this.settings.housePrice) + ' €';
    document.getElementById('stat-house-then').textContent = this.formatNum(Math.round(houseThen)) + ' €';
    document.getElementById('stat-entry').textContent = this.formatNum(Math.round(targetThen)) + ' €';

    // Breakdown
    document.getElementById('bd-spy').textContent = this.formatNum(this.settings.spy) + ' €';
    document.getElementById('bd-msci').textContent = this.formatNum(this.settings.msci) + ' €';
    document.getElementById('bd-gold').textContent = this.formatNum(this.settings.gold) + ' €';
    document.getElementById('bd-cash').textContent = this.formatNum(this.settings.cash) + ' €';
    document.getElementById('bd-total').textContent = this.formatNum(this.totalSaved) + ' €';

    // Loans
    document.getElementById('bd-loan1').textContent = this.formatNum(this.settings.loan1) + ' €';
    document.getElementById('bd-loan2').textContent = this.formatNum(this.settings.loan2) + ' €';
    document.getElementById('bd-loan-monthly').textContent = this.formatNum(this.settings.loanMonthly) + ' €/mes';

    // Scenario buttons
    document.querySelectorAll('.scenario-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.scenario === this.currentScenario);
    });

    // History
    this.renderHistory();
  },

  renderHistory() {
    const el = document.getElementById('history-list');
    if (this.history.length === 0) {
      el.innerHTML = '<p class="history-empty">Sin datos todavía. Pulsa "+ Añadir" para registrar este mes.</p>';
      return;
    }

    const sorted = [...this.history].sort((a, b) => b.date.localeCompare(a.date));
    el.innerHTML = sorted.map(h => {
      const total = (h.spy || 0) + (h.msci || 0) + (h.gold || 0) + (h.cash || 0);
      const d = new Date(h.date + '-01');
      return `
        <div class="history-item">
          <span class="history-date">${d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
          <span class="history-amount">${this.formatNum(total)} €</span>
        </div>
      `;
    }).join('');
  },

  formatNum(n) {
    return Math.round(n).toLocaleString('es-ES');
  },

  // Events
  bindEvents() {
    // Scenario toggle
    document.querySelectorAll('.scenario-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentScenario = btn.dataset.scenario;
        this.render();
      });
    });

    // Settings
    document.getElementById('btn-settings').addEventListener('click', () => this.openSettings());
    document.getElementById('settings-close').addEventListener('click', () => this.closeModal('modal-settings'));
    document.getElementById('btn-save-settings').addEventListener('click', () => this.saveSettings());
    document.getElementById('btn-reset-settings').addEventListener('click', () => this.resetSettings());

    // Add month
    document.getElementById('btn-add-month').addEventListener('click', () => this.openAddMonth());
    document.getElementById('add-month-close').addEventListener('click', () => this.closeModal('modal-add-month'));
    document.getElementById('btn-save-month').addEventListener('click', () => this.saveMonth());

    // Close modals on background
    ['modal-settings', 'modal-add-month'].forEach(id => {
      document.getElementById(id).addEventListener('click', (e) => {
        if (e.target === document.getElementById(id)) this.closeModal(id);
      });
    });
  },

  openSettings() {
    const s = this.settings;
    document.getElementById('set-house-price').value = s.housePrice;
    document.getElementById('set-entry-pct').value = s.entryPct;
    document.getElementById('set-taxes-pct').value = s.taxesPct;
    document.getElementById('set-house-increase').value = s.houseIncrease;
    document.getElementById('set-solo-monthly').value = s.soloMonthly;
    document.getElementById('set-both-monthly').value = s.bothMonthly;
    document.getElementById('set-spy').value = s.spy;
    document.getElementById('set-msci').value = s.msci;
    document.getElementById('set-gold').value = s.gold;
    document.getElementById('set-cash').value = s.cash;
    document.getElementById('set-spy-monthly').value = s.spyMonthly;
    document.getElementById('set-loan1').value = s.loan1;
    document.getElementById('set-loan2').value = s.loan2;
    document.getElementById('set-loan-monthly').value = s.loanMonthly;
    document.getElementById('modal-settings').classList.remove('hidden');
  },

  saveSettings() {
    this.settings.housePrice = +document.getElementById('set-house-price').value;
    this.settings.entryPct = +document.getElementById('set-entry-pct').value;
    this.settings.taxesPct = +document.getElementById('set-taxes-pct').value;
    this.settings.houseIncrease = +document.getElementById('set-house-increase').value;
    this.settings.soloMonthly = +document.getElementById('set-solo-monthly').value;
    this.settings.bothMonthly = +document.getElementById('set-both-monthly').value;
    this.settings.spy = +document.getElementById('set-spy').value;
    this.settings.msci = +document.getElementById('set-msci').value;
    this.settings.gold = +document.getElementById('set-gold').value;
    this.settings.cash = +document.getElementById('set-cash').value;
    this.settings.spyMonthly = +document.getElementById('set-spy-monthly').value;
    this.settings.loan1 = +document.getElementById('set-loan1').value;
    this.settings.loan2 = +document.getElementById('set-loan2').value;
    this.settings.loanMonthly = +document.getElementById('set-loan-monthly').value;
    this.save();
    this.render();
    this.closeModal('modal-settings');
  },

  resetSettings() {
    if (confirm('¿Restaurar configuración por defecto?')) {
      localStorage.removeItem('ahorro-settings');
      localStorage.removeItem('ahorro-history');
      location.reload();
    }
  },

  openAddMonth() {
    const now = new Date();
    document.getElementById('add-month-date').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('add-month-cash').value = this.settings.cash;
    document.getElementById('add-month-spy').value = this.settings.spy;
    document.getElementById('add-month-msci').value = this.settings.msci;
    document.getElementById('add-month-gold').value = this.settings.gold;
    document.getElementById('modal-add-month').classList.remove('hidden');
  },

  saveMonth() {
    const entry = {
      date: document.getElementById('add-month-date').value,
      cash: +document.getElementById('add-month-cash').value,
      spy: +document.getElementById('add-month-spy').value,
      msci: +document.getElementById('add-month-msci').value,
      gold: +document.getElementById('add-month-gold').value
    };

    // Update or add
    const existing = this.history.findIndex(h => h.date === entry.date);
    if (existing >= 0) {
      this.history[existing] = entry;
    } else {
      this.history.push(entry);
    }

    // Update current values
    this.settings.cash = entry.cash;
    this.settings.spy = entry.spy;
    this.settings.msci = entry.msci;
    this.settings.gold = entry.gold;

    this.save();
    this.render();
    this.closeModal('modal-add-month');
  },

  closeModal(id) {
    document.getElementById(id).classList.add('hidden');
  }
};

// Start
App.init();
