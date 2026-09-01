/** Shared avatar limits and square-crop math (client + server). */

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_OUTPUT_SIZE = 256;
export const AVATAR_CROP_VIEW = 280;
export const AVATAR_MIN_ZOOM = 1;
export const AVATAR_MAX_ZOOM = 3;
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";
export const AVATAR_EXTS = ["jpg", "jpeg", "png", "gif", "webp"] as const;
export const AVATAR_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function publicAvatarPath(userId: string, version?: number | string): string {
  const base = `/api/avatars/${encodeURIComponent(userId)}`;
  return version != null ? `${base}?v=${version}` : base;
}

export function avatarStorageKey(orgId: string | null, userId: string, ext: string): string {
  const tenant = orgId?.trim() || "platform";
  return `avatars/${tenant}/${userId}.${ext}`;
}

export function mimeForAvatarExt(ext: string): string {
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

export interface SquareCoverLayout {
  scale: number;
  panX: number;
  panY: number;
  left: number;
  top: number;
  width: number;
  height: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Cover-fit square crop. `panX`/`panY` move the image inside the viewport
 * (positive X = image shifts right). Pans are clamped so the square stays covered.
 */
export function squareCoverLayout(
  imgW: number,
  imgH: number,
  cropSize: number,
  zoom: number,
  panX: number,
  panY: number,
): SquareCoverLayout {
  const w = Math.max(1, imgW);
  const h = Math.max(1, imgH);
  const crop = Math.max(1, cropSize);
  const z = Math.min(AVATAR_MAX_ZOOM, Math.max(AVATAR_MIN_ZOOM, zoom));
  const cover = Math.max(crop / w, crop / h);
  const scale = cover * z;
  const width = w * scale;
  const height = h * scale;
  const maxPanX = Math.max(0, (width - crop) / 2);
  const maxPanY = Math.max(0, (height - crop) / 2);
  const clampedX = Math.min(maxPanX, Math.max(-maxPanX, panX));
  const clampedY = Math.min(maxPanY, Math.max(-maxPanY, panY));
  const left = clampedX - (width - crop) / 2;
  const top = clampedY - (height - crop) / 2;
  return {
    scale,
    panX: clampedX,
    panY: clampedY,
    left,
    top,
    width,
    height,
    sx: -left / scale,
    sy: -top / scale,
    sw: crop / scale,
    sh: crop / scale,
  };
}
