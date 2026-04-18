import { useState } from 'react';
import { getBRVMSessions, saveBRVMSession, saveBRVMPortfolio, getBRVMPortfolio, getBettingBankroll, saveBettingBankroll, appendBankrollPoint, addBRVMConfirmedAmount } from '../utils/storage';
import { formatFCFA } from '../utils/kelly';


const RISK_COLORS = {
  'Faible': 'text-edge-accent',
  'Modéré': 'text-edge-warning',
  'Élevé': 'text-edge-danger',
  'faible': 'text-edge-accent',
  'modéré': 'text-edge-warning',
  'élevé': 'text-edge-danger',
};


export default function BRVMAgent() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [sessions, setSessions] = useState(getBRVMSessions());
  const [showHistory, setShowHistory] = useState(false);
  const [currentPortfolio] = useState(getBRVMPortfolio());
  const [stockConfirmations, setStockConfirmations] = useState({});

  const confirmStock = (ticker, amount) => {
    setStockConfirmations((prev) => ({ ...prev, [ticker]: 'bought' }));
    const br = getBettingBankroll();
    const updated = { ...br, current: Math.max(0, br.current - amount) };
    saveBettingBankroll(updated);
    appendBankrollPoint(updated.current);
    addBRVMConfirmedAmount(amount);
  };

  const skipStock = (ticker) => {
    setStockConfirmations((prev) => ({ ...prev, [ticker]: 'skipped' }));
  };

  const handleAnalyze = async () => {
    const amountNum = parseInt(amount.replace(/\D/g, ''), 10);
    if (!amountNum || amountNum < 10000) {
      setError('Montant minimum: 10 000 FCFA');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    const userPrompt = `Montant à investir: ${amountNum} FCFA. Utilise ta connaissance des actions BRVM cotées (SIB, SONATEL, ORANGE CI, ECOBANK, SGCI, UNIWAX, NESTLE CI, SOLIBRA, SAFCA, PALM CI) avec des prix approximatifs réalistes et propose un portefeuille de 3 à 5 actions.`;

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: "Tu es un conseiller BRVM expert. Utilise web_search pour trouver les cours RÉELS actuels des actions BRVM aujourd'hui. Ne donne que des prix réels vérifiés. Devise: FCFA. Explique simplement pour débutant. Diversifie sur au moins 3 secteurs. Garde 10% en cash.",
          userPrompt,
          tools: [
            {
              name: 'propose_portfolio',
              description: 'Propose un portefeuille BRVM débutant',
              input_schema: {
                type: 'object',
                properties: {
                  strategy_chosen: { type: 'string' },
                  strategy_reason: { type: 'string' },
                  market_context: { type: 'string' },
                  portfolio: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        ticker: { type: 'string' },
                        company: { type: 'string' },
                        sector: { type: 'string' },
                        shares: { type: 'number' },
                        price_per_share: { type: 'number' },
                        total_amount: { type: 'number' },
                        simple_explanation: { type: 'string' },
                        why_good_for_beginner: { type: 'string' },
                      },
                      required: ['ticker', 'company', 'sector', 'shares', 'price_per_share', 'total_amount', 'simple_explanation', 'why_good_for_beginner'],
                    },
                  },
                  total_invested: { type: 'number' },
                  cash_reserve: { type: 'number' },
                  risk_level: { type: 'string' },
                  beginner_tips: { type: 'array', items: { type: 'string' } },
                  next_review_date: { type: 'string' },
                },
                required: ['strategy_chosen', 'strategy_reason', 'market_context', 'portfolio', 'total_invested', 'cash_reserve', 'risk_level', 'beginner_tips'],
              },
            },
          ],
          toolName: 'propose_portfolio',
        }),
      });

      const parsed = await res.json();
      if (!res.ok) throw new Error(parsed.error || 'Erreur serveur');
      console.log('PARSED:', JSON.stringify(parsed));

      setResult(parsed);
      setStockConfirmations({});
      saveBRVMPortfolio(parsed);
      const session = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        amount: amountNum,
        strategy: parsed.strategy_chosen,
        risk_level: parsed.risk_level,
        stocks_count: parsed.portfolio?.length || 0,
        total_invested: parsed.total_invested,
      };
      saveBRVMSession(session);
      setSessions(getBRVMSessions());
    } catch (e) {
      console.error('ERREUR:', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-edge-bg text-edge-text font-mono pb-24">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 border-b border-edge-border">
        <h1 className="text-lg font-bold text-edge-accent">EDGE / BRVM</h1>
        <p className="text-xs text-edge-muted">Conseiller investissement BRVM — Débutant</p>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Contexte éducatif */}
        <div className="rounded-lg border border-edge-info/20 bg-edge-info/5 p-4">
          <p className="text-xs text-edge-info mb-1 font-semibold">📊 Bourse Régionale des Valeurs Mobilières</p>
          <p className="text-xs text-edge-muted leading-relaxed">
            La BRVM est la bourse commune de l'Afrique de l'Ouest (UEMOA). Elle regroupe 45 entreprises des secteurs banque, télécom, agriculture, industrie et distribution. Siège à Abidjan.
          </p>
        </div>

        {/* Portefeuille actuel */}
        {currentPortfolio && !result && (
          <div className="rounded-lg border border-edge-border bg-edge-surface p-4">
            <p className="text-xs text-edge-muted uppercase tracking-widest mb-2">Dernier Portefeuille</p>
            <p className="text-sm text-edge-accent font-bold">{currentPortfolio.strategy_chosen}</p>
            <p className="text-xs text-edge-muted mt-1">{formatFCFA(currentPortfolio.total_invested)} investis · {currentPortfolio.portfolio?.length} actions</p>
          </div>
        )}

        {/* Saisie montant */}
        <div>
          <p className="text-xs text-edge-muted uppercase tracking-widest mb-2">Montant à Investir (FCFA)</p>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ex: 250000"
            className="w-full bg-edge-surface border border-edge-border rounded px-3 py-3 text-sm text-edge-text placeholder-edge-muted focus:outline-none focus:border-edge-accent/50"
          />
          {amount && parseInt(amount) > 0 && (
            <p className="text-xs text-edge-muted mt-1">
              ≈ {formatFCFA(parseInt(amount))} · Cash réservé (10%): {formatFCFA(parseInt(amount) * 0.1)}
            </p>
          )}
        </div>

        {/* Bouton analyse */}
        <button
          onClick={handleAnalyze}
          disabled={loading || !amount}
          className="w-full py-3.5 rounded-lg font-bold text-sm tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-edge-accent text-edge-bg hover:bg-edge-accent-dim active:scale-95"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⟳</span> ANALYSE DU MARCHÉ BRVM...
            </span>
          ) : '▶ OBTENIR MON PORTEFEUILLE'}
        </button>

        {/* Erreur */}
        {error && (
          <div className="rounded-lg border border-edge-danger/40 bg-edge-danger/10 p-4">
            <p className="text-xs text-edge-danger">{error}</p>
          </div>
        )}

        {/* Résultats */}
        {result && (
          <div className="space-y-4">
            {/* Stratégie choisie */}
            <div className="rounded-lg border border-edge-accent/30 bg-edge-accent/5 p-4">
              <p className="text-xs text-edge-muted uppercase tracking-widest mb-2">Stratégie Choisie</p>
              <p className="text-base font-bold text-edge-accent">{result.strategy_chosen}</p>
              {result.strategy_reason && (
                <p className="text-xs text-edge-text mt-2 leading-relaxed">{result.strategy_reason}</p>
              )}
            </div>

            {/* Contexte marché */}
            {result.market_context && (
              <div className="rounded-lg border border-edge-border bg-edge-surface p-4">
                <p className="text-xs text-edge-muted uppercase tracking-widest mb-2">Contexte Marché</p>
                <p className="text-xs text-edge-text leading-relaxed">{result.market_context}</p>
              </div>
            )}

            {/* Résumé financier */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-edge-border bg-edge-surface p-3 text-center">
                <p className="text-xs text-edge-muted mb-1">Investi</p>
                <p className="text-sm font-bold text-edge-accent">{formatFCFA(result.total_invested)}</p>
              </div>
              <div className="rounded-lg border border-edge-border bg-edge-surface p-3 text-center">
                <p className="text-xs text-edge-muted mb-1">Cash</p>
                <p className="text-sm font-bold text-edge-text">{formatFCFA(result.cash_reserve)}</p>
              </div>
              <div className="rounded-lg border border-edge-border bg-edge-surface p-3 text-center">
                <p className="text-xs text-edge-muted mb-1">Risque</p>
                <p className={`text-sm font-bold ${RISK_COLORS[result.risk_level] || 'text-edge-text'}`}>
                  {result.risk_level}
                </p>
              </div>
            </div>

            {/* Portefeuille avec confirmation d'achat */}
            <p className="text-xs text-edge-muted uppercase tracking-widest">
              Portefeuille ({result.portfolio?.length || 0} actions) — Confirme tes achats
            </p>
            {result.portfolio?.map((stock) => {
              const status = stockConfirmations[stock.ticker];
              return (
                <div key={stock.ticker} className={`rounded-lg border p-4 space-y-2 ${
                  status === 'bought' ? 'border-edge-accent/50 bg-edge-accent/5'
                  : status === 'skipped' ? 'border-edge-border/40 opacity-50'
                  : 'border-edge-border bg-edge-surface'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-edge-accent font-bold text-sm">{stock.ticker}</span>
                      <p className="text-xs text-edge-muted">{stock.sector}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-edge-text">{formatFCFA(stock.total_amount)}</p>
                      <p className="text-xs text-edge-muted">{stock.shares} actions · {formatFCFA(stock.price_per_share)}/action</p>
                    </div>
                  </div>
                  <p className="text-xs text-edge-text font-medium">{stock.company}</p>
                  {stock.simple_explanation && (
                    <p className="text-xs text-edge-muted leading-relaxed border-t border-edge-border pt-2">{stock.simple_explanation}</p>
                  )}
                  {status ? (
                    <p className={`text-xs font-bold pt-1 ${status === 'bought' ? 'text-edge-accent' : 'text-edge-muted'}`}>
                      {status === 'bought' ? '✅ Acheté — bankroll mise à jour' : '⏭ Non acheté'}
                    </p>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => confirmStock(stock.ticker, stock.total_amount)}
                        className="flex-1 text-xs py-2 rounded border border-edge-accent text-edge-accent hover:bg-edge-accent/10 transition-colors"
                      >✅ J'AI ACHETÉ</button>
                      <button
                        onClick={() => skipStock(stock.ticker)}
                        className="flex-1 text-xs py-2 rounded border border-edge-border text-edge-muted hover:bg-edge-border/20 transition-colors"
                      >⏭ PAS ACHETÉ</button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Conseils débutant */}
            {result.beginner_tips && (
              <div className="rounded-lg border border-edge-warning/20 bg-edge-warning/5 p-4">
                <p className="text-xs text-edge-warning uppercase tracking-widest mb-3">Conseils Pratiques</p>
                {Array.isArray(result.beginner_tips)
                  ? result.beginner_tips.map((tip, i) => (
                    <p key={i} className="text-xs text-edge-text leading-relaxed mb-2">▸ {tip}</p>
                  ))
                  : <p className="text-xs text-edge-text leading-relaxed">{result.beginner_tips}</p>
                }
                <div className="mt-3 pt-3 border-t border-edge-border/50">
                  <p className="text-xs text-edge-muted">Pour acheter, contactez un <span className="text-edge-text">broker agréé BRVM</span> en Côte d'Ivoire :</p>
                  <p className="text-xs text-edge-muted mt-1">SGI (Société de Gestion et d'Intermédiation) · NSIA Finance · BOA Bourse · Coris Bourse</p>
                </div>
              </div>
            )}

            {/* Prochaine révision */}
            {result.next_review_date && (
              <p className="text-xs text-edge-muted text-center">
                Prochaine révision recommandée: <span className="text-edge-text">{result.next_review_date}</span>
              </p>
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
              <span className="uppercase tracking-widest">Historique ({sessions.length} analyses)</span>
              <span>{showHistory ? '▲' : '▼'}</span>
            </button>
            {showHistory && (
              <div className="space-y-3 mt-2">
                {sessions.map((s) => (
                  <div key={s.id} className="rounded-lg border border-edge-border bg-edge-surface p-3">
                    <div className="flex justify-between text-xs text-edge-muted mb-1">
                      <span>{new Date(s.createdAt).toLocaleDateString('fr-FR')}</span>
                      <span className={RISK_COLORS[s.risk_level] || 'text-edge-muted'}>{s.risk_level}</span>
                    </div>
                    <p className="text-xs text-edge-accent">{s.strategy}</p>
                    <div className="flex gap-4 text-xs text-edge-muted mt-1">
                      <span>{formatFCFA(s.total_invested)} investis</span>
                      <span>{s.stocks_count} actions</span>
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
