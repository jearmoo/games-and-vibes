import { useState } from 'react';
import { createPortal } from 'react-dom';

export function HelpButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? "w-5 h-5 flex items-center justify-center rounded text-[10px] text-gray-500 hover:text-accent hover:bg-white/5 transition-colors font-semibold"}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="How to Play" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative glass-card rounded-2xl border border-white/10 max-w-sm w-full max-h-[80vh] overflow-auto p-5 animate-fade-in"
           onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close help"
          className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors text-base">
          &times;
        </button>

        <div className="font-display text-lg text-white tracking-wider mb-4"
             style={{ textShadow: '0 0 20px rgba(99,102,241,0.3)' }}>
          How to Play
        </div>

        <div className="space-y-4 text-sm leading-relaxed">
          <div>
            <div className="text-accent font-semibold text-xs uppercase tracking-wider mb-1">The Game</div>
            <p className="text-gray-400">
              Two teams compete in rounds. Each round, both Taboo Masters simultaneously set up challenges
              for the opposing team — choosing taboo words and picking a clue-giver. Then teams take turns cluing.
            </p>
          </div>

          <div>
            <div className="text-accent font-semibold text-xs uppercase tracking-wider mb-1">Roles</div>
            <div className="space-y-2 text-gray-400">
              <p><span className="text-white font-medium">Taboo Master</span> — Picks forbidden words for the other team and buzzes when they slip up during cluing.</p>
              <p><span className="text-white font-medium">Clue-Giver</span> — Describes words to teammates without using any taboo words.</p>
              <p><span className="text-white font-medium">Guesser</span> — Listens to clues and guesses the words.</p>
              <p><span className="text-white font-medium">Watcher</span> — Observes the other team's cluing turn.</p>
            </div>
          </div>

          <div>
            <div className="text-accent font-semibold text-xs uppercase tracking-wider mb-1">Scoring</div>
            <p className="text-gray-400">
              <span className="text-emerald-400 font-medium">+3</span> per correct word &nbsp;
              <span className="text-team-b-glow font-medium">-1</span> per taboo buzz
            </p>
          </div>

          <div>
            <div className="text-accent font-semibold text-xs uppercase tracking-wider mb-1">Flow</div>
            <p className="text-gray-400 text-xs mb-2">Each round repeats this cycle. The game lasts multiple rounds (set by host).</p>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-400">Setup</span>
              <span>&#8594;</span>
              <span className="px-2 py-0.5 rounded bg-team-a/10 text-team-a-glow">Team A Clues</span>
              <span>&#8594;</span>
              <span className="px-2 py-0.5 rounded bg-team-b/10 text-team-b-glow">Team B Clues</span>
              <span>&#8594;</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-400">Results</span>
              <span>&#8594;</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-500 italic">next round...</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
