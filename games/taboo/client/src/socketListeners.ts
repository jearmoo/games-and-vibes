import { socket, autoReconnecting, clearAutoReconnecting } from './socket';
import { useGameStore, initialState, SESSION_KEY } from './store';

function saveSession() {
  const { roomCode, playerId, playerName } = useGameStore.getState();
  if (roomCode && playerId) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerId, playerName }));
  }
}

// Connection
socket.on('connect', () => { useGameStore.setState({ connected: true }); });
socket.on('disconnect', () => { useGameStore.setState({ connected: false }); });

// Room lifecycle
socket.on('room:created', ({ roomCode, playerId, room }) => {
  useGameStore.setState({
    roomCode, playerId, hostId: room.hostId,
    players: room.players, settings: room.settings,
    tabooMasters: room.tabooMasters, phase: 'LOBBY',
  });
  saveSession();
  window.history.replaceState(null, '', `/${roomCode}`);
});

socket.on('room:joined', ({ roomCode, playerId, room }) => {
  useGameStore.setState({
    roomCode, playerId, hostId: room.hostId,
    players: room.players, settings: room.settings,
    tabooMasters: room.tabooMasters, phase: room.phase || 'LOBBY',
  });
  saveSession();
  window.history.replaceState(null, '', `/${roomCode}`);
});

socket.on('room:rejoined', ({ roomCode, playerId, room, game }) => {
  clearAutoReconnecting();
  const update: Record<string, unknown> = {
    roomCode, playerId, hostId: room.hostId,
    players: room.players, settings: room.settings,
    tabooMasters: room.tabooMasters, phase: room.phase || 'LOBBY',
  };
  if (game) {
    update.phase = game.phase;
    update.round = game.round;
    update.scores = game.scores;
    update.timerEnd = game.timerEnd;
    update.turnResults = game.turnResults;
    if (game.roundHistory) update.roundHistory = game.roundHistory;

    const me = room.players.find((p: { id: string; team: string | null }) => p.id === playerId);
    const myTeam = me?.team as 'A' | 'B' | null;

    if (myTeam && game.phase === 'PARALLEL_SETUP') {
      const opposingTeam = myTeam === 'A' ? 'B' : 'A';
      const challengeForOpposing = game.challenges[opposingTeam];
      const challengeForMyTeam = game.challenges[myTeam];

      update.challengeCards = challengeForOpposing.cards.map((c: { word: string; result: string | null }) => ({ word: c.word, result: c.result }));
      update.tabooSuggestions = challengeForOpposing.tabooSuggestions;
      update.ownClueGiverId = challengeForMyTeam.clueGiverId;
      update.setupStatus = {
        A: {
          ready: game.challenges.A.ready,
          tabooCount: game.challenges.A.tabooSuggestions.length,
          hasClueGiver: !!game.challenges.A.clueGiverId,
        },
        B: {
          ready: game.challenges.B.ready,
          tabooCount: game.challenges.B.tabooSuggestions.length,
          hasClueGiver: !!game.challenges.B.clueGiverId,
        },
      };
    }

    if (myTeam && (game.phase === 'CLUING_A' || game.phase === 'CLUING_B')) {
      const cluingTeam = game.phase === 'CLUING_A' ? 'A' : 'B';
      const challenge = game.challenges[cluingTeam];
      update.cluingTeam = cluingTeam;
      update.activeCluingClueGiverId = challenge.clueGiverId;
      update.tabooBuzzes = challenge.tabooBuzzes;

      if (myTeam === cluingTeam) {
        const isClueGiver = playerId === challenge.clueGiverId;
        update.cards = challenge.cards.map((c: { word: string; result: string | null }) => ({
          word: isClueGiver ? c.word : '???',
          result: c.result,
        }));
        update.tabooWords = [];
      } else {
        update.cards = challenge.cards.map((c: { word: string; result: string | null }) => ({ word: c.word, result: c.result }));
        update.tabooWords = challenge.tabooWords;
      }
    }
  }
  useGameStore.setState(update);
  saveSession();
  window.history.replaceState(null, '', `/${roomCode}`);
});

// Player updates
socket.on('room:player-joined', ({ player }) => {
  useGameStore.setState(s => ({ players: [...s.players, player] }));
});
socket.on('room:player-left', ({ hostId, players }) => {
  useGameStore.setState({ players, hostId });
});
socket.on('room:player-disconnected', ({ playerId: pid }) => {
  useGameStore.setState(s => ({
    players: s.players.map(p => p.id === pid ? { ...p, connected: false } : p),
  }));
});
socket.on('room:player-reconnected', ({ playerId: pid }) => {
  useGameStore.setState(s => ({
    players: s.players.map(p => p.id === pid ? { ...p, connected: true } : p),
  }));
});
socket.on('room:host-updated', ({ hostId }) => {
  useGameStore.setState({ hostId });
});

