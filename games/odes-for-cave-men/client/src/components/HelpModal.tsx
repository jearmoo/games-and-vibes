import { useState } from 'react';
import { createPortal } from 'react-dom';

export function HelpButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          'w-5 h-5 flex items-center justify-center rounded text-[10px] text-gray-400 hover:text-amber-400 hover:bg-white/5 transition-colors font-semibold'
        }
        title="How to Play"
        aria-label="How to Play"
      >
        ?
      </button>
      {open && <HelpModal onClose={() => setOpen(false)} />}
    </>
  );
}

export default function HelpModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How to Play"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative glass-card rounded-2xl border border-white/10 max-w-sm w-full max-h-[80vh] overflow-auto p-5 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close help"
          className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-base"
        >
          &times;
        </button>

        <div
          className="font-display text-lg text-white tracking-wider mb-4"
          style={{ textShadow: '0 0 20px rgba(217, 119, 6, 0.3)' }}
        >
          How to Play
        </div>

        <div className="space-y-4 text-sm leading-relaxed">
          <div>
            <div className="text-amber-400 font-semibold text-xs uppercase tracking-wider mb-1">The Game</div>
            <p className="text-gray-300">
              Two teams take turns describing words &mdash; but you can only use{' '}
              <strong className="text-white">one-syllable words</strong> as clues. If the cluer slips and uses a big
              word, the other team can bonk them!
            </p>
          </div>

          <div>
            <div className="text-amber-400 font-semibold text-xs uppercase tracking-wider mb-1">Roles</div>
            <div className="space-y-2 text-gray-300">
              <p>
                <span className="text-white font-medium">Cluer</span> &mdash; Describes each word using only small
                (one-syllable) words. Swipe to score cards.
              </p>
              <p>
                <span className="text-white font-medium">Guesser</span> &mdash; Listens to clues and shouts out guesses.
              </p>
              <p>
                <span className="text-white font-medium">Opponent</span> &mdash; Watches for big words and hits the bonk
                button.
              </p>
            </div>
          </div>

          <div>
            <div className="text-amber-400 font-semibold text-xs uppercase tracking-wider mb-1">Scoring</div>
            <div className="space-y-1 text-gray-300">
              <p>
                <span className="text-emerald-400 font-medium">+1</span> easy word &nbsp;
                <span className="text-amber-400 font-medium">+3</span> hard word &nbsp;
                <span className="text-red-400 font-medium">-1</span> skip or bonk
              </p>
              <p className="text-xs text-gray-400">The cluer can adjust points on the review screen after each turn.</p>
            </div>
          </div>

          <div>
            <div className="text-amber-400 font-semibold text-xs uppercase tracking-wider mb-1">Flow</div>
            <p className="text-gray-300 text-xs mb-2">
              Each round, both teams take one turn. The game continues until the host ends it.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">Team A Clues</span>
              <span>&#8594;</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300">Review</span>
              <span>&#8594;</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Team B Clues</span>
              <span>&#8594;</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300">Scores</span>
              <span>&#8594;</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-400 italic">next round...</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
