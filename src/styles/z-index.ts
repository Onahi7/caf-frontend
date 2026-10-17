/**
 * Standardized z-index scale for the application.
 *
 * Tailwind needs static class names, so components use literal arbitrary
 * values (e.g. `z-[70]`). Those literals MUST mirror this scale — when adding
 * or changing an overlay, use the matching band below and update both places.
 */
export const Z_INDEX = {
  // Base layer
  BASE: 0,

  // Content layers
  DROPDOWN: 10,
  STICKY: 20,
  FIXED: 30,

  // Navigation overlays
  SIDEBAR_BACKDROP: 40,
  SIDEBAR: 50,

  // Modal layers
  MODAL: 70,
  CONFIRM: 80,

  // Blocking overlays
  CAMERA_SCANNER: 85,
  LOADING_OVERLAY: 90,

  // Notification / critical layers
  TOAST: 100,
  CRITICAL_ALERT: 100,
} as const;

export type ZIndex = typeof Z_INDEX[keyof typeof Z_INDEX];
