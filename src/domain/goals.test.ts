import { describe, expect, it } from 'vitest';
import { validateGoals, newRoot, childrenOf, pathOf, progressOf } from './goals';
const child = (id = 'a', parentId = 'root', slot = 0) => ({ ...newRoot(), id, parentId, slot });
describe('goal tree boundaries', () => {
  it('accepts an existing backup and strips untrusted owner IDs', () => {
    const goals = validateGoals([{ ...newRoot(), ownerId: 'someone-else' }, child()]);
    expect(goals.map(g => g.id)).toEqual(['root', 'a']);
    expect(goals[0].ownerId).toBeNull();
  });
  it.each([
    ['empty', () => []], ['duplicate id', () => [newRoot(), child(), child()]],
    ['missing parent', () => [newRoot(), child('a', 'missing')]],
    ['cycle', () => [newRoot(), child('a', 'b'), child('b', 'a')]],
    ['duplicate slot', () => [newRoot(), child(), child('b')]],
    ['fractional slot', () => [newRoot(), child('a', 'root', 1.5)]],
    ['multiple roots', () => [newRoot(), { ...newRoot(), id: 'other' }]],
    ['title overflow', () => [{ ...newRoot(), title: 'x'.repeat(121) }]],
    ['text overflow', () => [{ ...newRoot(), description: 'x'.repeat(4001) }]],
    ['unsupported images', () => [{ ...newRoot(), imageUrl: 'data:image/png;base64,abc' }]],
    ['invalid date', () => [{ ...newRoot(), dueDate: '2026-02-30' }]],
    ['too many nodes', () => Array.from({ length: 1001 }, (_, i) => child(String(i)))]
  ])('rejects %s without partially importing', (_, build) => expect(() => validateGoals(build())).toThrow());
  it('calculates navigation and direct-child progress independently of array order', () => {
    const goals = validateGoals([child('b', 'root', 1), { ...child(), status: 'done' }, newRoot()]);
    expect(childrenOf(goals, 'root').map(g => g.id)).toEqual(['a', 'b']);
    expect(pathOf(goals, 'a').map(g => g.id)).toEqual(['root', 'a']);
    expect(progressOf(goals, 'root')).toBe(50);
  });
});
