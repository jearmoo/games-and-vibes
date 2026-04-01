import { useState, useEffect } from 'react';

export default function Timer({ endTime, duration = 60 }: { endTime: number; duration?: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));

  useEffect(() => {
    const interval = setInterval(() => {
      const r = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
  }, [endTime]);

  const isLow = remaining <= 10;
  const isCritical = remaining <= 5;
  const isFinal = remaining <= 3;
  const pct = Math.min(100, (remaining / duration) * 100);

  return (
    <div className="w-full">
      <div className={`text-center font-display text-5xl tracking-wider ${
        isFinal ? 'text-team-b-glow animate-buzz-shake'
        : isCritical ? 'text-team-b-glow animate-pulse'
        : isLow ? 'text-team-b-glow animate-pulse-slow'
        : 'text-white'
      }`}>
        {remaining}
      </div>
      <div className="w-full h-1 bg-surface-raised rounded-full mt-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-200 ${
            isLow ? 'bg-team-b' : 'bg-indigo-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
