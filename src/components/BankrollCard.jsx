import { formatFCFA, calcROI } from '../utils/kelly';

export default function BankrollCard({ label, current, initial, subtitle, accent = false }) {
  const roi = calcROI(initial, current);
  const isPositive = roi >= 0;

  return (
    <div className={`rounded-lg border p-4 font-mono ${accent ? 'border-edge-accent/30 bg-edge-accent/5' : 'border-edge-border bg-edge-surface'}`}>
      <p className="text-xs text-edge-muted uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-edge-accent' : 'text-edge-text'}`}>
        {formatFCFA(current)}
      </p>
      {initial !== undefined && (
        <p className={`text-xs mt-1 ${isPositive ? 'text-edge-accent' : 'text-edge-danger'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(roi)}% {isPositive ? 'profit' : 'perte'}
        </p>
      )}
      {subtitle && <p className="text-xs text-edge-muted mt-1">{subtitle}</p>}
    </div>
  );
}
