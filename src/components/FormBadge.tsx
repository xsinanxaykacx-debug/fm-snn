// src/components/FormBadge.tsx

interface Props {
  result: 'W' | 'D' | 'L';
  size?: 'sm' | 'md';
}

const CONFIG = {
  W: { bg: 'bg-green-500',   text: 'text-white', label: 'G', tooltip: 'Galibiyet' },
  D: { bg: 'bg-yellow-500',  text: 'text-black', label: 'B', tooltip: 'Beraberlik' },
  L: { bg: 'bg-red-500',     text: 'text-white', label: 'M', tooltip: 'Mağlubiyet' },
};

export function FormBadge({ result, size = 'sm' }: Props) {
  const cfg = CONFIG[result];
  const sizeCls = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';

  return (
    <div
      className={`${sizeCls} ${cfg.bg} ${cfg.text} rounded font-bold flex items-center justify-center`}
      title={cfg.tooltip}
    >
      {cfg.label}
    </div>
  );
}

/**
 * Son N maçın form göstergesi.
 */
export function FormStrip({ results }: { results: ('W' | 'D' | 'L')[] }) {
  if (results.length === 0) {
    return <span className="text-xs text-slate-500">Henüz maç yok</span>;
  }

  return (
    <div className="flex gap-1">
      {results.map((r, i) => (
        <FormBadge key={i} result={r} size="sm" />
      ))}
    </div>
  );
}