// Lobby
socket.on('team:updated', ({ players }) => { useGameStore.setState({ players }); });
socket.on('settings:updated', ({ settings }) => { useGameStore.setState({ settings }); });
socket.on('taboo-master:updated', ({ tabooMasters }) => { useGameStore.setState({ tabooMasters }); });
socket.on('room:error', ({ message }) => {
  if (autoReconnecting.current) {
    clearAutoReconnecting();
    if (message === 'Room not found') {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
  }
  console.error('Room error:', message);
  useGameStore.getState().setError(message);
});

// --- Parallel Setup ---
socket.on('setup:started', ({ phase, round, scores, challengeCards, tabooMasters }) => {
  useGameStore.setState({
    phase, round, scores, tabooMasters,
    challengeCards,
    tabooSuggestions: [],
    ownClueGiverId: null,
    setupStatus: { A: { ready: false, tabooCount: 0, hasClueGiver: false }, B: { ready: false, tabooCount: 0, hasClueGiver: false } },
    cards: [], tabooWords: [], tabooBuzzes: {},
    timerEnd: null, cluingTeam: null, activeCluingClueGiverId: null,
    turnResults: { A: null, B: null },
  });
});

socket.on('setup:status', (status) => {
  useGameStore.setState({ setupStatus: status });
});

socket.on('setup:clue-giver-set', ({ team, clueGiverId }) => {
  const me = useGameStore.getState();
  const myTeam = me.players.find(p => p.id === me.playerId)?.team;
  if (myTeam === team) {
    useGameStore.setState({ ownClueGiverId: clueGiverId });
  }
});

socket.on('setup:taboo-updated', ({ words }) => {
  useGameStore.setState({ tabooSuggestions: words });
});

socket.on('setup:cards-updated', ({ cards }) => {
  useGameStore.setState({ challengeCards: cards });
});

// --- Cluing ---
socket.on('clue:start', ({ clueGiverId, timerEnd, phase, team, cards, tabooWords, tabooBuzzes }) => {
  useGameStore.setState({ activeCluingClueGiverId: clueGiverId, timerEnd, phase, cluingTeam: team, cards, tabooWords, tabooBuzzes });
});

socket.on('clue:timer-started', ({ timerEnd }) => {
  useGameStore.setState({ timerEnd });
});

socket.on('clue:card-resolved', ({ cardIndex, word, result, scores }) => {
  useGameStore.setState(s => {
    const newCards = [...s.cards];
    newCards[cardIndex] = { word, result };
    return { cards: newCards, scores };
  });
});

socket.on('clue:card-undone', ({ cardIndex, scores }) => {
  useGameStore.setState(s => {
    const newCards = [...s.cards];
    if (newCards[cardIndex]) newCards[cardIndex] = { ...newCards[cardIndex], result: null };
    return { cards: newCards, scores };
  });
});

socket.on('taboo:buzzed', ({ scores, tabooBuzzes }) => {
  useGameStore.setState({ scores, tabooBuzzes });
});
socket.on('taboo:unbuzzed', ({ scores, tabooBuzzes }) => {
  useGameStore.setState({ scores, tabooBuzzes });
});

// --- Transitions ---
socket.on('turn:transition', ({ phase, turnScore, scores }) => {
  useGameStore.setState(s => ({
    phase, scores,
    turnResults: { ...s.turnResults, A: turnScore },
    cards: [], tabooWords: [], tabooBuzzes: {}, timerEnd: null,
  }));
});

socket.on('round:ended', ({ phase, scores, round, turnResults, roundHistory }) => {
  useGameStore.setState({
    phase, scores, round, turnResults,
    timerEnd: null, cluingTeam: null, activeCluingClueGiverId: null,
    ...(roundHistory ? { roundHistory } : {}),
  });
});

socket.on('game:reset', ({ room }) => {
  useGameStore.setState({
    ...initialState,
    connected: true,
    playerId: useGameStore.getState().playerId,
    playerName: useGameStore.getState().playerName,
    roomCode: room.code, hostId: room.hostId,
    players: room.players, settings: room.settings,
    tabooMasters: room.tabooMasters, phase: 'LOBBY',
    roundHistory: [],
  });
});
