/**
 * iPhone/iPad offer Web Push only to web apps added to the Home Screen. iPadOS 13+ Safari asks for
 * desktop sites by default and reports a Mac user agent, so a Mac with a touch screen is an iPad.
 */
export function needsHomeScreenInstall(
  userAgent: string,
  standalone: boolean,
  maxTouchPoints = 0,
): boolean {
  const apple =
    /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return apple && !standalone;
}
