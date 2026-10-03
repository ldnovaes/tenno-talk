const MAX_INPUT_BYTES = 5 * 1024 * 1024;

export type ImageProblem = "invalid" | "tooLarge";

export function validateImageFile(file: File): ImageProblem | null {
  if (!file.type.startsWith("image/")) return "invalid";
  if (file.size > MAX_INPUT_BYTES) return "tooLarge";
  return null;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

/** Center-crops to a square and downsizes (avatars). Falls back to the original image. */
export async function fileToSquareDataUrl(file: File, size = 256): Promise<string> {
  const original = await readAsDataUrl(file);
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return original;
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return original;
  }
}

/** Downsizes a photo before sending (mock keeps it as a data URL; Phase 8 uploads the file). */
export async function fileToResizedDataUrl(
  file: File,
  maxSide = 1600,
): Promise<{ url: string; width: number | null; height: number | null }> {
  const original = await readAsDataUrl(file);
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return { url: original, width: bitmap.width, height: bitmap.height };
    context.drawImage(bitmap, 0, 0, width, height);
    return { url: canvas.toDataURL("image/jpeg", 0.85), width, height };
  } catch {
    return { url: original, width: null, height: null };
  }
}
