import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestRoom, MockStore } from '@games/test-utils';
import { RoomManager } from './RoomManager.js';

function createManager(store?: MockStore) {
  const s = store ?? new MockStore();
  const mgr = new RoomManager<TestRoom>({
    store: s,
    roomFactory: (code, hostId) => new TestRoom(code, hostId),
    roomFromJSON: (data) => TestRoom.fromJSON(data),
  });
  return { mgr, store: s };
}

describe('RoomManager', () => {
  let mgr: RoomManager<TestRoom>;
  let store: MockStore;

  beforeEach(() => {
    ({ mgr, store } = createManager());
  });

  afterEach(() => {
    mgr.destroy();
  });

  describe('room lifecycle', () => {
    it('creates rooms with unique codes', () => {
      const r1 = mgr.createRoom('host1');
      const r2 = mgr.createRoom('host2');
      expect(r1.code).not.toBe(r2.code);
      expect(r1.code).toHaveLength(4);
      expect(mgr.getRoomCount()).toBe(2);
    });

    it('retrieves rooms case-insensitively', () => {
      const room = mgr.createRoom('host1');
      expect(mgr.getRoom(room.code.toLowerCase())).toBe(room);
    });

    it('deletes rooms and untracks players', () => {
      const room = mgr.createRoom('host1');
      room.addPlayer('host1', 'Host', 'sock1');
      mgr.trackPlayer('host1', room.code);

      mgr.deleteRoom(room.code);
      expect(mgr.getRoom(room.code)).toBeUndefined();
      expect(mgr.getRoomForPlayer('host1')).toBeUndefined();
      expect(mgr.getRoomCount()).toBe(0);
    });

    it('calls clearTimer on delete', () => {
      const room = mgr.createRoom('host1');
      mgr.deleteRoom(room.code);
      expect(room.timerCleared).toBe(true);
    });
  });

  describe('player tracking', () => {
    it('tracks player to room', () => {
      const room = mgr.createRoom('host1');
      mgr.trackPlayer('host1', room.code);
      expect(mgr.getRoomForPlayer('host1')).toBe(room);
    });

    it('untracks player', () => {
      const room = mgr.createRoom('host1');
      mgr.trackPlayer('host1', room.code);
      mgr.untrackPlayer('host1');
      expect(mgr.getRoomForPlayer('host1')).toBeUndefined();
    });

    it('counts players across rooms', () => {
      const r1 = mgr.createRoom('host1');
      const r2 = mgr.createRoom('host2');
      mgr.trackPlayer('host1', r1.code);
      mgr.trackPlayer('host2', r2.code);
      mgr.trackPlayer('p3', r1.code);
      expect(mgr.getPlayerCount()).toBe(3);
    });
  });

  describe('save/restore', () => {
    it('save serializes rooms to store', () => {
      const room = mgr.createRoom('host1');
      room.addPlayer('host1', 'Host', 'sock1');
      mgr.save();
      expect(store.saveCalls).toBe(1);
      expect(store.savedData).toHaveLength(1);
      expect((store.savedData![0] as any).code).toBe(room.code);
    });

    it('save is no-op without store', () => {
      const { mgr: noStoreMgr } = (() => {
        const m = new RoomManager<TestRoom>({
          roomFactory: (code, hostId) => new TestRoom(code, hostId),
          roomFromJSON: (data) => TestRoom.fromJSON(data),
        });
        return { mgr: m };
      })();
      noStoreMgr.save(); // should not throw
      noStoreMgr.destroy();
    });

    it('restore creates rooms from store data', () => {
      const room = new TestRoom('ABCD', 'host1');
      room.addPlayer('host1', 'Host', 'sock1');
      store.restoreData = [room.toJSON()];

      const { mgr: mgr2, store: store2 } = createManager(store);
      mgr2.restore();
      expect(mgr2.getRoomCount()).toBe(1);
      expect(mgr2.getRoom('ABCD')).toBeDefined();
      expect(mgr2.getPlayerCount()).toBe(1);
      mgr2.destroy();
    });

    it('restore calls onRoomRestored for each room', () => {
      store.restoreData = [new TestRoom('AAAA', 'h1').toJSON()];
      const restored: TestRoom[] = [];
      mgr.restore((room) => restored.push(room));
      expect(restored).toHaveLength(1);
      expect(restored[0].code).toBe('AAAA');
    });

    it('restore is no-op when store returns null', () => {
      store.restoreData = null;
      mgr.restore();
      expect(mgr.getRoomCount()).toBe(0);
    });
  });
});
