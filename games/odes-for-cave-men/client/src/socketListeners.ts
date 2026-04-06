import { socket, autoReconnecting, clearAutoReconnecting } from './socket';
import { useGameStore, initialState, SESSION_KEY } from './store';
import type { ReviewCard } from './store';
import { clientLogger } from '@games/client-core';
import type { WordCard, TeamId } from '@games/odes-for-cave-men-shared';

function toReviewCards(cards: WordCard[]): ReviewCard[] {
  return cards.map((c) => ({ ...c, originalPoints: c.points }));
}

function saveSession() {
  const { roomCode, playerId, playerName } = useGameStore.getState();
  if (roomCode && playerId) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerId, playerName }));
  }
}

// Connection
socket.on('connect', () => {
  useGameStore.setState({ connected: true });
});
socket.on('disconnect', () => {
  useGameStore.setState({ connected: false });
});

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Session takeover
socket.on('session:taken-over', () => {
  socket.disconnect();
  clearSession();
  useGameStore.setState({
    ...initialState,
    kickReason: "Someone else joined with your name. You've been disconnected from the room.",
  });
  window.history.replaceState(null, '', '/');
});

// Kicked by host
socket.on('room:kicked', () => {
  socket.disconnect();
  clearSession();
  useGameStore.setState({
    ...initialState,
    kickReason: 'You were kicked from the room by the host.',
  });
  window.history.replaceState(null, '', '/');
});

// Room lifecycle
socket.on('room:created', ({ roomCode, playerId, room }) => {
  useGameStore.setState({
    roomCode,
    playerId,
    hostId: room.hostId,
    players: room.players,
    settings: room.settings,
    teamNames: room.teamNames ?? { A: 'Team A', B: 'Team B' },
    phase: 'LOBBY',
  });
  saveSession();
  window.history.replaceState(null, '', `/${roomCode}`);
});

socket.on('room:joined', ({ roomCode, playerId, room }) => {
  useGameStore.setState({
    roomCode,
    playerId,
    hostId: room.hostId,
    players: room.players,
    settings: room.settings,
    teamNames: room.teamNames ?? { A: 'Team A', B: 'Team B' },
    phase: room.phase || 'LOBBY',
  });
  saveSession();
  window.history.replaceState(null, '', `/${roomCode}`);
});

socket.on('room:rejoined', ({ roomCode, playerId, room, game }) => {
  clearAutoReconnecting();
  const update: Record<string, unknown> = {
    roomCode,
    playerId,
    hostId: room.hostId,
    players: room.players,
    settings: room.settings,
    teamNames: room.teamNames ?? { A: 'Team A', B: 'Team B' },
    phase: room.phase || 'LOBBY',
  };
  if (game) {
    update.phase = game.phase;
    update.round = game.round;
    update.scores = game.scores;
    update.timerEnd = game.timerEnd;
    update.cluerId = game.cluerId;
    update.playingTeam = game.playingTeam;
    if (game.roundHistory) update.roundHistory = game.roundHistory;

    const me = room.players.find((p: { id: string }) => p.id === playerId);
    const myTeam = me?.team as TeamId | null;

    if (game.phase === 'READY') {
      // Find the cluer's name
      const cluer = room.players.find((p: { id: string }) => p.id === game.cluerId);
      update.cluerName = cluer?.name ?? null;
      update.role = null;
    } else if (game.phase === 'PLAYING' && myTeam) {
      if (myTeam === game.playingTeam) {
        update.role = playerId === game.cluerId ? 'cluer' : 'guesser';
      } else {
        update.role = 'opponent';
      }
      // Cluer and opponents see the word, guessers don't
      if (playerId === game.cluerId || myTeam !== game.playingTeam) {
        const currentWord = game.words?.[game.currentWordIndex];
        update.currentWord = currentWord ? { word1: currentWord.word1, word3: currentWord.word3 } : null;
      } else {
        update.currentWord = null;
      }
      update.wordsResolved = game.currentWordIndex;
    } else if (game.phase === 'REVIEW') {
      const resolved = game.words?.filter((w: { result: string | null }) => w.result !== null) ?? [];
      update.reviewCards = toReviewCards(resolved);
      update.role = playerId === game.cluerId ? 'cluer' : null;
    }
  }
  useGameStore.setState(update);
  saveSession();
  window.history.replaceState(null, '', `/${roomCode}`);
});

