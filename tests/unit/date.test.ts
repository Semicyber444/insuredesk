import { describe, it, expect } from 'vitest';
import { getQuoteValidity } from '@/lib/date';

const ymd = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

describe('getQuoteValidity', () => {
  it('gives the full 30 days when no plan ends sooner', () => {
    const v = getQuoteValidity('2026-11-06', [null, undefined, '2027-12-31']);
    expect(ymd(v.until)).toBe('2026-12-06');
    expect(v).toMatchObject({ days: 30, capped: false });
  });

  it('stops at the earliest plan end date', () => {
    const v = getQuoteValidity('2026-11-06', ['2026-11-20', '2026-11-15']);
    expect(ymd(v.until)).toBe('2026-11-15');
    expect(v).toMatchObject({ days: 9, capped: true });
  });

  it('is 0 days on the last valid day and negative once expired', () => {
    expect(getQuoteValidity('2026-11-06', ['2026-11-06']).days).toBe(0);
    expect(getQuoteValidity('2026-11-06', ['2026-11-05']).days).toBe(-1);
  });
});
