import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getPendingBets, getBetHistory, getNotPlayedBets,
  resolveBet, resolveParlayBet,
  getBettingBankroll,
} from '../utils/storage';
import { formatFCFA } from '../utils/kelly';

const TABS = ['EN ATTENTE', 'HISTORIQUE', 'PAS JOUÉS'];

function PendingBetCard({ bet, onResolve }) {
  return (
    <div className="rounded-lg border border-edge-border bg-edge-surface p-4 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          {bet.type === 'parlay' ? (
            <span className="text-xs px-2 py-0.5 rounded bg-edge-warning/20 text-edge-warning mr-2">COMBINÉ</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded bg-edge-border text-edge-muted mr-2">{bet.sport}</span>
          )}
          {bet.match_time && <span className="text-xs text-edge-warning">{bet.match_time}</span>}
        </div>
        <span className="text-xs text-edge-muted">{new Date(bet.played_at || bet.sessionDate).toLocaleDateString('fr-FR')}</span>
      </div>
      {bet.type === 'single' ? (
        <>
          <p className="text-sm text-edge-text font-semibold">{bet.match}</p>
          <div className="flex justify-between">
            <p className="text-edge-accent font-bold">{bet.pick}</p>
            <p className="text-edge-text font-bold">@{bet.odds}</p>
          </div>
          <div className="flex justify-between text-xs text-edge-muted">
            <span>Mise: <span className="text-edge-text">{formatFCFA(bet.stake_amount)}</span></span>
            <span>Gain potentiel: <span className="text-edge-accent">{formatFCFA(bet.stake_amount * (bet.odds - 1))}</span></span>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-edge-text font-semibold">Combiné @{bet.combined_odds}</p>
          <div className="flex justify-between text-xs text-edge-muted">
            <span>Mise: <span className="text-edge-text">{formatFCFA(bet.stake_amount)}</span></span>
            <span>Gain potentiel: <span className="text-edge-accent">{formatFCFA(bet.potential_return)}</span></span>
          </div>
        </>
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onResolve(bet, true)}
          className="flex-1 text-xs py-2.5 rounded border border-edge-accent text-edge-accent hover:bg-edge-accent/10 transition-colors font-semibold"
        >
          ✅ GAGNÉ
        </button>
        <button
          onClick={() => onResolve(bet, false)}
          className="flex-1 text-xs py-2.5 rounded border border-edge-danger text-edge-danger hover:bg-edge-danger/10 transition-colors font-semibold"
        >
          ❌ PERDU
        </button>
      </div>
    </div>
  );
}

function HistoryBetCard({ bet }) {
  const won = bet.status === 'won';
  const pnl = bet.result_amount ?? 0;
  return (
    <div className="rounded-lg border border-edge-border bg-edge-surface p-3 space-y-1.5">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-1.5">
          {bet.type === 'parlay' ? (
            <span className="text-xs px-1.5 py-0.5 rounded bg-edge-warning/20 text-edge-warning">COMBINÉ</span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 rounded bg-edge-border text-edge-muted">{bet.sport}</span>
          )}
          <span className={`text-xs font-bold ${won ? 'text-edge-accent' : 'text-edge-danger'}`}>
            {won ? '✓ GAGNÉ' : '✗ PERDU'}
          </span>
        </div>
        <span className={`text-sm font-bold ${won ? 'text-edge-accent' : 'text-edge-danger'}`}>
          {pnl >= 0 ? '+' : ''}{formatFCFA(pnl)}
        </span>
      </div>
      {bet.type === 'single' ? (
        <p className="text-xs text-edge-text">{bet.match} — <span className="text-edge-accent">{bet.pick}</span> @{bet.odds}</p>
      ) : (
        <p className="text-xs text-edge-text">Combiné @{bet.combined_odds}</p>
      )}
      <p className="text-xs text-edge-muted">{new Date(bet.resolved_at || bet.sessionDate).toLocaleDateString('fr-FR')}</p>
    </div>
  );
}

