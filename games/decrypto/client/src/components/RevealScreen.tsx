import { useState } from 'react';
import { ConfirmModal } from '@games/client-core';
import type { PublicClinchedOutcome, RevealState, TeamId } from '@games/decrypto-shared';
import { useGameStore } from '../store';
import {
  ClueBank,
  ClueView,
  ScoreStrip,
  SignalHistory,
  TEAM_STYLES,
  TeamBadge,
  clueListLabel,
  formatCode,
  otherTeam,
  possessiveName,
} from './shared';
import GameHeader from './GameHeader';

export default function RevealScreen() {
  const room = useGameStore((s) => s.room);
  const privateState = useGameStore((s) => s.privateState);
  const playerId = useGameStore((s) => s.playerId);
  const reveals = room?.reveals ?? [];
  const clinchedOutcome = room?.clinchedOutcome;
  const [continuing, setContinuing] = useState(false);
  const [takingWin, setTakingWin] = useState(false);
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null);

  if (!room || reveals.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 font-display tracking-wider">
        Loading reveal...
      </div>
    );
  }

  const handleContinue = () => {
    if (continuing || takingWin) return;
    setContinuing(true);
    useGameStore.getState().continueGame();
    setTimeout(() => setContinuing(false), 5000);
  };

  const handleTakeWin = () => {
    if (continuing || takingWin) return;
    setTakingWin(true);
    useGameStore.getState().takeWin();
    setTimeout(() => setTakingWin(false), 5000);
  };
  const isHost = room.hostId === playerId;
  const kickTarget = confirmKickId ? room.players.find((player) => player.id === confirmKickId) : undefined;

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <GameHeader roundLabel={`R${reveals[0].round}`} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full w-full max-w-4xl mx-auto flex-col gap-5 px-5 pt-5 pb-0">
          <div className="text-center">
            <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-2">Transmission revealed</div>
            <div className="font-display text-4xl tracking-wider text-white">
              Round {reveals[0].round} results
            </div>
          </div>

          <ScoreStrip
            scores={room.scores}
            players={room.players}
            currentPlayerId={playerId}
            onKickPlayer={isHost ? setConfirmKickId : undefined}
            showOfflineStatus={room.settings.offlineAwareness}
          />

          {clinchedOutcome && <ClinchedWinPanel outcome={clinchedOutcome} />}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {reveals.map((reveal) => (
              <RevealCard key={`${reveal.round}-${reveal.team}`} reveal={reveal} />
            ))}
          </div>

          <ClueBank
            myTeam={privateState?.team}
            keywords={privateState?.keywords}
            history={room.clueHistory}
            compactMobile
          />
          <SignalHistory history={room.clueHistory} limit={6} />

          <div className="sticky bottom-0 z-30 -mx-5 mt-auto border-t border-white/10 bg-surface/85 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-20px_50px_rgba(0,0,0,0.38)] backdrop-blur-xl">
            {clinchedOutcome ? (
              <ClinchedActionBar
                outcome={clinchedOutcome}
                myTeam={privateState?.team}
                continuing={continuing}
                takingWin={takingWin}
                onContinue={handleContinue}
                onTakeWin={handleTakeWin}
              />
            ) : (
              <button
                onClick={handleContinue}
                disabled={continuing}
                className="btn-decrypto w-full py-4 rounded-2xl text-white font-display text-lg tracking-wider active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {continuing ? 'Continuing...' : 'Continue'}
              </button>
            )}
          </div>
        </div>
      </div>
      {confirmKickId && (
        <ConfirmModal
          title={`Kick ${kickTarget?.name ?? 'player'}?`}
          message="They will be removed from the game."
          confirmLabel="Kick"
          cancelLabel="Cancel"
          confirmClass="bg-gradient-to-br from-red-600 to-red-500 text-white shadow-[0_0_18px_rgba(239,68,68,0.26)] hover:from-red-500 hover:to-red-400"
          onConfirm={() => {
            if (confirmKickId) useGameStore.getState().kickPlayer(confirmKickId);
            setConfirmKickId(null);
          }}
          onCancel={() => setConfirmKickId(null)}
        />
      )}
    </div>
  );
}

function ClinchedWinPanel({ outcome }: { outcome: PublicClinchedOutcome }) {
  const winnerStyle = TEAM_STYLES[outcome.winner];
  const pendingStyle = TEAM_STYLES[outcome.pendingTeam];
  return (
    <div className={`glass-card rounded-2xl border ${winnerStyle.border} ${winnerStyle.bg} p-4`}>
      <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-1">Win clinched</div>
      <div className={`font-display text-2xl tracking-wider ${winnerStyle.text}`}>
        {winnerStyle.label} can take the win
      </div>
      <div className="mt-2 text-sm text-gray-300">
        The remaining {pendingStyle.label} transmission cannot change the winner. Take the win now, or play it out for
        fun.
      </div>
    </div>
  );
}