// Player updates
socket.on('room:player-joined', ({ player }) => {
  useGameStore.setState((s) => ({ players: [...s.players, player] }));
});
socket.on('room:player-left', ({ hostId, players }) => {
  useGameStore.setState({ players, hostId });
});
socket.on('room:player-disconnected', ({ playerId: pid }) => {
  useGameStore.setState((s) => ({
    players: s.players.map((p) => (p.id === pid ? { ...p, connected: false } : p)),
  }));
});
socket.on('room:player-reconnected', ({ playerId: pid }) => {
  useGameStore.setState((s) => ({
    players: s.players.map((p) => (p.id === pid ? { ...p, connected: true } : p)),
  }));
});
socket.on('room:host-updated', ({ hostId }) => {
  useGameStore.setState({ hostId });
});

// Lobby
socket.on('team:updated', ({ players }) => {
  useGameStore.setState({ players });
});
socket.on('team-names:updated', ({ teamNames }) => {
  useGameStore.setState({ teamNames });
});
socket.on('settings:updated', ({ settings }) => {
  useGameStore.setState({ settings });
});
socket.on('room:error', ({ message }) => {
  if (autoReconnecting.current) {
    clearAutoReconnecting();
    if (message === 'Room not found') {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
  }
  clientLogger.error('room', 'Room error', { message });
  useGameStore.getState().setError(message);
});

// Turn ready — cluer chosen, waiting for them to start
socket.on('turn:ready', ({ cluerId, cluerName, playingTeam, scores, round, roundHistory }) => {
  useGameStore.setState({
    phase: 'READY',
    cluerId,
    cluerName,
    playingTeam,
    scores,
    roundHistory: roundHistory ?? [],
    round,
    role: null,
    currentWord: null,
    timerEnd: null,
    wordsResolved: 0,
    reviewCards: [],
    bonkFlash: false,
  });
});

// Cluer changed during READY phase
socket.on('turn:cluer-changed', ({ cluerId, cluerName }) => {
  useGameStore.setState({ cluerId, cluerName });
});

// Turn started — role-specific payload
socket.on('turn:started', ({ role, word, timerEnd, cluerId, playingTeam }) => {
  useGameStore.setState({
    phase: 'PLAYING',
    role,
    currentWord: word,
    timerEnd,
    cluerId,
    playingTeam,
    wordsResolved: 0,
    bonkFlash: false,
  });
});

// Word resolved
socket.on('word:resolved', ({ scores }) => {
  useGameStore.setState((s) => ({
    scores,
    wordsResolved: s.wordsResolved + 1,
    currentWord: s.role === 'guesser' ? null : s.currentWord,
  }));
});

// Next word (cluer and opponents get this)
socket.on('word:next', ({ word }) => {
  useGameStore.setState({ currentWord: word });
});

// Bonk flash (only cluer receives this)
socket.on('bonk:flash', () => {
  useGameStore.setState({ bonkFlash: true });
  setTimeout(() => useGameStore.setState({ bonkFlash: false }), 600);
});

// Turn ended, enter review
socket.on('turn:review', ({ cards, scores, cluerId, playingTeam }) => {
  const myId = useGameStore.getState().playerId;
  useGameStore.setState({
    phase: 'REVIEW',
    reviewCards: toReviewCards(cards),
    scores,
    cluerId,
    playingTeam,
    role: myId === cluerId ? 'cluer' : null,
    timerEnd: null,
    currentWord: null,
    bonkFlash: false,
  });
});

// Review card updated
socket.on('review:updated', ({ index, points, scores }) => {
  useGameStore.setState((s) => {
    const reviewCards = [...s.reviewCards];
    if (reviewCards[index]) {
      reviewCards[index] = { ...reviewCards[index], points };
    }
    return { reviewCards, scores };
  });
});

// Round ended / game over
socket.on('round:ended', ({ phase, scores, round, roundHistory }) => {
  useGameStore.setState({
    phase,
    scores,
    round,
    roundHistory: roundHistory ?? [],
    timerEnd: null,
    role: null,
    currentWord: null,
    cluerId: null,
    cluerName: null,
    reviewCards: [],
  });
});

// Game reset
socket.on('game:reset', ({ room }) => {
  useGameStore.setState({
    ...initialState,
    connected: true,
    playerId: useGameStore.getState().playerId,
    playerName: useGameStore.getState().playerName,
    roomCode: room.code,
    hostId: room.hostId,
    players: room.players,
    settings: room.settings,
    teamNames: room.teamNames ?? { A: 'Team A', B: 'Team B' },
    phase: 'LOBBY',
  });
});
