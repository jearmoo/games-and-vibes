import { useEffect, useRef } from 'react';
import { useGameStore, useTeamPlayers, useIsHost, SESSION_KEY } from '../store';
import { socket } from '../socket';

function Confetti({ color }: { color: 'A' | 'B' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = color === 'A'
      ? ['#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe', '#fbbf24']
      : ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fbbf24'];

    const pieces = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 3 + 2,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 10,
    }));

    let frame: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.vy += 0.03;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (pieces.some(p => p.y < canvas.height + 20)) {
        frame = requestAnimationFrame(animate);
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [color]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-20" />;
}

export default function GameOverScreen() {
  const scores = useGameStore(s => s.scores);
  const winner = scores.A > scores.B ? 'A' : scores.B > scores.A ? 'B' : null;
  const isHost = useIsHost();
  const teamA = useTeamPlayers('A');
  const teamB = useTeamPlayers('B');

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-8 animate-fade-in">
      {/* Background effect + confetti */}
      <div className="fixed inset-0 pointer-events-none">
        {winner === 'A' && <div className="absolute inset-0 bg-team-a/15" />}
        {winner === 'B' && <div className="absolute inset-0 bg-team-b/15" />}
      </div>
      {winner && <Confetti color={winner} />}

      <div className="text-center relative z-10 animate-score-pop">
        <h1 className="font-display text-4xl text-white tracking-wider mb-2"
            style={{ textShadow: winner
              ? `0 0 40px ${winner === 'A' ? 'rgba(59,130,246,0.4)' : 'rgba(239,68,68,0.4)'}`
              : undefined }}>
          {winner ? `Team ${winner} Wins!` : "It's a Tie!"}
        </h1>
      </div>

      <div className="flex gap-10 text-center relative z-10">
        <div className={`transition-all ${winner === 'A' ? 'scale-110' : winner === 'B' ? 'opacity-50' : ''}`}>
          <div className="text-team-a-glow font-display text-sm tracking-wider">Team A</div>
          <div className="font-display text-5xl text-white mt-1">{scores.A}</div>
          <div className="text-gray-600 text-xs mt-2">
            {teamA.map(p => p.name).join(', ')}
          </div>
        </div>
        <div className={`transition-all ${winner === 'B' ? 'scale-110' : winner === 'A' ? 'opacity-50' : ''}`}>
          <div className="text-team-b-glow font-display text-sm tracking-wider">Team B</div>
          <div className="font-display text-5xl text-white mt-1">{scores.B}</div>
          <div className="text-gray-600 text-xs mt-2">
            {teamB.map(p => p.name).join(', ')}
          </div>
        </div>
      </div>

      <div className="w-full max-w-xs space-y-3 relative z-10">
        {isHost ? (
          <button
            onClick={() => socket.emit('game:play-again')}
            className="btn-primary w-full py-4 rounded-2xl text-white font-display text-lg
                       tracking-wider transition-all active:scale-[0.97]"
          >
            Play Again
          </button>
        ) : (
          <div className="text-center text-gray-600 text-xs py-2">Waiting for host...</div>
        )}
        <button
          onClick={() => {
            socket.emit('room:leave');
            useGameStore.getState().reset();
            localStorage.removeItem(SESSION_KEY);
            window.history.replaceState(null, '', '/');
          }}
          className="w-full py-3 text-gray-500 hover:text-white transition-colors text-sm"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
}