function ClinchedActionBar({
  outcome,
  myTeam,
  continuing,
  takingWin,
  onContinue,
  onTakeWin,
}: {
  outcome: PublicClinchedOutcome;
  myTeam?: TeamId;
  continuing: boolean;
  takingWin: boolean;
  onContinue: () => void;
  onTakeWin: () => void;
}) {
  const canChoose = myTeam === outcome.winner;
  const winnerStyle = TEAM_STYLES[outcome.winner];
  if (!canChoose) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-center text-sm text-gray-400">
        Waiting for {winnerStyle.label} to take the win or play the extra turn for fun.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onContinue}
        disabled={continuing || takingWin}
        className="rounded-2xl border border-white/10 bg-surface-raised py-4 font-display text-sm tracking-wider text-gray-200 transition-all hover:bg-surface-hover active:scale-[0.97] disabled:opacity-50 sm:text-base"
      >
        {continuing ? 'Starting...' : 'Play for Fun'}
      </button>
      <button
        type="button"
        onClick={onTakeWin}
        disabled={continuing || takingWin}
        className="btn-decrypto rounded-2xl py-4 font-display text-sm tracking-wider text-white transition-all active:scale-[0.97] disabled:opacity-50 sm:text-base"
      >
        {takingWin ? 'Ending...' : 'Take Win'}
      </button>
    </div>
  );
}

function RevealCard({ reveal }: { reveal: RevealState }) {
  const teamStyle = TEAM_STYLES[reveal.team];
  const opponent = otherTeam(reveal.team);
  const opponentStyle = TEAM_STYLES[opponent];

  return (
    <div className={`glass-card rounded-2xl border ${teamStyle.border} p-3 space-y-3 sm:p-5 sm:space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className={`font-display text-xl tracking-wider sm:text-2xl ${teamStyle.text}`}>{teamStyle.label}</div>
          <div className="truncate text-xs text-gray-400 sm:text-sm">
            Clues by <span className="text-white">{reveal.encryptorName}</span>
          </div>
        </div>
        <TeamBadge team={reveal.team} />
      </div>

      <div>
        <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase mb-2">Correct code</div>
        <div className="flex gap-1.5 sm:gap-2">
          {reveal.code.map((digit, index) => (
            <div
              key={`${digit}-${index}`}
              className={`code-chip flex h-11 w-11 items-center justify-center rounded-xl font-display text-xl sm:h-14 sm:w-14 sm:rounded-2xl sm:text-2xl ${teamStyle.text}`}
            >
              {digit}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {reveal.clues.map((clue, index) => (
          <div
            key={`${clueListLabel([clue])}-${index}`}
            className={`min-h-[4.75rem] rounded-xl border ${teamStyle.border} bg-black/15 p-2 sm:min-h-[6rem] sm:p-3`}
          >
            <div className={`font-display text-base sm:text-xl ${teamStyle.text}`}>#{reveal.code[index]}</div>
            <ClueView
              clue={clue}
              className="mt-1 text-xs leading-snug sm:text-base"
              imageClassName="!h-12 sm:!h-20"
              previewTitle={`${possessiveName(reveal.encryptorName)} round ${reveal.round} drawing clue`}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        <ResultCard
          title={`${teamStyle.label} decrypted`}
          code={formatCode(reveal.decryptGuess)}
          correct={reveal.decryptCorrect}
          successText="Message received"
          failureText={`+1 miscommunication for ${teamStyle.label}`}
          neutralSuccess
        />
        <ResultCard
          title={`${opponentStyle.label} intercepted`}
          code={reveal.interceptGuess ? formatCode(reveal.interceptGuess) : 'Skipped'}
          correct={reveal.interceptCorrect}
          successText={`+1 intercept for ${opponentStyle.label}`}
          failureText={reveal.interceptGuess ? 'Intercept missed' : 'No intercept in round 1'}
          neutralFailure
        />
      </div>
    </div>
  );
}

function ResultCard({
  title,
  code,
  correct,
  successText,
  failureText,
  neutralFailure = false,
  neutralSuccess = false,
}: {
  title: string;
  code: string;
  correct: boolean;
  successText: string;
  failureText: string;
  neutralFailure?: boolean;
  neutralSuccess?: boolean;
}) {
  const neutral = (correct && neutralSuccess) || (!correct && neutralFailure);
  return (
    <div
      className={`glass-card rounded-2xl border p-3 sm:p-4 ${
        correct && !neutralSuccess
          ? 'border-emerald-400/40 bg-emerald-900/10'
          : neutral
            ? 'border-white/10 bg-black/10'
            : 'border-rose-500/30 bg-rose-950/10'
      }`}
    >
      <div className="mb-1.5 text-[9px] tracking-[0.22em] text-gray-500 uppercase sm:mb-2 sm:text-[10px] sm:tracking-[0.3em]">
        {title}
      </div>
      <div className="font-display text-2xl tracking-wider text-white sm:text-3xl">{code}</div>
      <div
        className={`mt-1.5 text-xs sm:mt-2 sm:text-sm ${
          correct && !neutralSuccess ? 'text-emerald-300' : neutral ? 'text-gray-400' : 'text-rose-300'
        }`}
      >
        {correct ? successText : failureText}
      </div>
    </div>
  );
}
