const KEYS = {
  BETTING_BANKROLL: 'edge_betting_bankroll',
  BETTING_SESSIONS: 'edge_betting_sessions',
  BETTING_BANKROLL_HISTORY: 'edge_bankroll_history',
  BRVM_PORTFOLIO: 'edge_brvm_portfolio',
  BRVM_SESSIONS: 'edge_brvm_sessions',
  SETTINGS: 'edge_settings',
};

function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage error:', e);
  }
}

// --- Bankroll paris ---
export function getBettingBankroll() {
  return load(KEYS.BETTING_BANKROLL, { initial: 50000, current: 50000, updatedAt: new Date().toISOString() });
}

export function saveBettingBankroll(data) {
  save(KEYS.BETTING_BANKROLL, { ...data, updatedAt: new Date().toISOString() });
}

// --- Historique bankroll (courbe) ---
export function getBankrollHistory() {
  return load(KEYS.BETTING_BANKROLL_HISTORY, []);
}

export function appendBankrollPoint(amount) {
  const history = getBankrollHistory();
  history.push({ date: new Date().toISOString(), amount });
  if (history.length > 100) history.splice(0, history.length - 100);
  save(KEYS.BETTING_BANKROLL_HISTORY, history);
}

// --- Sessions paris ---
export function getBettingSessions() {
  return load(KEYS.BETTING_SESSIONS, []);
}

export function saveBettingSession(session) {
  const sessions = getBettingSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }
  if (sessions.length > 50) sessions.splice(50);
  save(KEYS.BETTING_SESSIONS, sessions);
}

// --- Portefeuille BRVM ---
export function getBRVMPortfolio() {
  return load(KEYS.BRVM_PORTFOLIO, null);
}

export function saveBRVMPortfolio(portfolio) {
  save(KEYS.BRVM_PORTFOLIO, { ...portfolio, savedAt: new Date().toISOString() });
}

// --- Sessions BRVM ---
export function getBRVMSessions() {
  return load(KEYS.BRVM_SESSIONS, []);
}

export function saveBRVMSession(session) {
  const sessions = getBRVMSessions();
  sessions.unshift(session);
  if (sessions.length > 20) sessions.splice(20);
  save(KEYS.BRVM_SESSIONS, sessions);
}
