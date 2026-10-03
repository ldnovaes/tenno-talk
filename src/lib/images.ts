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
