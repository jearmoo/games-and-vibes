import { describe, it, expect, beforeEach } from 'vitest';
import { TestRoom } from '@games/test-utils';

describe('BaseRoom', () => {
  let room: TestRoom;

  beforeEach(() => {
    room = new TestRoom('TEST', 'host1');
    room.addPlayer('host1', 'Host', 'sock1');
    room.addPlayer('p2', 'Player2', 'sock2');
  });

  describe('addPlayer', () => {
    it('adds player to map', () => {
      expect(room.players.size).toBe(2);
      expect(room.getPlayer('host1')?.name).toBe('Host');
    });

    it('sets default connected state', () => {
      const p = room.getPlayer('host1')!;
      expect(p.connected).toBe(true);
    });

    it('updates lastActivity', () => {
      const before = room.lastActivity;
      room.addPlayer('p3', 'Player3', 'sock3');
      expect(room.lastActivity).toBeGreaterThanOrEqual(before);
    });
  });

  describe('removePlayer', () => {
    it('hard-deletes when game not active', () => {
      room.removePlayer('p2');
      expect(room.players.size).toBe(1);
      expect(room.getPlayer('p2')).toBeUndefined();
    });

    it('soft-removes when game active', () => {
      room.gameActive = true;
      room.removePlayer('p2');
      expect(room.players.size).toBe(2);
      expect(room.getPlayer('p2')?.removed).toBe(true);
      expect(room.getPlayer('p2')?.connected).toBe(false);
    });

    it('calls onPlayerRemoved hook', () => {
      room.removePlayer('p2');
      expect(room.removedPlayerIds).toContain('p2');
    });
  });

  describe('kickPlayer', () => {
    it('hard-deletes when game not active', () => {
      expect(room.kickPlayer('p2')).toBe(true);
      expect(room.players.size).toBe(1);
      expect(room.getPlayer('p2')).toBeUndefined();
    });

    it('soft-removes when game active', () => {
      room.gameActive = true;
      expect(room.kickPlayer('p2')).toBe(true);
      expect(room.players.size).toBe(2);
      expect(room.getPlayer('p2')?.removed).toBe(true);
      expect(room.getPlayer('p2')?.connected).toBe(false);
    });

    it('returns false for nonexistent player', () => {
      expect(room.kickPlayer('nobody')).toBe(false);
    });

    it('calls onPlayerRemoved hook', () => {
      room.kickPlayer('p2');
      expect(room.removedPlayerIds).toContain('p2');
    });
  });

  describe('queries', () => {
    it('getActivePlayers excludes removed', () => {
      room.gameActive = true;
      room.removePlayer('p2');
      expect(room.getActivePlayers()).toHaveLength(1);
    });

    it('getPlayerByName finds by name', () => {
      expect(room.getPlayerByName('Host')?.id).toBe('host1');
      expect(room.getPlayerByName('Nobody')).toBeUndefined();
    });
  });

  describe('serialization', () => {
    it('playerDTOs maps to client shape', () => {
      const dtos = room.playerDTOs();
      expect(dtos).toHaveLength(2);
      expect(dtos[0]).toHaveProperty('id');
      expect(dtos[0]).toHaveProperty('name');
      expect(dtos[0]).toHaveProperty('connected');
      expect(dtos[0]).not.toHaveProperty('socketId');
    });

    it('toDTO includes room fields', () => {
      room.phase = 'PLAYING';
      const dto = room.toDTO();
      expect(dto.code).toBe('TEST');
      expect(dto.hostId).toBe('host1');
      expect(dto.phase).toBe('PLAYING');
      expect(dto.players).toHaveLength(2);
    });

    it('toJSON includes game state from serializeGameState', () => {
      room.gameActive = true;
      room.phase = 'SETUP';
      const json = room.toJSON() as any;
      expect(json.code).toBe('TEST');
      expect(json.gameActive).toBe(true);
      expect(json.phase).toBe('SETUP');
      expect(json.players).toHaveLength(2);
    });

    it('restorePlayers sets all as disconnected', () => {
      const data = { players: [{ id: 'x1', name: 'X' }] };
      const newRoom = new TestRoom('R2', 'x1');
      newRoom.restorePlayers(data);
      const p = newRoom.getPlayer('x1')!;
      expect(p.connected).toBe(false);
      expect(p.socketId).toBe('');
      expect(p.disconnectedAt).toBeDefined();
    });
  });

  describe('touch', () => {
    it('updates lastActivity', () => {
      const old = room.lastActivity;
      room.touch();
      expect(room.lastActivity).toBeGreaterThanOrEqual(old);
    });
  });
});
