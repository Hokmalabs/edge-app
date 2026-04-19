import { useState, useEffect } from 'react';
import {
  getBettingBankroll, saveBettingBankroll,
  getBettingSessions, saveBettingSession,
  getBankrollHistory, appendBankrollPoint,
  canAnalyzeToday, setLastAnalysisDate,
  markBetAsPlayed, markBetAsNotPlayed,
  markParlayAsPlayed, markParlayAsNotPlayed,
} from '../utils/storage';
import { formatFCFA } from '../utils/kelly';
import BankrollCard from '../components/BankrollCard';

const SPORTS = ['Football', 'Basketball/NBA', 'NFL', 'Tennis'];
const HORIZONS = ["Aujourd'hui", 'Cette semaine'];

const BETTING_STEPS = [
  '🔍 Recherche des matchs du jour...',
  '📊 Analyse des cotes en cours...',
  '🧮 Calcul des probabilités et Kelly...',
  '⚡ Sélection des meilleurs paris...',
  '✅ Finalisation...',
];

function getCountdownToMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = Math.floor((midnight - now) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function BankrollCurve({ history }) {
  if (!history || history.length < 2) return null;
  const values = history.map((h) => h.amount);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 300;
  const H = 80;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  });
  const isUp = values[values.length - 1] >= values[0];
  return (
    <div className="rounded-lg border border-edge-border bg-edge-surface p-4">
      <p className="text-xs text-edge-muted uppercase tracking-widest mb-3">Courbe Bankroll</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isUp ? '#00ff87' : '#ff4d6d'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isUp ? '#00ff87' : '#ff4d6d'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={pts.join(' ')} fill="none" stroke={isUp ? '#00ff87' : '#ff4d6d'} strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-xs text-edge-muted mt-1">
        <span>{formatFCFA(values[0])}</span>
        <span className={isUp ? 'text-edge-accent' : 'text-edge-danger'}>{formatFCFA(values[values.length - 1])}</span>
      </div>
    </div>
  );
}

function ProposedBetCard({ bet, sessionId, onPlay, onSkip }) {
  const evColor = bet.ev > 0.1 ? 'text-edge-accent' : bet.ev > 0.05 ? 'text-edge-warning' : 'text-edge-muted';
  const confidenceBar = Math.round((bet.confidence || 0.5) * 100);

  const statusBadge = {
    played: <span className="text-xs font-bold px-2 py-1 rounded bg-edge-warning/20 text-edge-warning">⏳ JOUÉ</span>,
    not_played: <span className="text-xs font-bold px-2 py-1 rounded bg-edge-border text-edge-muted">⏭ PAS JOUÉ</span>,
  };

  return (
    <div className="rounded-lg border border-edge-border bg-edge-surface p-4 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs px-2 py-0.5 rounded bg-edge-border text-edge-muted mr-2">{bet.sport}</span>
          <span className="text-xs text-edge-muted">{bet.market}</span>
          {bet.match_time && <span className="text-xs text-edge-warning ml-2">{bet.match_time}</span>}
        </div>
        <span className={`text-sm font-bold ${evColor}`}>EV {(bet.ev * 100).toFixed(1)}%</span>
      </div>
      <p className="text-sm text-edge-text font-semibold">{bet.match}</p>
      <div className="flex justify-between items-center">
        <p className="text-edge-accent font-bold">{bet.pick}</p>
        <p className="text-lg font-bold text-edge-text">@{bet.odds}</p>
      </div>
      <div>
        <div className="flex justify-between text-xs text-edge-muted mb-1">
          <span>Confiance</span>
          <span>{confidenceBar}%</span>
        </div>
        <div className="h-1.5 bg-edge-border rounded-full overflow-hidden">
          <div className="h-full bg-edge-accent rounded-full" style={{ width: `${confidenceBar}%` }} />
        </div>
      </div>
      <div className="flex justify-between items-center pt-1">
        <div>
          <p className="text-xs text-edge-muted">Mise Kelly</p>
          <p className="text-edge-accent font-bold">{formatFCFA(bet.stake_amount)} <span className="text-xs text-edge-muted">({bet.stake_pct}%)</span></p>
        </div>
        {bet.status === 'proposed' ? (
          <div className="flex gap-1.5">
            <button onClick={() => onPlay(sessionId, bet.id)} className="text-xs px-3 py-1.5 rounded border border-edge-accent text-edge-accent hover:bg-edge-accent/10 transition-colors font-semibold">JOUÉ</button>
            <button onClick={() => onSkip(sessionId, bet.id)} className="text-xs px-3 py-1.5 rounded border border-edge-border text-edge-muted hover:bg-edge-border/20 transition-colors">PAS JOUÉ</button>
          </div>
        ) : statusBadge[bet.status]}
      </div>
      {bet.reasoning && (
        <p className="text-xs text-edge-muted border-t border-edge-border pt-2 leading-relaxed">{bet.reasoning}</p>
      )}
    </div>
  );
}

