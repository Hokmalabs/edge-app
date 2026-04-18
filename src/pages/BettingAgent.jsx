import { useState } from 'react';
import {
  getBettingBankroll, saveBettingBankroll,
  getBettingSessions, saveBettingSession,
  getBankrollHistory, appendBankrollPoint,
} from '../utils/storage';
import { formatFCFA } from '../utils/kelly';
import BankrollCard from '../components/BankrollCard';

const SPORTS = ['Football', 'Basketball/NBA', 'NFL', 'Tennis'];
const HORIZONS = ["Aujourd'hui", 'Cette semaine'];


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
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={isUp ? '#00ff87' : '#ff4d6d'}
          strokeWidth="2"
        />
      </svg>
      <div className="flex justify-between text-xs text-edge-muted mt-1">
        <span>{formatFCFA(values[0])}</span>
        <span className={isUp ? 'text-edge-accent' : 'text-edge-danger'}>{formatFCFA(values[values.length - 1])}</span>
      </div>
    </div>
  );
}

function BetCard({ bet, onResult }) {
  const evColor = bet.ev > 0.1 ? 'text-edge-accent' : bet.ev > 0.05 ? 'text-edge-warning' : 'text-edge-muted';
  const confidenceBar = Math.round((bet.confidence || 0.5) * 100);
  return (
    <div className="rounded-lg border border-edge-border bg-edge-surface p-4 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs px-2 py-0.5 rounded bg-edge-border text-edge-muted mr-2">{bet.sport}</span>
          <span className="text-xs text-edge-muted">{bet.market}</span>
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
        {bet.result ? (
          <span className={`text-sm font-bold px-3 py-1 rounded ${bet.result === 'won' ? 'bg-edge-accent/20 text-edge-accent' : 'bg-edge-danger/20 text-edge-danger'}`}>
            {bet.result === 'won' ? '✓ GAGNÉ' : '✗ PERDU'}
          </span>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => onResult(bet.id, 'won')} className="text-xs px-3 py-1.5 rounded border border-edge-accent text-edge-accent hover:bg-edge-accent/10 transition-colors">GAGNÉ</button>
            <button onClick={() => onResult(bet.id, 'lost')} className="text-xs px-3 py-1.5 rounded border border-edge-danger text-edge-danger hover:bg-edge-danger/10 transition-colors">PERDU</button>
          </div>
        )}
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
  const [error, setError] = useState('');
  const [currentSession, setCurrentSession] = useState(null);
  const [sessions, setSessions] = useState(getBettingSessions());
  const [bankrollHistory, setBankrollHistory] = useState(getBankrollHistory());
  const [showHistory, setShowHistory] = useState(false);

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

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    setCurrentSession(null);

    const userPrompt = `Bankroll: ${bankroll.current} FCFA. Sports: ${selectedSports.join(', ')}. Horizon: ${horizon}.${context ? ` ${context}` : ''} Nous sommes le ${new Date().toLocaleDateString('fr-FR')}. Utilise ta connaissance des championnats en cours pour proposer des matchs probables avec des cotes réalistes.`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: "Tu es EDGE, agent de paris sportifs. Devise: FCFA. Ne parie que si EV > 5%. Kelly 1/4. Mise max 5% bankroll. Réponds UNIQUEMENT via l'outil propose_bets.",
          tools: [
            {
              name: 'propose_bets',
              description: 'Propose des paris sportifs avec Kelly',
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
                        market: { type: 'string' },
                        pick: { type: 'string' },
                        odds: { type: 'number' },
                        our_prob: { type: 'number' },
                        ev: { type: 'number' },
                        confidence: { type: 'number' },
                        stake_pct: { type: 'number' },
                        stake_amount: { type: 'number' },
                        reasoning: { type: 'string' },
                        match_time: { type: 'string' },
                      },
                      required: ['sport', 'match', 'market', 'pick', 'odds', 'our_prob', 'ev', 'confidence', 'stake_pct', 'stake_amount', 'reasoning', 'match_time'],
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
          tool_choice: { type: 'tool', name: 'propose_bets' },
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      const data = await res.json();
      clearTimeout(timeoutId);
      console.log('STATUS:', res.status);
      console.log('RAW DATA:', JSON.stringify(data, null, 2));

      const toolUse = data.content.find((b) => b.type === 'tool_use');
      if (!toolUse) throw new Error('Pas de réponse structurée');
      const parsed = toolUse.input;

      const session = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        sports: selectedSports,
        horizon,
        bankrollAtTime: bankroll.current,
        analysis: parsed.analysis,
        bets: (parsed.bets || []).map((b) => ({ ...b, result: null })),
        parlay: parsed.parlay,
        weekly_target: parsed.weekly_target,
        risk_level: parsed.risk_level,
        warning: parsed.warning,
      };

      setCurrentSession(session);
      saveBettingSession(session);
      setSessions(getBettingSessions());
    } catch (e) {
      clearTimeout(timeoutId);
      console.error('ERREUR COMPLETE:', e.message);
      if (e.name === 'AbortError') {
        setError("Délai dépassé - Réessaie sans web search ou avec moins de sports sélectionnés");
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResult = (betId, result) => {
    if (!currentSession) return;
    const updatedBets = currentSession.bets.map((b) =>
      b.id === betId ? { ...b, result } : b
    );
    const updatedSession = { ...currentSession, bets: updatedBets };
    setCurrentSession(updatedSession);
    saveBettingSession(updatedSession);
    setSessions(getBettingSessions());

    const bet = updatedBets.find((b) => b.id === betId);
    if (bet) {
      const pnl = result === 'won'
        ? bet.stake_amount * (bet.odds - 1)
        : -bet.stake_amount;
      const newCurrent = bankroll.current + pnl;
      const updated = { ...bankroll, current: Math.max(0, newCurrent) };
      saveBettingBankroll(updated);
      setBankroll(updated);
      appendBankrollPoint(updated.current);
      setBankrollHistory(getBankrollHistory());
    }
  };

  return (
    <div className="min-h-screen bg-edge-bg text-edge-text font-mono pb-24">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 border-b border-edge-border">
        <h1 className="text-lg font-bold text-edge-accent">EDGE / PARIS</h1>
        <p className="text-xs text-edge-muted">Agent de paris sportifs quantitatif</p>
      </div>

      <div className="px-4 py-5 space-y-5">
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
          disabled={loading || selectedSports.length === 0}
          className="w-full py-3.5 rounded-lg font-bold text-sm tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-edge-accent text-edge-bg hover:bg-edge-accent-dim active:scale-95"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⟳</span> ANALYSE EN COURS...
            </span>
          ) : '▶ LANCER L\'ANALYSE'}
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
            {/* Analyse */}
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

            {/* Paris */}
            <p className="text-xs text-edge-muted uppercase tracking-widest">Paris Recommandés ({currentSession.bets?.length || 0})</p>
            {currentSession.bets?.map((bet) => (
              <BetCard key={bet.id} bet={bet} onResult={handleResult} />
            ))}

            {/* Combiné */}
            {currentSession.parlay?.active && (
              <div className="rounded-lg border border-edge-warning/30 bg-edge-warning/5 p-4">
                <p className="text-xs text-edge-warning uppercase tracking-widest mb-2">Combiné Recommandé</p>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-edge-muted">Cote combinée</span>
                  <span className="text-edge-text font-bold">@{currentSession.parlay.combined_odds}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-edge-muted">Mise</span>
                  <span className="text-edge-accent font-bold">{formatFCFA(currentSession.parlay.stake_amount)}</span>
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-edge-muted">Gain potentiel</span>
                  <span className="text-edge-accent font-bold">{formatFCFA(currentSession.parlay.potential_return)}</span>
                </div>
                {currentSession.parlay.reasoning && (
                  <p className="text-xs text-edge-muted leading-relaxed">{currentSession.parlay.reasoning}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Historique */}
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
                {sessions.map((s) => (
                  <div key={s.id} className="rounded-lg border border-edge-border bg-edge-surface p-3">
                    <div className="flex justify-between text-xs text-edge-muted mb-2">
                      <span>{new Date(s.createdAt).toLocaleDateString('fr-FR')}</span>
                      <span>{s.sports?.join(', ')}</span>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span className="text-edge-text">{s.bets?.length || 0} paris</span>
                      <span className="text-edge-accent">{s.bets?.filter((b) => b.result === 'won').length || 0} gagnés</span>
                      <span className="text-edge-danger">{s.bets?.filter((b) => b.result === 'lost').length || 0} perdus</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
