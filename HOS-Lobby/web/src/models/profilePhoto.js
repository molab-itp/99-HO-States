// Port of ProfilePhoto.swift, on a canvas instead of ImageIO.

/** Thumbnail edge in pixels: the list shows 44px avatars, which is 132px at 3x. */
export const THUMB_PIXELS = 256;

// Canvases have a size limit (about 16.7 million pixels in Safari on iOS), so a photo larger than
// this on its long side is scaled down to it. v06 keeps the original pixel count.
const MAX_PIXELS = 4096;

export class PhotoProcessingError extends Error {}

const unreadableImage = () => new PhotoProcessingError("That photo couldn't be read.");
const encodingFailed = () => new PhotoProcessingError("That photo couldn't be converted to JPEG.");

/**
 * Encodes a picked photo for upload: `{ full, thumb }`, the full-size image and a small square
 * thumbnail, both JPEG blobs. Re-encoding bakes in the EXIF orientation and drops the metadata
 * (GPS location, camera details), which would otherwise be public in the bucket.
 *
 * `image` is a File or Blob in any format the browser decodes (JPEG, PNG, WebP, …; HEIC only in
 * Safari).
 *
 * `crop` keeps only part of the image: `{ x, y, width, height }` in unit coordinates (0…1 on both
 * axes, origin at the top left of the upright image), as `PhotoCropView` returns it.
 */
export async function makeProfilePhoto(image, crop = null) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' });
  } catch {
    throw unreadableImage();
  }
  try {
    let source = { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    if (crop) {
      const x = Math.round(crop.x * bitmap.width);
      const y = Math.round(crop.y * bitmap.height);
      source = {
        x,
        y,
        width: Math.max(1, Math.min(bitmap.width - x, Math.round(crop.width * bitmap.width))),
        height: Math.max(1, Math.min(bitmap.height - y, Math.round(crop.height * bitmap.height))),
      };
    }

    const scale = Math.min(1, MAX_PIXELS / Math.max(source.width, source.height));
    const full = await jpeg(bitmap, source, source.width * scale, source.height * scale, 0.9);

    // The center square, no larger than `THUMB_PIXELS`.
    const side = Math.min(source.width, source.height);
    const square = {
      x: source.x + (source.width - side) / 2,
      y: source.y + (source.height - side) / 2,
      width: side,
      height: side,
    };
    const thumbSide = Math.min(side, THUMB_PIXELS);
    const thumb = await jpeg(bitmap, square, thumbSide, thumbSide, 0.8);
    return { full, thumb };
  } finally {
    bitmap.close();
  }
}

/** The `source` rectangle of `bitmap`, drawn `width` × `height`, as a JPEG blob. */
function jpeg(bitmap, source, width, height, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d');
  if (!context) throw encodingFailed();
  // JPEG has no transparency; without this a transparent PNG's background comes out black.
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(encodingFailed())), 'image/jpeg', quality);
  });
}
