import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {prepareImage, prepareImages, MAX_IMAGE_EDGE, THUMBNAIL_EDGE} from './imagePipeline';

/**
 * jsdom has no real canvas or image decoder, so the browser primitives are
 * stubbed with ones that record how they were driven. That still pins down
 * everything the pipeline is responsible for: it must always emit WebP, it
 * must emit two sizes, and it must respect the edge limits.
 */

interface DrawCall {
  width: number;
  height: number;
  type: string;
  quality: number;
}

let drawCalls: DrawCall[] = [];
let naturalWidth = 4000;
let naturalHeight = 3000;
let encodeFails = false;

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = naturalWidth;
  naturalHeight = naturalHeight;
  set src(_value: string) {
    queueMicrotask(() => {
      if (naturalWidth === 0) this.onerror?.();
      else this.onload?.();
    });
  }
}

beforeEach(() => {
  drawCalls = [];
  naturalWidth = 4000;
  naturalHeight = 3000;
  encodeFails = false;

  vi.stubGlobal('Image', FakeImage as unknown as typeof Image);
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:preview'),
    revokeObjectURL: vi.fn(),
  } as unknown as typeof URL);

  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas') {
      // let React/jsdom create anything else normally
      return Object.create(HTMLElement.prototype);
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({drawImage: vi.fn()}),
      toBlob: (callback: (blob: Blob | null) => void, type: string, quality: number) => {
        drawCalls.push({width: canvas.width, height: canvas.height, type, quality});
        if (encodeFails) {
          callback(null);
          return;
        }
        callback({
          size: canvas.width * canvas.height,
          type,
          arrayBuffer: async () => new Uint8Array([82, 73, 70, 70]).buffer,
        } as unknown as Blob);
      },
    };
    return canvas as unknown as HTMLElement;
  }) as typeof document.createElement);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function imageFile(name = 'photo.JPG', type = 'image/jpeg', size = 4_000_000) {
  return {name, type, size} as File;
}

describe('browser image pipeline', () => {
  test('emits a display image and a thumbnail, both WebP', async () => {
    const prepared = await prepareImage(imageFile());

    expect(prepared.image.contentType).toBe('image/webp');
    expect(prepared.thumbnail.contentType).toBe('image/webp');
    expect(drawCalls.map((call) => call.type)).toEqual(['image/webp', 'image/webp']);
  });

  test('downscales a large photo to the edge limits, preserving aspect ratio', async () => {
    const prepared = await prepareImage(imageFile());

    // 4000x3000 -> longest edge capped
    expect(prepared.image.width).toBe(MAX_IMAGE_EDGE);
    expect(prepared.image.height).toBe(Math.round((MAX_IMAGE_EDGE / 4000) * 3000));
    expect(prepared.thumbnail.width).toBe(THUMBNAIL_EDGE);
    expect(prepared.thumbnail.height).toBe(Math.round((THUMBNAIL_EDGE / 4000) * 3000));
  });

  test('never upscales an image that is already small', async () => {
    naturalWidth = 320;
    naturalHeight = 240;

    const prepared = await prepareImage(imageFile('small.png', 'image/png', 12_000));

    expect(prepared.image.width).toBe(320);
    expect(prepared.image.height).toBe(240);
  });

  test('encodes the thumbnail at a lower quality than the display image', async () => {
    await prepareImage(imageFile());
    const [full, thumb] = drawCalls;
    expect(thumb.quality).toBeLessThan(full.quality);
  });

  test('names both files from the original, as .webp', async () => {
    const prepared = await prepareImage(imageFile('Front Elevation.JPG'));

    expect(prepared.image.name).toBe('front-elevation.webp');
    expect(prepared.thumbnail.name).toBe('front-elevation-thumb.webp');
    expect(prepared.originalName).toBe('Front Elevation.JPG');
  });

  test('rejects a file that is not an image', async () => {
    await expect(prepareImage({name: 'lease.pdf', type: 'application/pdf', size: 100} as File)).rejects.toThrow(
      /not an image/i
    );
  });

  test('reports a decode failure rather than uploading nothing', async () => {
    naturalWidth = 0; // triggers onerror in the fake
    await expect(prepareImage(imageFile('broken.jpg'))).rejects.toThrow(/could not be read/i);
  });

  test('reports an encoder that cannot produce WebP', async () => {
    encodeFails = true;
    await expect(prepareImage(imageFile())).rejects.toThrow(/could not encode/i);
  });

  test('prepareImages processes the good files and collects errors for the rest', async () => {
    const {prepared, errors} = await prepareImages([
      imageFile('a.jpg'),
      {name: 'notes.txt', type: 'text/plain', size: 10} as File,
      imageFile('b.png', 'image/png'),
    ]);

    expect(prepared).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/not an image/i);
  });
});
