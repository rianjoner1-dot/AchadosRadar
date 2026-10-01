export const MAX_AVATAR_INPUT_BYTES: number;
export const MAX_AVATAR_OUTPUT_BYTES: number;
export const MAX_AVATAR_PIXELS: number;

export function versionAvatarUrl(publicUrl: string, version?: number | string): string;

export interface AvatarBitmap {
  width: number;
  height: number;
  close(): void;
}

export interface PrepareAvatarOptions {
  createImageBitmapImpl?: (file: Blob) => Promise<AvatarBitmap>;
  createCanvas?: () => HTMLCanvasElement;
}

export function prepareAvatarBlob(file: Blob, options?: PrepareAvatarOptions): Promise<Blob>;
