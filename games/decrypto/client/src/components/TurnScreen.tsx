import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { Timer } from '@games/client-core';
import {
  CODE_DIGITS,
  DecryptoPhase,
  type ClueContent,
  type Code,
  type CodeDigit,
  type GuessKind,
  type PublicTeamTurnState,
  type TeamId,
} from '@games/decrypto-shared';
import { useGameStore } from '../store';
import {
  AnimatedLockButton,
  ClueBank,
  ClueView,
  CodeDisplay,
  KeywordPanel,
  MobileScoreSummary,
  ScoreStrip,
  SignalHistory,
  TEAM_STYLES,
  TeamBadge,
  clueHasContent,
  clueListLabel,
  createTextClue,
  formatCode,
  otherTeam,
  possessiveName,
} from './shared';
import GameHeader from './GameHeader';

function createEmptyClues(): ClueContent[] {
  return [createTextClue(), createTextClue(), createTextClue()];
}

export default function TurnScreen() {
  const room = useGameStore((s) => s.room);
  const privateState = useGameStore((s) => s.privateState);
  const [clues, setClues] = useState<ClueContent[]>(createEmptyClues);
  const [submitting, setSubmitting] = useState(false);
  const [roundDetailsOpen, setRoundDetailsOpen] = useState(false);
  const [wordsHidden, setWordsHidden] = useState(false);

  const turn = room?.turn;
  const myTeam = privateState?.team;
  const myTurn = myTeam && turn ? turn.teams[myTeam] : undefined;
  const turnKey = myTurn ? `${turn?.round}:${myTurn.team}:${myTurn.encryptorId}` : '';

  useEffect(() => {
    setClues(createEmptyClues());
    setSubmitting(false);
  }, [turnKey]);

  useEffect(() => {
    setRoundDetailsOpen(false);
  }, [room?.phase, turn?.round]);

  if (!room || !turn) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 font-display tracking-wider">
        Loading transmission...
      </div>
    );
  }

  const phase = room.phase;
  const clueTimer = phase === DecryptoPhase.CLUE ? turn.clueTimer : undefined;
  const phaseLabel = phase === DecryptoPhase.CLUE ? 'Transmit signal' : 'Decode transmissions';

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <GameHeader dropdownOpen={roundDetailsOpen} onDropdownOpenChange={setRoundDetailsOpen} />
      {clueTimer && <FixedClueTimer endTime={clueTimer.expiresAt} duration={clueTimer.durationSeconds} />}
      <div className="grid min-h-0 flex-1 w-full max-w-6xl mx-auto grid-cols-1 lg:grid-cols-[1fr_21rem] gap-2 overflow-y-auto px-3 pt-1 pb-4 sm:gap-4 sm:px-5 sm:pt-5 sm:pb-5">
        {roundDetailsOpen && (
          <div className="sm:hidden">
            <div className="rounded-lg border border-white/10 bg-black/15 p-2">
              <div className="mb-2 font-display text-base tracking-wider text-white">{phaseLabel}</div>
              <MobileScoreSummary scores={room.scores} players={room.players} />
            </div>
          </div>
        )}
        <div className="space-y-2 min-w-0 sm:space-y-4">
          <HeaderPanel />
          <KeywordPanel
            team={privateState?.team}
            keywords={privateState?.keywords}
            wordsHidden={wordsHidden}
            setWordsHidden={setWordsHidden}
          />

          {phase === DecryptoPhase.CLUE ? (
            <CluePhase
              clues={clues}
              setClues={setClues}
              submitting={submitting}
              setSubmitting={setSubmitting}
              wordsHidden={wordsHidden}
              setWordsHidden={setWordsHidden}
            />
          ) : (
            <GuessPhase />
          )}
        </div>

        <div className="space-y-2 sm:space-y-4">
          <ClueBank
            myTeam={privateState?.team}
            keywords={privateState?.keywords}
            history={room.clueHistory}
            wordsHidden={wordsHidden}
            setWordsHidden={setWordsHidden}
          />
          <HistoryPanel />
        </div>
      </div>
    </div>
  );
}

