// Firebase Sync for Ahorro Casa
const FirebaseSync = {
  app: null, auth: null, db: null, user: null, initialized: false,

  async init() {
    if (this.initialized) return;
    try {
      this.app = firebase.initializeApp({
        apiKey: "AIzaSyDQ93_92eYWzuhlMWiEWzeYOlzgLHyAXZA",
        authDomain: "bookshelf-app-68ab2.firebaseapp.com",
        projectId: "bookshelf-app-68ab2",
        storageBucket: "bookshelf-app-68ab2.firebasestorage.app",
        messagingSenderId: "964918288629",
        appId: "1:964918288629:web:e2ec942990beb426b425bc"
      });
      this.auth = firebase.auth();
      this.db = firebase.firestore();
      this.auth.onAuthStateChanged(u => {
        this.user = u;
        this.updateUI();
        if (u) { this.syncFromCloud(); }
      });
      this.initialized = true;
    } catch (e) { console.error('Firebase init error:', e); }
  },

  async signInGoogle() {
    const r = await this.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    return r.user;
  },

  async signInEmail(email, pass) {
    try {
      return (await this.auth.signInWithEmailAndPassword(email, pass)).user;
    } catch (e) {
      if (e.code === 'auth/user-not-found') return (await this.auth.createUserWithEmailAndPassword(email, pass)).user;
      throw e;
    }
  },

  async signOut() { await this.auth.signOut(); },

  isLoggedIn() { return !!this.user; },

  userDoc() {
    if (!this.user) return null;
    return this.db.collection('users').doc(this.user.uid);
  },

  async saveToCloud() {
    const doc = this.userDoc();
    if (!doc) return;
    try {
      await doc.set({
        houseParams: App.houseParams,
        savings: App.savings,
        housePrices: App.housePrices,
        portfolio: App.portfolio,
        debts: App.debts,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) { console.error('Save error:', e); }
  },

  async syncFromCloud() {
    const doc = this.userDoc();
    if (!doc) return;
    try {
      const snap = await doc.get();
      if (snap.exists) {
        const data = snap.data();
        if (data.houseParams) Object.assign(App.houseParams, data.houseParams);
        if (data.savings && data.savings.length > 0) App.savings = data.savings;
        if (data.housePrices && data.housePrices.length > 0) App.housePrices = data.housePrices;
        if (Array.isArray(data.portfolio) && data.portfolio.length > 0) App.portfolio = data.portfolio;
        if (Array.isArray(data.debts)) App.debts = data.debts;
        App.save();
        App.render();
      } else {
        await this.saveToCloud();
      }
    } catch (e) { console.error('Sync error:', e); }
  },

  updateUI() {
    const loginBtn = document.getElementById('btn-login');
    const logoutBtn = document.getElementById('btn-logout');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');

    if (this.user) {
      if (loginBtn) { loginBtn.classList.add('hidden'); loginBtn.style.display = 'none'; }
      if (logoutBtn) { logoutBtn.classList.remove('hidden'); logoutBtn.style.display = ''; }
      if (userInfo) { userInfo.classList.remove('hidden'); userInfo.style.display = ''; }
      if (userName) userName.textContent = this.user.displayName || this.user.email;
    } else {
      if (loginBtn) { loginBtn.classList.remove('hidden'); loginBtn.style.display = ''; }
      if (logoutBtn) { logoutBtn.classList.add('hidden'); logoutBtn.style.display = 'none'; }
      if (userInfo) { userInfo.classList.add('hidden'); userInfo.style.display = 'none'; }
    }
  }
};
