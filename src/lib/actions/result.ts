/**
 * Next.js hides thrown Server Action messages in production, so actions return their
 * failures as values and callers turn them back into errors with `unwrap`.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
