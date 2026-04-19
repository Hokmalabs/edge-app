const KEYS = {
  BETTING_BANKROLL: 'edge_betting_bankroll',
  BETTING_SESSIONS: 'edge_betting_sessions',
  BETTING_BANKROLL_HISTORY: 'edge_bankroll_history',
  BRVM_PORTFOLIO: 'edge_brvm_portfolio',
  BRVM_SESSIONS: 'edge_brvm_sessions',
  BRVM_CONFIRMED_AMOUNT: 'edge_brvm_confirmed',
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

// --- Montant BRVM réellement confirmé (achats validés par l'utilisateur) ---
export function getBRVMConfirmedAmount() {
  return load(KEYS.BRVM_CONFIRMED_AMOUNT, 0);
}

export function addBRVMConfirmedAmount(amount) {
  save(KEYS.BRVM_CONFIRMED_AMOUNT, getBRVMConfirmedAmount() + amount);
}

// --- Limite analyse par jour ---
const todayStr = () => new Date().toISOString().split('T')[0];

export function getLastAnalysisDate() {
  return load('edge_last_analysis_date', null);
}

export function setLastAnalysisDate() {
  save('edge_last_analysis_date', todayStr());
}

export function canAnalyzeToday() {
  return getLastAnalysisDate() !== todayStr();
}

// --- Gestion statut paris ---
function updateBetField(sessionId, betId, updates) {
  const sessions = getBettingSessions();
  const si = sessions.findIndex((s) => s.id === sessionId);
  if (si === -1) return;
  const bi = sessions[si].bets?.findIndex((b) => b.id === betId) ?? -1;
  if (bi !== -1) sessions[si].bets[bi] = { ...sessions[si].bets[bi], ...updates };
  save(KEYS.BETTING_SESSIONS, sessions);
}

export function markBetAsPlayed(sessionId, betId) {
  updateBetField(sessionId, betId, { status: 'played', played_at: new Date().toISOString() });
}

export function markBetAsNotPlayed(sessionId, betId) {
  updateBetField(sessionId, betId, { status: 'not_played', result: 'skipped' });
}

export function resolveBet(sessionId, betId, won) {
  const sessions = getBettingSessions();
  const bet = sessions.find((s) => s.id === sessionId)?.bets?.find((b) => b.id === betId);
  if (!bet) return 0;
  const pnl = won ? bet.stake_amount * (bet.odds - 1) : -bet.stake_amount;
  updateBetField(sessionId, betId, {
    status: won ? 'won' : 'lost',
    result: won ? 'won' : 'lost',
    resolved_at: new Date().toISOString(),
    result_amount: pnl,
  });
  const br = getBettingBankroll();
  const updated = { ...br, current: Math.max(0, br.current + pnl) };
  saveBettingBankroll(updated);
  appendBankrollPoint(updated.current);
  return pnl;
}

export function markParlayAsPlayed(sessionId) {
  const sessions = getBettingSessions();
  const si = sessions.findIndex((s) => s.id === sessionId);
  if (si === -1) return;
  sessions[si].parlay = { ...sessions[si].parlay, status: 'played', played_at: new Date().toISOString() };
  save(KEYS.BETTING_SESSIONS, sessions);
}

export function markParlayAsNotPlayed(sessionId) {
  const sessions = getBettingSessions();
  const si = sessions.findIndex((s) => s.id === sessionId);
  if (si === -1) return;
  sessions[si].parlay = { ...sessions[si].parlay, status: 'not_played' };
  save(KEYS.BETTING_SESSIONS, sessions);
}

export function resolveParlayBet(sessionId, won) {
  const sessions = getBettingSessions();
  const si = sessions.findIndex((s) => s.id === sessionId);
  const parlay = sessions[si]?.parlay;
  if (!parlay) return 0;
  const pnl = won ? parlay.stake_amount * (parlay.combined_odds - 1) : -parlay.stake_amount;
  sessions[si].parlay = {
    ...parlay,
    status: won ? 'won' : 'lost',
    result: won ? 'won' : 'lost',
    resolved_at: new Date().toISOString(),
    result_amount: pnl,
  };
  save(KEYS.BETTING_SESSIONS, sessions);
  const br = getBettingBankroll();
  const updated = { ...br, current: Math.max(0, br.current + pnl) };
  saveBettingBankroll(updated);
  appendBankrollPoint(updated.current);
  return pnl;
}

export function getPendingBets() {
  return getBettingSessions().flatMap((s) => {
    const singles = (s.bets || [])
      .filter((b) => b.status === 'played')
      .map((b) => ({ ...b, sessionId: s.id, sessionDate: s.createdAt, type: 'single' }));
    const parlays = s.parlay?.active && s.parlay?.status === 'played'
      ? [{ ...s.parlay, id: `${s.id}_parlay`, sessionId: s.id, sessionDate: s.createdAt, type: 'parlay' }]
      : [];
    return [...singles, ...parlays];
  });
}

export function getBetHistory() {
  return getBettingSessions().flatMap((s) => {
    const singles = (s.bets || [])
      .filter((b) => ['won', 'lost'].includes(b.status) || ['won', 'lost'].includes(b.result))
      .map((b) => ({ ...b, status: b.status || b.result, sessionId: s.id, sessionDate: s.createdAt, type: 'single' }));
    const parlays = s.parlay?.active && ['won', 'lost'].includes(s.parlay?.status)
      ? [{ ...s.parlay, id: `${s.id}_parlay`, sessionId: s.id, sessionDate: s.createdAt, type: 'parlay', status: s.parlay.status }]
      : [];
    return [...singles, ...parlays].sort((a, b) => new Date(b.resolved_at || b.sessionDate) - new Date(a.resolved_at || a.sessionDate));
  });
}

export function getNotPlayedBets() {
  return getBettingSessions().flatMap((s) => {
    const singles = (s.bets || [])
      .filter((b) => b.status === 'not_played' || b.result === 'skipped')
      .map((b) => ({ ...b, sessionId: s.id, sessionDate: s.createdAt, type: 'single' }));
    const parlays = s.parlay?.active && s.parlay?.status === 'not_played'
      ? [{ ...s.parlay, id: `${s.id}_parlay`, sessionId: s.id, sessionDate: s.createdAt, type: 'parlay' }]
      : [];
    return [...singles, ...parlays];
  });
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
