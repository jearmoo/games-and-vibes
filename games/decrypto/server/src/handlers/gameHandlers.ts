import type { Server } from 'socket.io';
import type { SocketContext } from '@games/server-core';
import { logger } from '@games/server-core';
import {
  DecryptoEvent,
  DecryptoPhase,
  type DecryptoRoomDTO,
  type GuessKind,
  type JoinTeamPayload,
  type PostGuessSharePayload,
  type RegenerateKeywordPayload,
  type ReleaseWordsPayload,
  type SetOfflineAwarenessPayload,
  type SetWordLockPayload,
  type SetTiebreakerVocabularyModePayload,
  type SubmitCluesPayload,
  type SubmitGuessPayload,
  type SubmitTiebreakerPayload,
  type TeamId,
} from '@games/decrypto-shared';
import type { DecryptoRoom } from '../DecryptoRoom.js';

const TEAMS: TeamId[] = ['red', 'blue'];
const GUESS_KINDS: GuessKind[] = ['decrypt', 'intercept'];

function emitPrivateStates(room: DecryptoRoom, io: Server) {
  for (const player of room.players.values()) {
    if (!player.socketId) continue;
    io.to(player.socketId).emit(DecryptoEvent.PrivateStateUpdated, {
      private: room.getPrivateStateFor(player.id),
    });
  }
}

export function emitGameState(room: DecryptoRoom, io: Server) {
  io.to(room.code).emit(DecryptoEvent.StateUpdated, { room: room.toDTO() as DecryptoRoomDTO });
  emitPrivateStates(room, io);
}

export function scheduleClueTimer(room: DecryptoRoom, io: Server) {
  room.scheduleClueTimer(() => {
    emitGameState(room, io);
    logger.info('game', 'Decrypto clue timer expired', { room: room.code, round: room.round });
  });
}