function HeaderPanel() {
  const room = useGameStore((s) => s.room)!;
  const turn = room.turn!;
  const phaseLabel = room.phase === DecryptoPhase.CLUE ? 'Transmit signal' : 'Decode transmissions';

  return (
    <div className="glass-card hidden rounded-2xl border border-white/10 p-4 sm:block">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Round {turn.round}</div>
          <div className="font-display text-3xl tracking-wider text-white">{phaseLabel}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
            {(['red', 'blue'] as TeamId[]).map((team) => {
              const teamTurn = turn.teams[team];
              const encryptor = room.players.find((p) => p.id === teamTurn.encryptorId);
              return (
                <span key={team} className={`rounded-lg border ${TEAM_STYLES[team].border} px-2 py-1`}>
                  <span className={TEAM_STYLES[team].text}>{TEAM_STYLES[team].label}</span>
                  <span className="text-gray-500"> by </span>
                  <span className="text-white">{encryptor?.name ?? 'Unknown'}</span>
                  {teamTurn.clueLocked && <span className="text-emerald-300"> locked</span>}
                </span>
              );
            })}
          </div>
        </div>
        <div className="w-full min-w-0">
          <ScoreStrip scores={room.scores} players={room.players} />
        </div>
      </div>
    </div>
  );
}

function FixedClueTimer({ endTime, duration }: { endTime: number; duration: number }) {
  return (
    <div className="fixed left-1/2 top-14 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-amber-300/25 bg-surface/92 p-3 shadow-[0_16px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:top-16">
      <div className="mb-2 text-center text-[10px] tracking-[0.3em] text-amber-200 uppercase">Clue timer</div>
      <Timer endTime={endTime} duration={duration} />
    </div>
  );
}

