import { useState } from 'react';
import { getBRVMSessions, saveBRVMSession, saveBRVMPortfolio, getBRVMPortfolio } from '../utils/storage';
import { formatFCFA } from '../utils/kelly';


const RISK_COLORS = {
  'Faible': 'text-edge-accent',
  'Modéré': 'text-edge-warning',
  'Élevé': 'text-edge-danger',
  'faible': 'text-edge-accent',
  'modéré': 'text-edge-warning',
  'élevé': 'text-edge-danger',
};

function StockCard({ stock }) {
  return (
    <div className="rounded-lg border border-edge-border bg-edge-surface p-4 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-edge-accent font-bold text-sm">{stock.ticker}</span>
          <p className="text-xs text-edge-muted">{stock.sector}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-edge-text">{formatFCFA(stock.total_amount)}</p>
          <p className="text-xs text-edge-muted">{stock.shares} actions</p>
        </div>
      </div>
      <p className="text-xs text-edge-text font-medium">{stock.company}</p>
      <p className="text-xs text-edge-muted">Prix unitaire: <span className="text-edge-text">{formatFCFA(stock.price_per_share)}</span></p>
      {stock.simple_explanation && (
        <div className="border-t border-edge-border pt-2">
          <p className="text-xs text-edge-text leading-relaxed">{stock.simple_explanation}</p>
        </div>
      )}
      {stock.why_good_for_beginner && (
        <p className="text-xs text-edge-accent leading-relaxed">💡 {stock.why_good_for_beginner}</p>
      )}
    </div>
  );
}

export default function BRVMAgent() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [sessions, setSessions] = useState(getBRVMSessions());
  const [showHistory, setShowHistory] = useState(false);
  const [currentPortfolio] = useState(getBRVMPortfolio());

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
          system: "Tu es un conseiller BRVM expert. Devise: FCFA. Recommande un portefeuille débutant diversifié sur au moins 3 secteurs. Garde 10% en cash. Réponds UNIQUEMENT via l'outil propose_portfolio.",
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
          tool_choice: { type: 'tool', name: 'propose_portfolio' },
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      const data = await res.json();
      clearTimeout(timeoutId);
      console.log('RAW:', JSON.stringify(data));

      const toolUse = data.content.find((b) => b.type === 'tool_use');
      if (!toolUse) throw new Error('Pas de réponse structurée');
      const parsed = toolUse.input;
      setResult(parsed);
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
      clearTimeout(timeoutId);
      console.error('ERREUR:', e.message);
      if (e.name === 'AbortError') {
        setError("Délai dépassé - Réessaie sans web search ou avec moins de sports sélectionnés");
      } else {
        setError(e.message);
      }
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

            {/* Portefeuille */}
            <p className="text-xs text-edge-muted uppercase tracking-widest">
              Portefeuille ({result.portfolio?.length || 0} actions)
            </p>
            {result.portfolio?.map((stock) => (
              <StockCard key={stock.ticker} stock={stock} />
            ))}

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
