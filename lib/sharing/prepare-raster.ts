/** Browser preparation creates a small separate raster; the server independently validates and strips metadata. */
export async function prepareSharingRaster(file: File) {
  if (
    file.size > 12 * 1024 * 1024 ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  )
    throw new Error('Choose a JPEG, PNG or WebP image up to 12 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40_000_000)
      throw new Error('Choose a smaller photograph.');
    const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo preparation unavailable.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error('Photo preparation failed.')),
        'image/png',
      ),
    );
    if (blob.size > 2 * 1024 * 1024)
      throw new Error('Choose a simpler or smaller photograph.');
    return blob;
  } finally {
    bitmap.close();
  }
}
