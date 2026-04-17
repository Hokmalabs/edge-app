/**
 * Calcul Kelly fractionné (1/4 Kelly)
 * f = (p * b - q) / b
 * mise = (f / 4) * bankroll
 * @param {number} prob - probabilité estimée (0-1)
 * @param {number} odds - cote décimale
 * @param {number} bankroll - bankroll actuelle en FCFA
 * @returns {{ kellyFraction: number, stakePct: number, stakeAmount: number }}
 */
export function kellyStake(prob, odds, bankroll) {
  const b = odds - 1;
  const q = 1 - prob;
  const f = (prob * b - q) / b;
  const fraction = Math.max(0, f);
  const quarterKelly = fraction / 4;
  const cappedPct = Math.min(quarterKelly, 0.05);
  return {
    kellyFraction: parseFloat(fraction.toFixed(4)),
    stakePct: parseFloat((cappedPct * 100).toFixed(2)),
    stakeAmount: Math.round(cappedPct * bankroll),
  };
}

/**
 * Calcul EV (Expected Value)
 * EV = prob * (odds - 1) - (1 - prob)
 */
export function calcEV(prob, odds) {
  return parseFloat((prob * (odds - 1) - (1 - prob)).toFixed(4));
}

export function formatFCFA(amount) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' F';
}

export function calcROI(initial, current) {
  if (!initial || initial === 0) return 0;
  return parseFloat((((current - initial) / initial) * 100).toFixed(2));
}
