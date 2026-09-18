export interface EncodedImage {
  base64: string;
  name: string;
  contentType: 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
}

export interface PreparedImage {
  image: EncodedImage;
  thumbnail: EncodedImage;
  previewUrl: string;
  originalName: string;
  originalSizeBytes: number;
}

export const MAX_IMAGE_EDGE = 1920;
export const THUMBNAIL_EDGE = 400;

/**
 * Browser-side image pipeline: whatever the admin picks (JPEG, PNG, HEIC-as-
 * JPEG…) is decoded, resized and re-encoded to **WebP** twice — a display-size
 * image and a thumbnail — before anything leaves the machine.
 *
 * Doing it here rather than server-side means the upload is already small (no
 * 12MB phone photos crossing the wire), the server needs no image-processing
 * dependency, and the API can simply refuse anything that isn't WebP.
 */

function scaledSize(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return {width, height};
  const ratio = maxEdge / longest;
  return {width: Math.round(width * ratio), height: Math.round(height * ratio)};
}

function canvasToWebp(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot process images (no 2D canvas)');
  context.drawImage(source, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('This browser could not encode the image as WebP'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality
    );
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} could not be read as an image`));
    };
    image.src = url;
  });
}

function baseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').toLowerCase() || 'image';
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name} is not an image`);
  }

  const source = await loadImage(file);
  const full = scaledSize(source.naturalWidth, source.naturalHeight, MAX_IMAGE_EDGE);
  const thumb = scaledSize(source.naturalWidth, source.naturalHeight, THUMBNAIL_EDGE);

  const [imageBlob, thumbnailBlob] = await Promise.all([
    canvasToWebp(source, full.width, full.height, 0.82),
    canvasToWebp(source, thumb.width, thumb.height, 0.7),
  ]);

  const stem = baseName(file.name);
  const [imageBase64, thumbnailBase64] = await Promise.all([
    blobToBase64(imageBlob),
    blobToBase64(thumbnailBlob),
  ]);

  return {
    originalName: file.name,
    originalSizeBytes: file.size,
    previewUrl: URL.createObjectURL(thumbnailBlob),
    image: {
      base64: imageBase64,
      name: `${stem}.webp`,
      contentType: 'image/webp',
      width: full.width,
      height: full.height,
      sizeBytes: imageBlob.size,
    },
    thumbnail: {
      base64: thumbnailBase64,
      name: `${stem}-thumb.webp`,
      contentType: 'image/webp',
      width: thumb.width,
      height: thumb.height,
      sizeBytes: thumbnailBlob.size,
    },
  };
}

export async function prepareImages(files: File[]): Promise<{prepared: PreparedImage[]; errors: string[]}> {
  const prepared: PreparedImage[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      prepared.push(await prepareImage(file));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${file.name} could not be processed`);
    }
  }

  return {prepared, errors};
}