export default function MyBets() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [pending, setPending] = useState(getPendingBets());
  const [history, setHistory] = useState(getBetHistory());
  const [notPlayed, setNotPlayed] = useState(getNotPlayedBets());
  const bankroll = getBettingBankroll();

  const refresh = () => {
    setPending(getPendingBets());
    setHistory(getBetHistory());
    setNotPlayed(getNotPlayedBets());
  };

  const handleResolve = (bet, won) => {
    if (bet.type === 'parlay') {
      resolveParlayBet(bet.sessionId, won);
    } else {
      resolveBet(bet.sessionId, bet.id, won);
    }
    refresh();
  };

  const totalStake = pending.reduce((sum, b) => sum + (b.stake_amount || 0), 0);
  const totalPotential = pending.reduce((sum, b) => {
    if (b.type === 'parlay') return sum + (b.potential_return || 0);
    return sum + b.stake_amount * (b.odds - 1);
  }, 0);

  const wonBets = history.filter((b) => b.status === 'won');
  const lostBets = history.filter((b) => b.status === 'lost');
  const totalPnl = history.reduce((sum, b) => sum + (b.result_amount ?? 0), 0);
  const winRate = history.length > 0 ? Math.round((wonBets.length / history.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-edge-bg text-edge-text font-mono pb-24">
      <div className="px-4 pt-12 pb-4 border-b border-edge-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-edge-muted text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-edge-accent">MES PARIS</h1>
            <p className="text-xs text-edge-muted">Suivi et résultats</p>
          </div>
        </div>
      </div>

      {/* Bankroll summary */}
      <div className="px-4 py-4 border-b border-edge-border">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold text-edge-text">{formatFCFA(bankroll.current)}</p>
            <p className="text-xs text-edge-muted">Bankroll</p>
          </div>
          <div>
            <p className={`text-lg font-bold ${totalPnl >= 0 ? 'text-edge-accent' : 'text-edge-danger'}`}>
              {totalPnl >= 0 ? '+' : ''}{formatFCFA(totalPnl)}
            </p>
            <p className="text-xs text-edge-muted">P&L Total</p>
          </div>
          <div>
            <p className="text-lg font-bold text-edge-accent">{winRate}%</p>
            <p className="text-xs text-edge-muted">Win Rate</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-edge-border">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`flex-1 py-3 text-xs font-semibold tracking-wider transition-colors relative ${
              tab === i ? 'text-edge-accent' : 'text-edge-muted'
            }`}
          >
            {t}
            {i === 0 && pending.length > 0 && (
              <span className="ml-1 text-xs bg-edge-accent text-edge-bg rounded-full px-1.5">{pending.length}</span>
            )}
            {tab === i && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-edge-accent" />}
          </button>
        ))}
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* EN ATTENTE */}
        {tab === 0 && (
          <>
            {pending.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-edge-muted text-sm">Aucun pari en attente de résultat</p>
                <p className="text-edge-muted text-xs mt-2">Lance une analyse et marque tes paris comme JOUÉ</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-xs text-edge-muted">
                  <span>Mise totale: <span className="text-edge-text">{formatFCFA(totalStake)}</span></span>
                  <span>Gain potentiel: <span className="text-edge-accent">{formatFCFA(totalPotential)}</span></span>
                </div>
                {pending.map((bet) => (
                  <PendingBetCard key={bet.id} bet={bet} onResolve={handleResolve} />
                ))}
              </>
            )}
          </>
        )}

        {/* HISTORIQUE */}
        {tab === 1 && (
          <>
            {history.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-edge-muted text-sm">Aucun résultat enregistré</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 text-center rounded-lg border border-edge-border bg-edge-surface p-3">
                  <div>
                    <p className="text-sm font-bold text-edge-accent">{wonBets.length}</p>
                    <p className="text-xs text-edge-muted">Gagnés</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-edge-danger">{lostBets.length}</p>
                    <p className="text-xs text-edge-muted">Perdus</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-edge-text">{history.length}</p>
                    <p className="text-xs text-edge-muted">Total</p>
                  </div>
                </div>
                {history.map((bet) => (
                  <HistoryBetCard key={bet.id} bet={bet} />
                ))}
              </>
            )}
          </>
        )}

        {/* PAS JOUÉS */}
        {tab === 2 && (
          <>
            {notPlayed.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-edge-muted text-sm">Aucun pari ignoré</p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-edge-border/50 bg-edge-surface/50 p-3">
                  <p className="text-xs text-edge-muted leading-relaxed">
                    Ces paris ont été proposés mais non joués. Analyse ton taux de skip — si tu skipes souvent les mêmes types de paris, affine ton contexte.
                  </p>
                </div>
                {notPlayed.map((bet) => (
                  <div key={bet.id} className="rounded-lg border border-edge-border bg-edge-surface p-3 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-edge-border text-edge-muted">
                        {bet.type === 'parlay' ? 'COMBINÉ' : bet.sport}
                      </span>
                      <span className="text-xs text-edge-muted">{new Date(bet.sessionDate).toLocaleDateString('fr-FR')}</span>
                    </div>
                    {bet.type === 'single' ? (
                      <p className="text-xs text-edge-text">{bet.match} — <span className="text-edge-accent">{bet.pick}</span> @{bet.odds}</p>
                    ) : (
                      <p className="text-xs text-edge-text">Combiné @{bet.combined_odds} — {formatFCFA(bet.potential_return)} potentiel</p>
                    )}
                    <p className="text-xs text-edge-muted">Mise prévue: {formatFCFA(bet.stake_amount)}</p>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