function CluePhase({
  clues,
  setClues,
  submitting,
  setSubmitting,
  wordsHidden,
  setWordsHidden,
}: {
  clues: ClueContent[];
  setClues: (clues: ClueContent[]) => void;
  submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
  wordsHidden: boolean;
  setWordsHidden: Dispatch<SetStateAction<boolean>>;
}) {
  const room = useGameStore((s) => s.room)!;
  const privateState = useGameStore((s) => s.privateState);
  const myTeam = privateState?.team;
  const myTurn = myTeam ? room.turn?.teams[myTeam] : undefined;
  const isEncryptor = privateState?.isEncryptor ?? false;
  const locked = myTurn?.clueLocked ?? false;
  const [drawingIndex, setDrawingIndex] = useState<number | null>(null);
  const [drawingDrafts, setDrawingDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    setSubmitting(false);
  }, [locked, setSubmitting]);

  if (!myTeam || !myTurn) {
    return <StatusPanel text="You joined mid-game and are spectating until the next lobby." />;
  }

  const encryptor = room.players.find((p) => p.id === myTurn.encryptorId);

  if (!isEncryptor) {
    return (
      <div className="space-y-4">
        <TeamClueStatus />
        <StatusPanel
          text={
            locked
              ? `${encryptor?.name ?? 'Your encryptor'} locked in. Waiting for the clue timer or the other team.`
              : `${encryptor?.name ?? 'Your encryptor'} is writing clues for your team.`
          }
        />
      </div>
    );
  }

  const setDrawingDraft = (index: number, dataUrl: string) => {
    setDrawingDrafts((drafts) => {
      if (!dataUrl) {
        if (!(index in drafts)) return drafts;
        const next = { ...drafts };
        delete next[index];
        return next;
      }
      if (drafts[index] === dataUrl) return drafts;
      return { ...drafts, [index]: dataUrl };
    });
  };

  const updateClue = (index: number, clue: ClueContent, { persist = true }: { persist?: boolean } = {}) => {
    const next = [...clues];
    next[index] = clue;
    setClues(next);
    if (!locked && persist) useGameStore.getState().saveClues(next);
  };

  const handleLock = () => {
    if (submitting || clues.some((clue) => !clueHasContent(clue))) return;
    setDrawingDrafts((drafts) => {
      const next = { ...drafts };
      clues.forEach((clue, index) => {
        if (clue.kind === 'text') delete next[index];
      });
      return next;
    });
    setSubmitting(true);
    useGameStore.getState().submitClues(clues);
    setTimeout(() => setSubmitting(false), 5000);
  };

  const canLock = !submitting && clues.every(clueHasContent);
  const editingDrawing = drawingIndex !== null ? clues[drawingIndex] : undefined;

  const handleUnlock = () => {
    if (submitting) return;
    setSubmitting(true);
    useGameStore.getState().unlockClues();
    setTimeout(() => setSubmitting(false), 1200);
  };

  return (
    <div className="space-y-2 sm:space-y-4">
      <TeamClueStatus />
      <div className="glass-card space-y-3 rounded-2xl border border-amber-400/30 bg-amber-500/5 p-3 sm:space-y-4 sm:p-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/15 bg-black/15 px-3 py-2 sm:block sm:border-0 sm:bg-transparent sm:p-0 sm:text-center">
          <div className="text-[10px] tracking-[0.24em] text-amber-300 uppercase sm:mb-2 sm:tracking-[0.3em]">
            Your secret code
          </div>
          <div className="shrink-0 scale-90 sm:scale-100">
            <CodeDisplay code={privateState?.code} />
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3">
          {privateState?.code?.map((digit, index) => {
            const clue = clues[index] ?? createTextClue();
            const textMode = clue.kind === 'text';
            const savedDrawing = clue.kind === 'drawing' ? clue.dataUrl : (drawingDrafts[index] ?? '');
            return (
              <div
                key={`${digit}-${index}`}
                className="rounded-2xl border border-white/10 bg-black/15 p-2.5 sm:border-0 sm:bg-transparent sm:p-0"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-300/25 bg-amber-300/10 font-display text-sm text-amber-100">
                    {digit}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWordsHidden((hidden) => !hidden)}
                    className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-surface-raised px-2 py-1 text-left text-xs font-semibold text-white transition hover:bg-surface-hover active:scale-95 sm:max-w-[9rem] sm:border-0 sm:bg-transparent sm:px-1.5 sm:py-0.5 sm:text-right sm:font-normal sm:text-gray-500 sm:hover:bg-white/5 sm:hover:text-gray-200"
                    aria-label={wordsHidden ? 'Show keyword' : 'Hide keyword'}
                    title={wordsHidden ? 'Show keyword' : 'Hide keyword'}
                  >
                    {wordsHidden ? '••••••' : (privateState.keywords?.[digit - 1] ?? 'Keyword')}
                  </button>
                  <div className="grid w-[6.5rem] shrink-0 grid-cols-2 rounded-lg border border-white/10 bg-surface-raised p-0.5 sm:w-auto sm:flex sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0">
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        if (clue.kind === 'drawing') setDrawingDraft(index, clue.dataUrl);
                        updateClue(index, createTextClue(textMode ? clue.text : ''), { persist: !savedDrawing });
                      }}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold tracking-wider transition-all disabled:opacity-40 sm:rounded-xl sm:border sm:px-4 sm:py-2 sm:text-xs ${
                        textMode
                          ? 'bg-amber-400/15 text-amber-100 sm:border-amber-300/50 sm:bg-amber-400/10'
                          : 'text-gray-400 hover:text-gray-200 sm:border-white/10 sm:bg-surface-raised sm:text-gray-300 sm:hover:bg-surface-hover'
                      }`}
                    >
                      Text
                    </button>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        updateClue(index, { kind: 'drawing', dataUrl: savedDrawing });
                        setDrawingIndex(index);
                      }}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold tracking-wider transition-all disabled:opacity-40 sm:rounded-xl sm:border sm:px-4 sm:py-2 sm:text-xs ${
                        !textMode
                          ? 'bg-amber-400/15 text-amber-100 sm:border-amber-300/50 sm:bg-amber-400/10'
                          : 'text-gray-400 hover:text-gray-200 sm:border-white/10 sm:bg-surface-raised sm:text-gray-300 sm:hover:bg-surface-hover'
                      }`}
                    >
                      Draw
                    </button>
                  </div>
                </div>
                {textMode ? (
                  <input
                    value={clue.text}
                    onChange={(event) =>
                      updateClue(index, createTextClue(event.target.value), { persist: !drawingDrafts[index] })
                    }
                    maxLength={32}
                    disabled={locked}
                    className="game-input w-full rounded-xl px-3 py-2.5 text-base text-white placeholder-gray-600 disabled:opacity-50 sm:px-4 sm:py-3"
                    placeholder="One clue"
                  />
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2 sm:block">
                    <ClueView clue={clue} imageClassName="!h-14 sm:!h-20" className="min-w-0 flex-1" />
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => setDrawingIndex(index)}
                      className="min-h-14 w-20 shrink-0 rounded-lg border border-white/10 bg-surface-raised px-2 py-2 text-[10px] tracking-widest text-gray-300 uppercase hover:bg-surface-hover disabled:opacity-40 sm:mt-2 sm:min-h-0 sm:w-full sm:text-[11px]"
                    >
                      {clue.dataUrl ? 'Edit' : 'Open'}
                      <span className="hidden sm:inline"> Drawing Editor</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-center pt-1">
          <AnimatedLockButton
            locked={locked}
            onClick={locked ? handleUnlock : handleLock}
            disabled={locked ? submitting : !canLock}
            lockedLabel="Unlock clues"
            unlockedLabel="Lock clues"
          />
        </div>
      </div>
      {drawingIndex !== null && editingDrawing?.kind === 'drawing' && (
        <DrawingClueModal
          initialDataUrl={editingDrawing.dataUrl}
          onSave={(dataUrl) => {
            setDrawingDraft(drawingIndex, dataUrl);
            updateClue(drawingIndex, { kind: 'drawing', dataUrl });
            setDrawingIndex(null);
          }}
          onClose={() => setDrawingIndex(null)}
        />
      )}
    </div>
  );
}