export function registerGameHandlers(ctx: SocketContext<DecryptoRoom>) {
  const { io, socket, rooms, metrics } = ctx;

  socket.on(DecryptoEvent.RequestPrivateState, () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    socket.emit(DecryptoEvent.PrivateStateUpdated, { private: room.getPrivateStateFor(playerId) });
  });

  socket.on(DecryptoEvent.JoinTeam, (payload: JoinTeamPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (!TEAMS.includes(payload?.team)) {
      socket.emit('room:error', { message: 'Choose a valid team.' });
      return;
    }
    const result = room.assignTeam(playerId, payload.team);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    emitGameState(room, io);
  });

  socket.on(DecryptoEvent.RegenerateKeyword, (payload: RegenerateKeywordPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (!TEAMS.includes(payload?.team)) {
      socket.emit('room:error', { message: 'Choose a valid team.' });
      return;
    }
    const result = room.regenerateKeyword(playerId, payload.team, payload.index);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    emitGameState(room, io);
  });

  socket.on(DecryptoEvent.SetWordLock, (payload: SetWordLockPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (!TEAMS.includes(payload?.team) || typeof payload?.locked !== 'boolean') {
      socket.emit('room:error', { message: 'Choose a valid word lock state.' });
      return;
    }
    const result = room.setWordLock(playerId, payload.team, payload.locked);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    emitGameState(room, io);
  });

  socket.on(DecryptoEvent.StartGame, () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (playerId !== room.hostId) {
      socket.emit('room:error', { message: 'Only the host can start the game.' });
      return;
    }
    const result = room.startGame();
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    metrics.gameStarted();
    emitGameState(room, io);
    scheduleClueTimer(room, io);
    logger.info('game', 'Decrypto game started', {
      room: room.code,
      players: room.getActivePlayers().length,
    });
  });

  socket.on(DecryptoEvent.SetOfflineAwareness, (payload: SetOfflineAwarenessPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const result = room.setOfflineAwareness(playerId, payload?.enabled);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    emitGameState(room, io);
  });

  socket.on(DecryptoEvent.SaveClues, (payload: SubmitCluesPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const result = room.saveClues(playerId, payload?.clues ?? []);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    emitGameState(room, io);
  });

  socket.on(DecryptoEvent.SubmitClues, (payload: SubmitCluesPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const result = room.lockClues(playerId, payload?.clues ?? []);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    emitGameState(room, io);
    scheduleClueTimer(room, io);
    logger.info('game', 'Decrypto clues locked', {
      room: room.code,
      phase: room.phase,
      round: room.round,
      locked: {
        red: room.getPublicTurnState()?.teams.red.clueLocked ?? false,
        blue: room.getPublicTurnState()?.teams.blue.clueLocked ?? false,
      },
    });
  });

  socket.on(DecryptoEvent.UnlockClues, () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const result = room.unlockClues(playerId);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    emitGameState(room, io);
    scheduleClueTimer(room, io);
  });

  socket.on(DecryptoEvent.PostGuessShare, (payload: PostGuessSharePayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (!GUESS_KINDS.includes(payload?.kind)) {
      socket.emit('room:error', { message: 'Choose a valid guess type.' });
      return;
    }
    if (!TEAMS.includes(payload?.team)) {
      socket.emit('room:error', { message: 'Choose a valid team transmission.' });
      return;
    }
    const result = room.postGuessShare(playerId, payload.team, payload.kind, payload.code);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    emitPrivateStates(room, io);
  });

  socket.on(DecryptoEvent.SubmitGuess, (payload: SubmitGuessPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (!GUESS_KINDS.includes(payload?.kind)) {
      socket.emit('room:error', { message: 'Choose a valid guess type.' });
      return;
    }
    if (!TEAMS.includes(payload?.team)) {
      socket.emit('room:error', { message: 'Choose a valid team transmission.' });
      return;
    }
    const result = room.submitGuess(playerId, payload.team, payload.kind, payload.code);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    if (room.phase === DecryptoPhase.GAME_OVER) metrics.gameCompleted();
    emitGameState(room, io);
  });

  socket.on(DecryptoEvent.SubmitTiebreaker, (payload: SubmitTiebreakerPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const result = room.submitTiebreaker(playerId, payload?.guesses);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    if (room.phase === DecryptoPhase.GAME_OVER) metrics.gameCompleted();
    emitGameState(room, io);
  });

  socket.on(DecryptoEvent.UnlockTiebreaker, () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const result = room.unlockTiebreaker(playerId);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    emitGameState(room, io);
  });

  socket.on(DecryptoEvent.SetTiebreakerVocabularyMode, (payload: SetTiebreakerVocabularyModePayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const result = room.setTiebreakerVocabularyMode(playerId, payload?.mode);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    emitGameState(room, io);
  });

  socket.on(DecryptoEvent.RequestTiebreakerRepeat, () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const result = room.requestTiebreakerRepeat(playerId);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    emitGameState(room, io);
  });

  socket.on(DecryptoEvent.ReleaseWords, (payload: ReleaseWordsPayload) => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    if (!TEAMS.includes(payload?.team)) {
      socket.emit('room:error', { message: 'Choose a valid team.' });
      return;
    }
    const result = room.releaseWords(playerId, payload.team);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    emitGameState(room, io);
  });

  socket.on(DecryptoEvent.Continue, () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const result = room.continueFromReveal(playerId);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    emitGameState(room, io);
    scheduleClueTimer(room, io);
  });

  socket.on(DecryptoEvent.TakeWin, () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    const result = room.takeClinchedWin(playerId);
    if (!result.ok) {
      socket.emit('room:error', { message: result.message });
      return;
    }
    metrics.gameCompleted();
    emitGameState(room, io);
  });

  socket.on(DecryptoEvent.ResetGame, () => {
    const playerId = ctx.getPlayerId();
    if (!playerId) return;
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return;
    room.resetToLobby();
    emitGameState(room, io);
  });
}