export default function BettingAgent() {
  const [bankroll, setBankroll] = useState(getBettingBankroll());
  const [editingBankroll, setEditingBankroll] = useState(false);
  const [newBankrollVal, setNewBankrollVal] = useState('');
  const [selectedSports, setSelectedSports] = useState(['Football']);
  const [horizon, setHorizon] = useState(HORIZONS[0]);
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');
  const [currentSession, setCurrentSession] = useState(null);
  const [sessions, setSessions] = useState(getBettingSessions());
  const [bankrollHistory, setBankrollHistory] = useState(getBankrollHistory());
  const [canAnalyze, setCanAnalyze] = useState(canAnalyzeToday());
  const [countdown, setCountdown] = useState(getCountdownToMidnight());
  const [showForceModal, setShowForceModal] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!loading) { setLoadingStep(0); setElapsedSeconds(0); return; }
    const stepTimer = setInterval(() => setLoadingStep((s) => Math.min(s + 1, BETTING_STEPS.length - 1)), 15000);
    const secTimer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => { clearInterval(stepTimer); clearInterval(secTimer); };
  }, [loading]);

  useEffect(() => {
    if (canAnalyze) return;
    const timer = setInterval(() => {
      setCountdown(getCountdownToMidnight());
      if (canAnalyzeToday()) { setCanAnalyze(true); clearInterval(timer); }
    }, 1000);
    return () => clearInterval(timer);
  }, [canAnalyze]);

  const drawdown = bankroll.initial > 0 ? (bankroll.initial - bankroll.current) / bankroll.initial : 0;
  const isStopLoss = drawdown >= 0.3;
  const isWarning = drawdown >= 0.15 && !isStopLoss;

  const toggleSport = (sport) => {
    setSelectedSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  };

  const handleBankrollEdit = () => {
    const val = parseInt(newBankrollVal.replace(/\D/g, ''), 10);
    if (!isNaN(val) && val > 0) {
      const updated = { ...bankroll, initial: val, current: val };
      saveBettingBankroll(updated);
      setBankroll(updated);
      appendBankrollPoint(val);
      setBankrollHistory(getBankrollHistory());
    }
    setEditingBankroll(false);
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    setCurrentSession(null);

    const userPrompt = `Bankroll: ${bankroll.current} FCFA. Sports: ${selectedSports.join(', ')}. Horizon: ${horizon}.${context ? ` ${context}` : ''} Nous sommes le ${new Date().toLocaleDateString('fr-FR')}. Recherche les vrais matchs du jour avec leurs vraies cotes.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          system: `Tu es EDGE, agent de paris sportifs expert quantitatif.\nDevise: FCFA. Date du jour: ${new Date().toLocaleDateString('fr-FR')}.\n\nPROCÉDURE OBLIGATOIRE :\n1. Utilise web_search pour trouver les matchs RÉELS du jour/semaine\n2. Recherche les cotes 1xbet ou bookmakers africains si possible\n3. Ne propose QUE des matchs confirmés avec date/heure réelle\n4. Kelly fractionné 1/4, mise max 5% bankroll, EV > 5% requis\n\nAprès recherche web, appelle propose_bets avec les résultats.`,
          tools: [
            { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
            {
              name: 'propose_bets',
              description: 'Propose des paris sur matchs réels vérifiés',
              input_schema: {
                type: 'object',
                properties: {
                  analysis: { type: 'string' },
                  bets: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        sport: { type: 'string' },
                        match: { type: 'string' },
                        match_time: { type: 'string' },
                        market: { type: 'string' },
                        pick: { type: 'string' },
                        odds: { type: 'number' },
                        our_prob: { type: 'number' },
                        ev: { type: 'number' },
                        confidence: { type: 'number' },
                        stake_pct: { type: 'number' },
                        stake_amount: { type: 'number' },
                        reasoning: { type: 'string' },
                      },
                      required: ['sport', 'match', 'match_time', 'market', 'pick', 'odds', 'our_prob', 'ev', 'confidence', 'stake_pct', 'stake_amount', 'reasoning'],
                    },
                  },
                  parlay: {
                    type: 'object',
                    properties: {
                      active: { type: 'boolean' },
                      combined_odds: { type: 'number' },
                      stake_amount: { type: 'number' },
                      potential_return: { type: 'number' },
                      reasoning: { type: 'string' },
                    },
                    required: ['active', 'combined_odds', 'stake_amount', 'potential_return', 'reasoning'],
                  },
                  weekly_target: { type: 'string' },
                  risk_level: { type: 'string' },
                  warning: { type: 'string' },
                },
                required: ['analysis', 'bets', 'parlay', 'weekly_target', 'risk_level'],
              },
            },
          ],
          tool_choice: { type: 'auto' },
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Erreur API');

      const toolUse = data.content.find((b) => b.type === 'tool_use' && b.name === 'propose_bets');
      if (!toolUse) throw new Error('Pas de résultat structuré');
      const parsed = toolUse.input;

      const session = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        sports: selectedSports,
        horizon,
        bankrollAtTime: bankroll.current,
        analysis: parsed.analysis,
        bets: (parsed.bets || []).map((b, i) => ({ ...b, id: `${Date.now()}_${i}`, status: 'proposed' })),
        parlay: parsed.parlay ? { ...parsed.parlay, status: 'proposed' } : null,
        weekly_target: parsed.weekly_target,
        risk_level: parsed.risk_level,
        warning: parsed.warning,
      };

      setCurrentSession(session);
      saveBettingSession(session);
      setSessions(getBettingSessions());
      setLastAnalysisDate();
      setCanAnalyze(false);
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        setError('Délai dépassé (3 min) - Réessaie avec moins de sports');
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = () => {
    if (isStopLoss) return;
    if (!canAnalyze) { setShowForceModal(true); return; }
    runAnalysis();
  };

  const handlePlay = (sessionId, betId) => {
    markBetAsPlayed(sessionId, betId);
    const updated = getBettingSessions();
    setSessions(updated);
    if (currentSession?.id === sessionId) setCurrentSession(updated.find((s) => s.id === sessionId) || null);
  };

  const handleSkip = (sessionId, betId) => {
    markBetAsNotPlayed(sessionId, betId);
    const updated = getBettingSessions();
    setSessions(updated);
    if (currentSession?.id === sessionId) setCurrentSession(updated.find((s) => s.id === sessionId) || null);
  };

  const handleParlayPlay = (sessionId) => {
    markParlayAsPlayed(sessionId);
    const updated = getBettingSessions();
    setSessions(updated);
    if (currentSession?.id === sessionId) setCurrentSession(updated.find((s) => s.id === sessionId) || null);
  };

  const handleParlaySkip = (sessionId) => {
    markParlayAsNotPlayed(sessionId);
    const updated = getBettingSessions();
    setSessions(updated);
    if (currentSession?.id === sessionId) setCurrentSession(updated.find((s) => s.id === sessionId) || null);
  };

  return (
    <div className="min-h-screen bg-edge-bg text-edge-text font-mono pb-24">
      {/* Force override modal */}
      {showForceModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-edge-surface border border-edge-warning/50 rounded-xl p-6 max-w-xs w-full space-y-4">
            <p className="text-edge-warning font-bold text-sm uppercase tracking-wider">⚠ Analyse supplémentaire</p>
            <p className="text-xs text-edge-muted leading-relaxed">Tu as déjà analysé aujourd'hui. La discipline est ta première protection. Forcer une seconde analyse risque de diluer la qualité de tes paris.</p>
            <p className="text-xs text-edge-muted">Confirmer quand même ?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowForceModal(false); runAnalysis(); }}
                className="flex-1 text-xs py-2.5 rounded border border-edge-warning text-edge-warning hover:bg-edge-warning/10 transition-colors font-bold"
              >
                FORCER
              </button>
              <button
                onClick={() => setShowForceModal(false)}
                className="flex-1 text-xs py-2.5 rounded border border-edge-border text-edge-muted hover:bg-edge-border/20 transition-colors"
              >
                ANNULER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-12 pb-4 border-b border-edge-border">
        <h1 className="text-lg font-bold text-edge-accent">EDGE / PARIS</h1>
        <p className="text-xs text-edge-muted">Agent de paris sportifs quantitatif</p>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Stop-loss alert */}
        {isStopLoss && (
          <div className="rounded-lg border border-edge-danger bg-edge-danger/10 p-4">
            <p className="text-sm font-bold text-edge-danger">🛑 STOP-LOSS ACTIVÉ</p>
            <p className="text-xs text-edge-muted mt-1">Drawdown {Math.round(drawdown * 100)}% — règle 30% atteinte. Aucune analyse autorisée. Fais une pause et réévalue ta stratégie.</p>
          </div>
        )}

        {isWarning && (
          <div className="rounded-lg border border-edge-warning/50 bg-edge-warning/5 p-4">
            <p className="text-sm font-bold text-edge-warning">⚠ ALERTE DRAWDOWN</p>
            <p className="text-xs text-edge-muted mt-1">Drawdown {Math.round(drawdown * 100)}% — seuil 15% atteint. Réduis tes mises et sois sélectif.</p>
          </div>
        )}

        {/* Bankroll */}
        <div>
          {editingBankroll ? (
            <div className="flex gap-2">
              <input
                type="number"
                value={newBankrollVal}
                onChange={(e) => setNewBankrollVal(e.target.value)}
                placeholder="Montant FCFA"
                className="flex-1 bg-edge-surface border border-edge-accent rounded px-3 py-2 text-sm text-edge-text focus:outline-none"
                autoFocus
              />
              <button onClick={handleBankrollEdit} className="px-4 py-2 bg-edge-accent text-edge-bg rounded text-sm font-bold">OK</button>
              <button onClick={() => setEditingBankroll(false)} className="px-3 py-2 border border-edge-border rounded text-sm text-edge-muted">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-3" onClick={() => { setNewBankrollVal(String(bankroll.current)); setEditingBankroll(true); }}>
              <BankrollCard label="Bankroll" current={bankroll.current} initial={bankroll.initial} accent />
              <span className="text-xs text-edge-muted">✎ modifier</span>
            </div>
          )}
        </div>

        <BankrollCurve history={bankrollHistory} />

        {/* Règles EDGE */}
        <div className="rounded-lg border border-edge-border bg-edge-surface overflow-hidden">
          <button
            onClick={() => setShowRules((v) => !v)}
            className="w-full flex justify-between items-center px-4 py-3 text-xs text-edge-muted"
          >
            <span className="uppercase tracking-widest text-edge-accent/80">Règles EDGE</span>
            <span>{showRules ? '▲' : '▼'}</span>
          </button>
          {showRules && (
            <div className="px-4 pb-4 space-y-1.5 text-xs text-edge-muted border-t border-edge-border pt-3">
              <p>• 1 analyse par jour maximum</p>
              <p>• Kelly 1/4, mise max 5% bankroll</p>
              <p>• EV minimum requis : &gt;5%</p>
              <p>• Stop-loss à -30% de drawdown</p>
              <p>• Alerte discipline à -15%</p>
              <p>• Marque JOUÉ avant le match, résultat dans Mes Paris</p>
            </div>
          )}
        </div>

        {/* Limite quotidienne */}
        {!canAnalyze && !isStopLoss && (
          <div className="rounded-lg border border-edge-border bg-edge-surface p-4 text-center">
            <p className="text-xs text-edge-muted uppercase tracking-widest mb-1">Prochaine analyse dans</p>
            <p className="text-2xl font-bold text-edge-accent tabular-nums">{countdown}</p>
            <p className="text-xs text-edge-muted mt-1">Analyse du jour effectuée</p>
          </div>
        )}

        {/* Clarification simples vs combiné */}
        <div className="rounded-lg border border-edge-border/50 bg-edge-surface/50 p-3">
          <p className="text-xs text-edge-muted leading-relaxed">
            <span className="text-edge-text font-semibold">Simples vs Combiné :</span> Les paris simples maximisent la constance. Le combiné (si proposé) est optionnel — mise plus petite, gain plus fort, risque plus élevé. Marque-les JOUÉ indépendamment.
          </p>
        </div>

        {/* Sélection sports */}
        <div>
          <p className="text-xs text-edge-muted uppercase tracking-widest mb-2">Sports</p>
          <div className="flex flex-wrap gap-2">
            {SPORTS.map((sport) => (
              <button
                key={sport}
                onClick={() => toggleSport(sport)}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  selectedSports.includes(sport)
                    ? 'border-edge-accent text-edge-accent bg-edge-accent/10'
                    : 'border-edge-border text-edge-muted'
                }`}
              >
                {sport}
              </button>
            ))}
          </div>
        </div>

        {/* Horizon */}
        <div>
          <p className="text-xs text-edge-muted uppercase tracking-widest mb-2">Horizon</p>
          <div className="flex gap-2">
            {HORIZONS.map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  horizon === h ? 'border-edge-accent text-edge-accent bg-edge-accent/10' : 'border-edge-border text-edge-muted'
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* Contexte */}
        <div>
          <p className="text-xs text-edge-muted uppercase tracking-widest mb-2">Contexte (optionnel)</p>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Ex: Eviter les équipes en déplacement en Premier League..."
            className="w-full bg-edge-surface border border-edge-border rounded px-3 py-2 text-sm text-edge-text placeholder-edge-muted focus:outline-none focus:border-edge-accent/50 resize-none h-20"
          />
        </div>

        {/* Bouton analyse */}
        <button
          onClick={handleAnalyze}
          disabled={loading || selectedSports.length === 0 || isStopLoss}
          className="w-full py-3.5 rounded-lg font-bold text-sm tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-edge-accent text-edge-bg hover:bg-edge-accent-dim active:scale-95"
        >
          {loading ? (
            <span className="flex flex-col items-center gap-1">
              <span className="flex items-center gap-2">
                <span className="animate-spin">⟳</span>
                {BETTING_STEPS[loadingStep]}
              </span>
              <span className="text-xs font-normal opacity-70">{elapsedSeconds}s écoulées...</span>
            </span>
          ) : canAnalyze ? '▶ LANCER L\'ANALYSE' : '↺ NOUVELLE ANALYSE (déjà fait aujourd\'hui)'}
        </button>

        {/* Erreur */}
        {error && (
          <div className="rounded-lg border border-edge-danger/40 bg-edge-danger/10 p-4">
            <p className="text-xs text-edge-danger">{error}</p>
          </div>
        )}

        {/* Résultats session courante */}
        {currentSession && (
          <div className="space-y-4">
            {currentSession.analysis && (
              <div className="rounded-lg border border-edge-border bg-edge-surface p-4">
                <p className="text-xs text-edge-muted uppercase tracking-widest mb-2">Analyse</p>
                <p className="text-xs text-edge-text leading-relaxed">{currentSession.analysis}</p>
                {currentSession.warning && (
                  <p className="text-xs text-edge-warning mt-2">⚠ {currentSession.warning}</p>
                )}
                <div className="flex gap-4 mt-3 text-xs text-edge-muted">
                  <span>Risque: <span className="text-edge-text">{currentSession.risk_level}</span></span>
                  <span>Objectif: <span className="text-edge-accent">{currentSession.weekly_target}</span></span>
                </div>
              </div>
            )}

            <p className="text-xs text-edge-muted uppercase tracking-widest">
              Paris proposés — marque JOUÉ avant le match
            </p>
            {currentSession.bets?.map((bet) => (
              <ProposedBetCard
                key={bet.id}
                bet={bet}
                sessionId={currentSession.id}
                onPlay={handlePlay}
                onSkip={handleSkip}
              />
            ))}

            {currentSession.parlay?.active && (
              <div className="rounded-lg border border-edge-warning/30 bg-edge-warning/5 p-4">
                <p className="text-xs text-edge-warning uppercase tracking-widest mb-2">Combiné optionnel</p>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-edge-muted">Cote combinée</span>
                  <span className="text-edge-text font-bold">@{currentSession.parlay.combined_odds}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-edge-muted">Mise · Gain potentiel</span>
                  <span className="text-edge-accent">{formatFCFA(currentSession.parlay.stake_amount)} · {formatFCFA(currentSession.parlay.potential_return)}</span>
                </div>
                {currentSession.parlay.reasoning && (
                  <p className="text-xs text-edge-muted mb-3 leading-relaxed">{currentSession.parlay.reasoning}</p>
                )}
                {currentSession.parlay.status === 'proposed' ? (
                  <div className="flex gap-2">
                    <button onClick={() => handleParlayPlay(currentSession.id)} className="flex-1 text-xs py-2 rounded border border-edge-accent text-edge-accent hover:bg-edge-accent/10 transition-colors font-semibold">JOUÉ</button>
                    <button onClick={() => handleParlaySkip(currentSession.id)} className="text-xs px-4 py-2 rounded border border-edge-border text-edge-muted hover:bg-edge-border/20 transition-colors">PAS JOUÉ</button>
                  </div>
                ) : (
                  <span className="text-xs font-bold px-2 py-1 rounded bg-edge-warning/20 text-edge-warning">
                    {currentSession.parlay.status === 'played' ? '⏳ JOUÉ' : '⏭ PAS JOUÉ'}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Historique sessions */}
        {sessions.length > 0 && (
          <div>
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="w-full flex justify-between items-center py-3 text-xs text-edge-muted border-t border-edge-border"
            >
              <span className="uppercase tracking-widest">Historique ({sessions.length} sessions)</span>
              <span>{showHistory ? '▲' : '▼'}</span>
            </button>
            {showHistory && (
              <div className="space-y-3 mt-2">
                {sessions.map((s) => {
                  const played = (s.bets || []).filter((b) => b.status === 'played' || b.status === 'won' || b.status === 'lost').length;
                  const won = (s.bets || []).filter((b) => b.status === 'won').length;
                  const lost = (s.bets || []).filter((b) => b.status === 'lost').length;
                  return (
                    <div key={s.id} className="rounded-lg border border-edge-border bg-edge-surface p-3">
                      <div className="flex justify-between text-xs text-edge-muted mb-2">
                        <span>{new Date(s.createdAt).toLocaleDateString('fr-FR')}</span>
                        <span>{s.sports?.join(', ')}</span>
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span className="text-edge-text">{s.bets?.length || 0} proposés</span>
                        <span className="text-edge-warning">{played} joués</span>
                        <span className="text-edge-accent">{won} gagnés</span>
                        <span className="text-edge-danger">{lost} perdus</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
