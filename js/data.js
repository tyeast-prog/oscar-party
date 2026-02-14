/* ===== Oscar Party — Data Layer =====
 *
 * localStorage is the fast read cache (synchronous).
 * Firestore is the shared cloud source of truth (async).
 * Writes go to both. Real-time Firestore listeners keep
 * localStorage in sync across all devices.
 * Falls back to localStorage-only if Firebase isn't configured.
 */

const OscarData = (() => {
  // --- Storage Keys ---
  const KEYS = {
    categories: 'oscar_categories',
    guests: 'oscar_guests',
    winners: 'oscar_winners',
    showDate: 'oscar_show_date',
  };

  // --- Default Categories ---
  const DEFAULT_CATEGORIES = [
    'Best Picture',
    'Best Director',
    'Best Actor',
    'Best Actress',
    'Best Supporting Actor',
    'Best Supporting Actress',
    'Best Original Screenplay',
    'Best Adapted Screenplay',
    'Best Animated Feature',
    'Best International Feature',
    'Best Documentary Feature',
    'Best Original Score',
    'Best Original Song',
    'Best Cinematography',
    'Best Film Editing',
    'Best Production Design',
    'Best Costume Design',
    'Best Makeup and Hairstyling',
    'Best Sound',
    'Best Visual Effects',
  ];

  // --- Local Storage Helpers ---
  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // --- BroadcastChannel + fallback ---
  let channel = null;
  try {
    channel = new BroadcastChannel('oscar-party');
  } catch { /* BroadcastChannel not supported */ }

  function broadcast(type, payload) {
    const msg = { type, payload, ts: Date.now() };
    if (channel) {
      channel.postMessage(msg);
    }
    window.dispatchEvent(new CustomEvent('oscar-sync', { detail: msg }));
  }

  function onSync(callback) {
    if (channel) {
      channel.onmessage = (e) => callback(e.data);
    }
    window.addEventListener('storage', (e) => {
      if (Object.values(KEYS).includes(e.key)) {
        callback({ type: 'storage-change', payload: { key: e.key } });
      }
    });
    // Same-tab events fired by Firestore real-time listeners
    window.addEventListener('oscar-sync', (e) => callback(e.detail));
  }

  // ============================
  // Firestore Sync Layer
  // ============================
  let db = null;

  function initFirestore() {
    if (typeof firebase === 'undefined' || typeof FIREBASE_CONFIG === 'undefined') return;
    if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.startsWith('YOUR_')) return;
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      db = firebase.firestore();
      db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
      setupFirestoreListeners();
    } catch (e) {
      console.warn('Firebase init failed, using localStorage only:', e.message);
    }
  }

  function setupFirestoreListeners() {
    if (!db) return;

    // --- Config document (categories, winners, showDate) ---
    db.collection('config').doc('main').onSnapshot(doc => {
      if (!doc.exists) return;
      const data = doc.data();
      if (data.categories !== undefined) {
        write(KEYS.categories, data.categories);
        broadcast('categories-updated', {});
      }
      if (data.winners !== undefined) {
        write(KEYS.winners, data.winners);
        broadcast('winners-updated', {});
      }
      if (data.showDate !== undefined) {
        write(KEYS.showDate, data.showDate);
      }
    });

    // --- Guests collection ---
    db.collection('guests').onSnapshot(snapshot => {
      const guests = [];
      snapshot.forEach(doc => {
        guests.push({ id: doc.id, ...doc.data() });
      });
      write(KEYS.guests, guests);
      broadcast('guest-updated', {});
    });
  }

  // Firestore write helpers (fire-and-forget, errors logged)
  function fsyncConfig(field, value) {
    if (!db) return;
    db.collection('config').doc('main').set(
      { [field]: value },
      { merge: true }
    ).catch(e => console.warn('Firestore config sync error:', e.message));
  }

  function fsyncGuest(guest) {
    if (!db || !guest.id) return;
    const { id, ...data } = guest;
    db.collection('guests').doc(id).set(data)
      .catch(e => console.warn('Firestore guest sync error:', e.message));
  }

  function fsyncDeleteGuest(id) {
    if (!db) return;
    db.collection('guests').doc(id).delete()
      .catch(e => console.warn('Firestore guest delete error:', e.message));
  }

  // ============================
  // Categories CRUD
  // ============================
  function getCategories() {
    return read(KEYS.categories) || [];
  }

  function saveCategories(categories) {
    write(KEYS.categories, categories);
    broadcast('categories-updated', {});
    fsyncConfig('categories', categories);
  }

  function getDefaultCategories() {
    return DEFAULT_CATEGORIES.map(name => ({ name, nominees: [] }));
  }

  function categoriesConfigured() {
    const cats = getCategories();
    return cats.length > 0 && cats.some(c => c.nominees && c.nominees.length > 0);
  }

  // ============================
  // Guests CRUD
  // ============================
  function getGuests() {
    return read(KEYS.guests) || [];
  }

  function saveGuest(guest) {
    const guests = getGuests();
    const idx = guests.findIndex(g => g.id === guest.id);
    if (idx >= 0) {
      guests[idx] = guest;
    } else {
      guest.id = guest.id || uid();
      guests.push(guest);
    }
    write(KEYS.guests, guests);
    broadcast('guest-updated', { id: guest.id });
    fsyncGuest(guest);
    return guest;
  }

  function findGuestByName(name) {
    return getGuests().find(
      g => g.name.toLowerCase().trim() === name.toLowerCase().trim()
    ) || null;
  }

  function deleteGuest(id) {
    const guests = getGuests().filter(g => g.id !== id);
    write(KEYS.guests, guests);
    broadcast('guest-updated', { id });
    fsyncDeleteGuest(id);
  }

  function getGuestsByPartyId(partyId) {
    return getGuests().filter(g => g.partyId === partyId);
  }

  function deleteGuestsByPartyId(partyId) {
    const toDelete = getGuests().filter(g => g.partyId === partyId || g.id === partyId);
    const remaining = getGuests().filter(g => g.partyId !== partyId && g.id !== partyId);
    write(KEYS.guests, remaining);
    broadcast('guest-updated', { partyId });
    toDelete.forEach(g => fsyncDeleteGuest(g.id));
  }

  // ============================
  // Winners CRUD
  // ============================
  function getWinners() {
    return read(KEYS.winners) || {};
  }

  function setWinner(category, nominee) {
    const winners = getWinners();
    winners[category] = nominee;
    write(KEYS.winners, winners);
    broadcast('winners-updated', { category, nominee });
    fsyncConfig('winners', winners);
  }

  function clearWinner(category) {
    const winners = getWinners();
    delete winners[category];
    write(KEYS.winners, winners);
    broadcast('winners-updated', { category, nominee: null });
    fsyncConfig('winners', winners);
  }

  // ============================
  // Show Date
  // ============================
  function getShowDate() {
    return read(KEYS.showDate) || '';
  }

  function setShowDate(dateStr) {
    write(KEYS.showDate, dateStr);
    fsyncConfig('showDate', dateStr);
  }

  function daysUntilShow() {
    const d = getShowDate();
    if (!d) return null;
    const diff = new Date(d) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  // ============================
  // Scoring
  // ============================
  function scoreGuest(guest) {
    const winners = getWinners();
    if (!guest.predictions) return 0;
    let score = 0;
    for (const [cat, pick] of Object.entries(guest.predictions)) {
      if (winners[cat] && winners[cat] === pick) score++;
    }
    return score;
  }

  function getLeaderboard() {
    const guests = getGuests().filter(g => g.ballotSubmitted);
    return guests
      .map(g => ({ ...g, score: scoreGuest(g) }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }

  // ============================
  // Export
  // ============================
  function exportCSV() {
    const guests = getGuests();
    const categories = getCategories();
    const catNames = categories.map(c => c.name);

    const header = ['Name', 'RSVP', 'Party ID', 'Party Host', 'Dietary',
                    'Ballot Submitted', 'Submitted At', 'Score', ...catNames];
    const rows = guests.map(g => {
      const score = scoreGuest(g);
      const preds = catNames.map(c => (g.predictions && g.predictions[c]) || '');
      return [
        g.name,
        g.rsvp || '',
        g.partyId || '',
        g.isPartyHost ? 'Yes' : '',
        g.dietary || '',
        g.ballotSubmitted ? 'Yes' : 'No',
        g.submittedAt || '',
        score,
        ...preds,
      ];
    });

    const escape = v => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [header.map(escape).join(','),
                   ...rows.map(r => r.map(escape).join(','))];
    return lines.join('\n');
  }

  function downloadCSV() {
    const csv = exportCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oscar-party-data.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================
  // Initialize Firestore on load
  // ============================
  initFirestore();

  // ============================
  // Public API
  // ============================
  return {
    KEYS,
    DEFAULT_CATEGORIES,
    getCategories,
    saveCategories,
    getDefaultCategories,
    categoriesConfigured,
    getGuests,
    saveGuest,
    findGuestByName,
    deleteGuest,
    getGuestsByPartyId,
    deleteGuestsByPartyId,
    getWinners,
    setWinner,
    clearWinner,
    getShowDate,
    setShowDate,
    daysUntilShow,
    scoreGuest,
    getLeaderboard,
    exportCSV,
    downloadCSV,
    broadcast,
    onSync,
  };
})();
