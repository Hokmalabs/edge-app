import { useNavigate } from 'react-router-dom';
import { getBettingBankroll, getBettingSessions, getBRVMPortfolio, getBRVMConfirmedAmount } from '../utils/storage';
import { formatFCFA } from '../utils/kelly';
import BankrollCard from '../components/BankrollCard';

export default function Dashboard() {
  const navigate = useNavigate();
  const bankroll = getBettingBankroll();
  const sessions = getBettingSessions();
  const brvmPortfolio = getBRVMPortfolio();
  const brvmConfirmed = getBRVMConfirmedAmount();

  const lastBetting = sessions[0] || null;
  const totalPatrimoine = bankroll.current + brvmConfirmed;

  return (
    <div className="min-h-screen bg-edge-bg text-edge-text font-mono pb-24">
      {/* Header */}
      <div className="px-4 pt-12 pb-6 border-b border-edge-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-edge-accent text-lg font-bold tracking-wider">EDGE</span>
          <span className="text-edge-muted text-xs">v1.0</span>
        </div>
        <p className="text-edge-muted text-xs">Tableau de bord — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Patrimoine total */}
        <div className="rounded-lg border border-edge-accent/40 bg-gradient-to-br from-edge-accent/10 to-transparent p-5">
          <p className="text-xs text-edge-muted uppercase tracking-widest mb-1">Patrimoine Total</p>
          <p className="text-3xl font-bold text-edge-accent">{formatFCFA(totalPatrimoine)}</p>
          <p className="text-xs text-edge-muted mt-1">Paris + BRVM combinés</p>
        </div>

        {/* Cards bankrolls */}
        <div className="grid grid-cols-2 gap-3">
          <BankrollCard
            label="Bankroll Paris"
            current={bankroll.current}
            initial={bankroll.initial}
            subtitle={`Initial: ${formatFCFA(bankroll.initial)}`}
          />
          <BankrollCard
            label="Portefeuille BRVM"
            current={brvmConfirmed}
            subtitle={brvmConfirmed > 0 ? 'Achats confirmés' : 'Aucun achat confirmé'}
          />
        </div>

        {/* Dernière session paris */}
        {lastBetting && (
          <div className="rounded-lg border border-edge-border bg-edge-surface p-4">
            <p className="text-xs text-edge-muted uppercase tracking-widest mb-3">Dernière Analyse Paris</p>
            <p className="text-xs text-edge-muted mb-2">
              {new Date(lastBetting.createdAt).toLocaleDateString('fr-FR')} · {lastBetting.bets?.length || 0} paris
            </p>
            {lastBetting.bets?.slice(0, 2).map((bet) => (
              <div key={bet.id} className="flex justify-between items-center py-1.5 border-b border-edge-border/50 last:border-0">
                <div>
                  <p className="text-xs text-edge-text truncate max-w-[140px]">{bet.match}</p>
                  <p className="text-xs text-edge-accent">{bet.pick}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-edge-text">@{bet.odds}</p>
                  <p className={`text-xs font-semibold ${
                    bet.result === 'won' ? 'text-edge-accent' :
                    bet.result === 'lost' ? 'text-edge-danger' : 'text-edge-muted'
                  }`}>
                    {bet.result === 'won' ? '✓ GAGNÉ' : bet.result === 'lost' ? '✗ PERDU' : '⏳ EN COURS'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dernière reco BRVM */}
        {brvmPortfolio && (
          <div className="rounded-lg border border-edge-border bg-edge-surface p-4">
            <p className="text-xs text-edge-muted uppercase tracking-widest mb-3">Dernier Portefeuille BRVM</p>
            <p className="text-xs text-edge-muted mb-2">
              Stratégie: <span className="text-edge-accent">{brvmPortfolio.strategy_chosen || 'N/A'}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {brvmPortfolio.portfolio?.map((stock) => (
                <span key={stock.ticker} className="text-xs px-2 py-1 rounded border border-edge-border text-edge-text">
                  {stock.ticker}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Raccourcis */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/betting')}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-edge-border bg-edge-surface hover:border-edge-accent/50 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#00ff87" strokeWidth="1.5" className="w-6 h-6">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v9l5 3" />
            </svg>
            <span className="text-xs text-edge-text">Analyser Paris</span>
          </button>
          <button
            onClick={() => navigate('/brvm')}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-edge-border bg-edge-surface hover:border-edge-accent/50 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#00ff87" strokeWidth="1.5" className="w-6 h-6">
              <polyline points="3 17 9 11 13 15 21 7" />
              <polyline points="14 7 21 7 21 14" />
            </svg>
            <span className="text-xs text-edge-text">Investir BRVM</span>
          </button>
        </div>

        {/* Stats globales */}
        {sessions.length > 0 && (
          <div className="rounded-lg border border-edge-border bg-edge-surface p-4">
            <p className="text-xs text-edge-muted uppercase tracking-widest mb-3">Statistiques</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-edge-text">{sessions.length}</p>
                <p className="text-xs text-edge-muted">Sessions</p>
              </div>
              <div>
                <p className="text-lg font-bold text-edge-accent">
                  {sessions.flatMap((s) => s.bets || []).filter((b) => b.result === 'won').length}
                </p>
                <p className="text-xs text-edge-muted">Gagnés</p>
              </div>
              <div>
                <p className="text-lg font-bold text-edge-danger">
                  {sessions.flatMap((s) => s.bets || []).filter((b) => b.result === 'lost').length}
                </p>
                <p className="text-xs text-edge-muted">Perdus</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
