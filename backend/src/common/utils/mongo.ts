/**
 * Detects MongoDB's duplicate-key error (E11000).
 *
 * Unique-index violations surface as a driver error rather than a Mongoose
 * validation error, so they need explicit handling wherever a race on a unique
 * field is possible (first-request user provisioning, invoice numbering).
 */
export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}
