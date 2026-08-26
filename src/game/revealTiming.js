export const REVEAL_DISPLAY_DURATION_MS = 5000;

/**
 * Keep the authoritative deadline when it is still in the future. If a delayed
 * snapshot arrives after that deadline, give this client a complete reveal
 * window from receipt instead of skipping the target reveal immediately.
 */
export function getStableRevealDeadline(authoritativeDeadline, receivedAt = Date.now()) {
  const deadline = Number(authoritativeDeadline) || 0;
  if (!deadline) return 0;
  return Math.max(deadline, Number(receivedAt) + REVEAL_DISPLAY_DURATION_MS);
}
