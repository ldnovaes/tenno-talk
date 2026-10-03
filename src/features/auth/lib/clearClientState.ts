type Clearer = () => void;

const clearers = new Set<Clearer>();

/** Stores holding per-user client state register here so sign-out wipes them. */
export function registerClientStateClearer(clearer: Clearer): void {
  clearers.add(clearer);
}

export function clearClientState(): void {
  clearers.forEach((clear) => clear());
}
