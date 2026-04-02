export default function KickedScreen({ reason, onReturn }: { reason: string; onReturn: () => void }) {
  return (
    <div className="h-full flex items-center justify-center p-6 animate-fade-in">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-amber-500/[0.07] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-xs text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400">
            <path d="M18.36 19.61L12 13.25l-6.36 6.36M5.64 4.39L12 10.75l6.36-6.36" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          </svg>
        </div>

        <div>
          <h2
            className="font-display text-3xl text-white tracking-wider mb-3"
            style={{ textShadow: '0 0 30px rgba(245, 158, 11, 0.25)' }}
          >
            Disconnected
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">{reason}</p>
        </div>

        <button
          data-testid="kicked-back-button"
          onClick={onReturn}
          className="w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider transition-all active:scale-[0.97] bg-surface-raised hover:bg-surface-hover border border-white/5"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
