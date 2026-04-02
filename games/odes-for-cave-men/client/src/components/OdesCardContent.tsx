interface OdesCardContentProps {
  word1: string;
  word3: string;
}

export default function OdesCardContent({ word1, word3 }: OdesCardContentProps) {
  return (
    <>
      {/* Top: 1pt word (dark surface) */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-4 relative"
        style={{ background: 'linear-gradient(to bottom, #161c32, #0f1424)' }}
      >
        <div className="absolute top-2.5 left-3">
          <span className="font-display text-[10px] tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400/70">
            1 pt
          </span>
        </div>
        <div
          className="font-display text-2xl text-white tracking-wider text-center leading-tight"
          style={{ textShadow: '0 0 20px rgba(251,191,36,0.15)' }}
        >
          {word1}
        </div>
      </div>

      {/* Divider */}
      <div className="relative h-0">
        <div className="absolute inset-x-0 -top-px h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
      </div>

      {/* Bottom: 3pt phrase (slightly warmer dark) */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-4 relative"
        style={{ background: 'linear-gradient(to bottom, #1a1525, #120e1e)' }}
      >
        <div className="absolute top-2.5 left-3">
          <span className="font-display text-[10px] tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400/70">
            3 pts
          </span>
        </div>
        <div
          className="font-display text-xl text-white tracking-wider text-center leading-tight"
          style={{ textShadow: '0 0 20px rgba(251,191,36,0.15)' }}
        >
          {word3}
        </div>
      </div>
    </>
  );
}
