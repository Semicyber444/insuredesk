const COMPARE_BASKET_KEY = 'insuredesk_compare_ids_v1';

/** The compare basket (2-4 option IDs) is per-tab UI state, so it stays in sessionStorage. */
export function getCompareBasket(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(COMPARE_BASKET_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function setCompareBasket(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(COMPARE_BASKET_KEY, JSON.stringify(ids.slice(0, 4)));
  } catch {
    // Ignore storage errors
  }
}
