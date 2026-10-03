import type { MediaAttachment } from "@/types/media";

/**
 * Offline "photos": a small SVG landscape with a gradient sky. Keeps the mock
 * self-contained (no external image hosts). Real media comes from the backend.
 */
export function landscapeSvg(hueA: number, hueB: number, width = 1080, height = 1350): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="hsl(${hueA} 70% 62%)"/><stop offset="1" stop-color="hsl(${hueB} 75% 82%)"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<circle cx="${width * 0.72}" cy="${height * 0.3}" r="${width * 0.09}" fill="hsl(${hueB} 90% 92%)" opacity="0.9"/>
<path d="M0 ${height * 0.72} L${width * 0.28} ${height * 0.5} L${width * 0.5} ${height * 0.66} L${width * 0.72} ${height * 0.46} L${width} ${height * 0.68} V${height} H0Z" fill="hsl(${hueA} 35% 30%)" opacity="0.75"/>
<path d="M0 ${height * 0.82} Q${width * 0.5} ${height * 0.7} ${width} ${height * 0.84} V${height} H0Z" fill="hsl(${hueA} 40% 20%)" opacity="0.85"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function seedImage(
  id: string,
  hueA: number,
  hueB: number,
  alt: string,
  size: { width: number; height: number } = { width: 1080, height: 1350 },
): MediaAttachment {
  const url = landscapeSvg(hueA, hueB, size.width, size.height);
  return {
    id,
    kind: "image",
    url,
    thumbnailUrl: url,
    width: size.width,
    height: size.height,
    durationMs: null,
    mimeType: "image/svg+xml",
    sizeBytes: url.length,
    alt,
  };
}
