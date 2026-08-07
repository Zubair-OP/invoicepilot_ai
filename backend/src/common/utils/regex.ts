/**
 * Escapes every regex metacharacter so a user-supplied string can be safely
 * interpolated into a `$regex` query.
 *
 * A crafted search term like `(a+)+$` is a ReDoS vector: interpolated raw, the
 * query engine attempts catastrophic backtracking. Escaping turns the user's
 * text into a literal match instead of a pattern. Prefer this over `$text`
 * (which needs a text index and tokenizes input differently).
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
