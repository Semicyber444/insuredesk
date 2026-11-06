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
