/**
 * Returns YYYY-MM-DD formatted in Asia/Bangkok timezone (Section 8.1)
 */
export function getBangkokDateString(offsetDays = 0): string {
  const target = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(target);
}

const DAY_MS = 86_400_000;
const bangkokMidnight = (ymd: string) => new Date(`${ymd}T00:00:00+07:00`);

/**
 * A quote is good for `quoteDays` days from `today`, but never past the earliest end date given
 * (end dates are inclusive, YYYY-MM-DD). `days` is negative once an end date has passed.
 */
export function getQuoteValidity(
  today: string,
  endDates: (string | null | undefined)[],
  quoteDays = 30
): { until: Date; days: number; capped: boolean } {
  const start = bangkokMidnight(today);
  const quoteEnd = new Date(start.getTime() + quoteDays * DAY_MS);
  const earliest = endDates
    .filter((d): d is string => Boolean(d))
    .map(bangkokMidnight)
    .reduce<Date | null>((min, d) => (!min || d < min ? d : min), null);
  const capped = earliest !== null && earliest < quoteEnd;
  const until = capped ? earliest : quoteEnd;
  return { until, days: Math.round((until.getTime() - start.getTime()) / DAY_MS), capped };
}
