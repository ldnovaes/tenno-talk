/** iPhone/iPad offer Web Push only to web apps added to the Home Screen. */
export function needsHomeScreenInstall(userAgent: string, standalone: boolean): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) && !standalone;
}