function TeamClueStatus() {
  const room = useGameStore((s) => s.room)!;
  const turn = room.turn!;

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {(['red', 'blue'] as TeamId[]).map((team) => {
        const teamTurn = turn.teams[team];
        const style = TEAM_STYLES[team];
        const encryptor = room.players.find((p) => p.id === teamTurn.encryptorId);
        return (
          <div key={team} className={`min-w-0 rounded-2xl border ${style.border} ${style.bg} p-3 sm:p-4`}>
            <div className={`font-display text-base sm:text-lg tracking-wider ${style.text}`}>{style.label}</div>
            <div className="mt-1 truncate text-xs text-gray-400 sm:text-sm">{encryptor?.name ?? 'Unknown'}</div>
            <div
              className={`mt-2 text-[10px] tracking-widest uppercase sm:mt-3 sm:text-xs ${
                teamTurn.clueLocked ? 'text-emerald-300' : 'text-gray-500'
              }`}
            >
              {teamTurn.clueLocked ? 'Locked in' : 'Writing'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DrawingClueModal({
  initialDataUrl,
  onSave,
  onClose,
}: {
  initialDataUrl: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    if (!initialDataUrl) return;
    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = initialDataUrl;
  }, [initialDataUrl]);

  const pointForEvent = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const point = pointForEvent(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const point = pointForEvent(event);
    context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    context.strokeStyle = '#f8fafc';
    context.lineWidth = tool === 'eraser' ? 28 : 7;
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const save = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasInk = pixels.some((value, index) => index % 4 === 3 && value > 0);
    onSave(hasInk ? canvas.toDataURL('image/png') : '');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-4 flex items-center justify-center">
      <div className="w-full max-w-4xl glass-card rounded-2xl border border-white/10 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-2xl tracking-wider text-white">Draw clue</div>
            <div className="text-gray-500 text-xs mt-1">Sketch, erase, clear, then save.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTool('pen')}
              className={`px-3 py-2 rounded-xl border text-xs tracking-widest uppercase ${
                tool === 'pen'
                  ? 'border-amber-300/50 bg-amber-400/10 text-amber-100'
                  : 'border-white/10 bg-surface-raised text-gray-300'
              }`}
            >
              Pen
            </button>
            <button
              type="button"
              onClick={() => setTool('eraser')}
              className={`px-3 py-2 rounded-xl border text-xs tracking-widest uppercase ${
                tool === 'eraser'
                  ? 'border-amber-300/50 bg-amber-400/10 text-amber-100'
                  : 'border-white/10 bg-surface-raised text-gray-300'
              }`}
            >
              Eraser
            </button>
            <button
              type="button"
              onClick={clear}
              className="px-3 py-2 rounded-xl bg-surface-raised border border-white/10 text-gray-300 text-xs tracking-widest uppercase"
            >
              Clear
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={720}
          height={420}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          className="w-full aspect-[12/7] rounded-2xl bg-black/35 border border-white/10 touch-none cursor-crosshair"
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="py-3 rounded-xl bg-surface-raised hover:bg-surface-hover border border-white/10 text-gray-300 font-display tracking-wider"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="btn-success py-3 rounded-xl text-white font-display tracking-wider"
          >
            Save Drawing
          </button>
        </div>
      </div>
    </div>
  );
}

function GuessPhase() {
  const room = useGameStore((s) => s.room)!;
  const privateState = useGameStore((s) => s.privateState);
  const turn = room.turn!;
  const myTeam = privateState?.team;
  const activeTeam = turn.activeGuessTeam;
  const playerId = useGameStore((s) => s.playerId);
  const [showOtherTeamClues, setShowOtherTeamClues] = useState(false);

  useEffect(() => {
    setShowOtherTeamClues(false);
  }, [activeTeam, myTeam, turn.round]);

  if (!myTeam) return <StatusPanel text="You joined mid-game and are spectating until the next lobby." />;

  if (!activeTeam) {
    const myTurn = turn.teams[myTeam];
    const isEncryptor = myTurn.encryptorId === playerId;
    const opponentTeam = otherTeam(myTeam);
    const opponentStyle = TEAM_STYLES[opponentTeam];
    return (
      <div className="space-y-4">
        <div className={`grid grid-cols-1 ${showOtherTeamClues ? 'sm:grid-cols-2' : ''} gap-4`}>
          <CluesInOrder
            team={myTeam}
            teamTurn={turn.teams[myTeam]}
            action={
              !showOtherTeamClues ? (
                <button
                  type="button"
                  onClick={() => setShowOtherTeamClues(true)}
                  className={`hidden sm:inline-flex px-3 py-2 rounded-xl border ${opponentStyle.border} ${opponentStyle.bg} ${opponentStyle.text} text-xs font-semibold tracking-wider transition-all active:scale-[0.97]`}
                >
                  Show other team's clues
                </button>
              ) : undefined
            }
          />
          {showOtherTeamClues && (
            <CluesInOrder
              team={opponentTeam}
              teamTurn={turn.teams[opponentTeam]}
              className="hidden sm:block"
              action={
                <button
                  type="button"
                  onClick={() => setShowOtherTeamClues(false)}
                  className="px-3 py-2 rounded-xl bg-surface-raised hover:bg-surface-hover border border-white/10 text-gray-300 text-xs font-semibold tracking-wider transition-all active:scale-[0.97]"
                >
                  Hide
                </button>
              }
            />
          )}
        </div>
        {isEncryptor ? (
          <StatusPanel text="Your teammates are decrypting. The encryptor cannot submit the team guess." />
        ) : (
          <GuessPanel
            team={myTeam}
            kind="decrypt"
            title="Decrypt your team's code"
            description="Round 1 has no interception attempt. Decode your own team's clues."
            disabled={myTurn.guesses.decryptSubmitted}
            submittedText="Your team submitted its decryption."
          />
        )}
      </div>
    );
  }

  const activeTurn = turn.teams[activeTeam];
  const isActiveTeam = myTeam === activeTeam;
  const isOpponent = myTeam === otherTeam(activeTeam);
  const isEncryptor = activeTurn.encryptorId === playerId;

  return (
    <div className="space-y-4">
      <CluesInOrder team={activeTeam} teamTurn={activeTurn} />

      {isActiveTeam && !isEncryptor && (
        <GuessPanel
          team={activeTeam}
          kind="decrypt"
          title="Decrypt your team's code"
          description="Use the clues to choose the 3 keyword numbers in order."
          disabled={activeTurn.guesses.decryptSubmitted}
          submittedText="Your team submitted its decryption."
        />
      )}

      {isActiveTeam && isEncryptor && (
        <StatusPanel text="Your teammates are decrypting. The encryptor cannot submit the team guess." />
      )}

      {isOpponent && (
        <GuessPanel
          team={activeTeam}
          kind="intercept"
          title={`Intercept ${TEAM_STYLES[activeTeam].label}'s code`}
          description="Guess the same 3-digit sequence before the transmitting team reveals it."
          disabled={activeTurn.guesses.interceptSubmitted}
          submittedText="Your team submitted its intercept."
        />
      )}
    </div>
  );
}

function CluesInOrder({
  team,
  teamTurn,
  action,
  className = '',
}: {
  team: TeamId;
  teamTurn: PublicTeamTurnState;
  action?: ReactNode;
  className?: string;
}) {
  const style = TEAM_STYLES[team];
  const room = useGameStore((s) => s.room)!;
  const encryptor = room.players.find((p) => p.id === teamTurn.encryptorId);

  return (
    <div className={`glass-card rounded-2xl border ${style.border} p-3 sm:p-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3 sm:gap-3">
        <div className="min-w-0">
          <div className="text-gray-500 text-[9px] tracking-[0.24em] uppercase sm:text-[10px] sm:tracking-[0.3em]">
            Clues in order <span className="sm:hidden">→</span>
            <span className="hidden sm:inline">→</span>
          </div>
          <div className={`truncate font-display text-base tracking-wider sm:text-lg ${style.text}`}>
            {style.label} by {encryptor?.name ?? 'Unknown'}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {action}
          <TeamBadge team={team} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {teamTurn.clues.map((clue, index) => (
          <div
            key={`${clueListLabel([clue])}-${index}`}
            className="min-h-[4.75rem] rounded-xl border border-white/10 bg-black/20 p-2 sm:min-h-[5rem] sm:p-3"
          >
            <ClueView
              clue={clue}
              className="text-xs leading-snug sm:text-base"
              imageClassName="!h-12 sm:!h-24"
              previewTitle={`${possessiveName(encryptor?.name ?? 'Unknown')} round ${teamTurn.round} drawing clue`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function GuessPanel({
  team,
  kind,
  title,
  description,
  disabled,
  submittedText,
}: {
  team: TeamId;
  kind: GuessKind;
  title: string;
  description: string;
  disabled: boolean;
  submittedText: string;
}) {
  const [code, setCode] = useState<CodeDigit[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showTeamGuesses, setShowTeamGuesses] = useState(false);
  const privateState = useGameStore((s) => s.privateState);
  const canSubmit = code.length === 3 && !disabled && !submitting;
  const canPost = code.length === 3 && !disabled && !posting;
  const selected = useMemo(() => new Set(code), [code]);
  const postedGuesses = (privateState?.guessShares ?? []).filter(
    (share) => share.targetTeam === team && share.kind === kind,
  );

  if (disabled) return <StatusPanel text={submittedText} />;

  return (
    <div className="glass-card rounded-2xl border border-white/10 p-4 space-y-4">
      <div>
        <div className="font-display text-xl tracking-wider text-white">{title}</div>
        <div className="text-gray-400 text-sm mt-1">{description}</div>
      </div>

      <div className="flex justify-center gap-2">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="code-chip w-14 h-14 rounded-2xl flex items-center justify-center font-display text-2xl text-white"
          >
            {code[index] ?? '?'}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {CODE_DIGITS.map((digit) => (
          <button
            key={digit}
            onClick={() => {
              if (selected.has(digit) || code.length >= 3) return;
              setCode([...code, digit]);
            }}
            disabled={selected.has(digit) || code.length >= 3}
            className="py-3 rounded-xl bg-surface-raised hover:bg-surface-hover border border-white/10 text-white font-display text-xl disabled:opacity-30 active:scale-[0.97] transition-all"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCode(code.slice(0, -1))}
          disabled={code.length === 0 || submitting}
          className="flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-surface-raised text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all hover:bg-surface-hover hover:text-white active:scale-[0.97] disabled:opacity-30"
          aria-label="Delete last digit"
          title="Delete last digit"
        >
          <BackspaceIcon />
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/15 p-3">
        <button
          type="button"
          onClick={() => setShowTeamGuesses((value) => !value)}
          disabled={postedGuesses.length === 0}
          className="w-full flex items-center justify-between gap-3 text-left text-xs tracking-widest uppercase text-gray-400 disabled:opacity-40"
        >
          <span>Team posted guesses</span>
          <span>{showTeamGuesses ? 'Hide' : `Show (${postedGuesses.length})`}</span>
        </button>
        {showTeamGuesses && (
          <div className="mt-3 space-y-2">
            {postedGuesses.map((share) => (
              <div
                key={`${share.round}-${share.playerId}-${share.kind}-${share.updatedAt}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-black/20 border border-white/10 px-3 py-2"
              >
                <span className="text-gray-300 text-sm truncate">{share.playerName}</span>
                <span className="font-display text-white tracking-wider">{formatCode(share.code)}</span>
              </div>
            ))}
            {postedGuesses.length === 0 && (
              <div className="text-gray-600 text-sm text-center py-2">No guesses posted.</div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            if (!canPost) return;
            setPosting(true);
            useGameStore.getState().postGuessShare({ team, kind, code: code as Code });
            setTimeout(() => setPosting(false), 1500);
          }}
          disabled={!canPost}
          className="py-3 rounded-xl bg-surface-raised hover:bg-surface-hover border border-white/10 text-gray-200 font-display tracking-wider disabled:opacity-30 active:scale-[0.97] transition-all"
        >
          {posting ? 'Posted' : 'Post'}
        </button>
        <button
          onClick={() => {
            if (!canSubmit) return;
            setSubmitting(true);
            useGameStore.getState().submitGuess({ team, kind, code: code as Code });
            setTimeout(() => setSubmitting(false), 5000);
          }}
          disabled={!canSubmit}
          className="btn-success py-3 rounded-xl text-white font-display tracking-wider disabled:opacity-30 disabled:shadow-none active:scale-[0.97] transition-all"
        >
          {submitting ? 'Submitting...' : 'Submit Final'}
        </button>
      </div>
    </div>
  );
}

function BackspaceIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-7" fill="currentColor">
      <path d="M9.25 5.25h10.5A2.25 2.25 0 0 1 22 7.5v9a2.25 2.25 0 0 1-2.25 2.25H9.25c-.72 0-1.39-.34-1.82-.92L2.48 13.1a1.75 1.75 0 0 1 0-2.2l4.95-4.73c.43-.58 1.1-.92 1.82-.92Zm4.08 4.02a.9.9 0 0 0-1.27 1.27L13.52 12l-1.46 1.46a.9.9 0 1 0 1.27 1.27l1.46-1.46 1.46 1.46a.9.9 0 0 0 1.27-1.27L16.06 12l1.46-1.46a.9.9 0 0 0-1.27-1.27l-1.46 1.46-1.46-1.46Z" />
    </svg>
  );
}

function StatusPanel({ text }: { text: string }) {
  return (
    <div className="glass-card rounded-2xl border border-white/10 p-5 text-center">
      <div className="text-gray-400 font-semibold">{text}</div>
    </div>
  );
}

function HistoryPanel() {
  const history = useGameStore((s) => s.room?.clueHistory ?? []);
  return <SignalHistory history={history} limit={6} sticky />;
}
