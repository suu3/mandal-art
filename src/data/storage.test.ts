import { describe, expect, it } from 'vitest';
import { readLocal, writeLocal } from './storage';
import { newRoot } from '../domain/goals';
class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}
describe('account-isolated local storage', () => {
  it('never exposes account A data to guest or account B', () => {
    const storage = new MemoryStorage();
    writeLocal(storage, 'A', [{ ...newRoot(), title: 'private' }], 3, true);
    expect(readLocal(storage, 'B').board).toBeNull();
    expect(readLocal(storage, null).board).toBeNull();
    expect(readLocal(storage, 'A').board?.goals[0].title).toBe('private');
    expect(readLocal(storage, 'A').board?.dirty).toBe(true);
  });
  it('preserves corrupted and legacy data rather than silently overwriting it', () => {
    const storage = new MemoryStorage();
    storage.setItem('madalart-next-goals', '[broken');
    expect(readLocal(storage, null).legacy).toBe('[broken');
    expect(storage.getItem('madalart-next-goals')).toBe('[broken');
  });
  it('returns an error instead of crashing when storage is unavailable', () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(readLocal(broken, 'A').error).toBeTruthy();
    expect(writeLocal(broken, 'A', [newRoot()], 0, true)).toBe(false);
  });
});
