import type { ActionButtonBarProps } from './types.js';

export default function ActionButtonBar({ rows, onAction }: ActionButtonBarProps) {
  return (
    <div className="space-y-2">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-2">
          {row.map((btn) => (
            <button key={btn.id} onClick={() => onAction(btn.id)} className={btn.className}>
              {btn.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
