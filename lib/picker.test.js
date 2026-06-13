import { describe, it, expect } from 'vitest';
import { pickIndex, SHUFFLE_K, fontSizePx } from './picker.js';

describe('pickIndex', () => {
  it('returns an integer within [0, size)', () => {
    for (const s of [0, 1, 42, 1718000000, 1718000123]) {
      const idx = pickIndex(s, 132);
      expect(Number.isInteger(idx)).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(132);
    }
  });

  it('is a bijection over one full cycle (no freeze, all reachable)', () => {
    const seen = new Set();
    for (let s = 0; s < 132; s++) seen.add(pickIndex(s, 132));
    expect(seen.size).toBe(132);
  });

  it('changes between consecutive seconds', () => {
    for (const s of [0, 100, 1718000000]) {
      expect(pickIndex(s, 132)).not.toBe(pickIndex(s + 1, 132));
    }
  });

  it('uses a multiplier coprime to 132', () => {
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    expect(gcd(SHUFFLE_K, 132)).toBe(1);
  });
});

describe('fontSizePx', () => {
  it('buckets by total length at the documented boundaries', () => {
    expect(fontSizePx('x'.repeat(18))).toBe(46); // HUMOR IS A RELEASE
    expect(fontSizePx('x'.repeat(25))).toBe(46);
    expect(fontSizePx('x'.repeat(26))).toBe(36);
    expect(fontSizePx('x'.repeat(40))).toBe(36);
    expect(fontSizePx('x'.repeat(41))).toBe(29);
    expect(fontSizePx('x'.repeat(55))).toBe(29);
    expect(fontSizePx('x'.repeat(56))).toBe(24);
    expect(fontSizePx('x'.repeat(62))).toBe(24); // longest truism
  });
});
