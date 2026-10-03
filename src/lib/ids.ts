/** Client-side id used for optimistic records and idempotency keys. */
export function createClientId(): string {
  return crypto.randomUUID();
}
