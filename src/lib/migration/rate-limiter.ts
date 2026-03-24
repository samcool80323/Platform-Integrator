/**
 * Simple in-memory token-bucket rate limiter for GHL API.
 * GHL allows 100 requests per 10 seconds per location.
 * We use 90 to leave headroom.
 */

const WINDOW_MS = 10_000; // 10 seconds
const MAX_REQUESTS = 90; // leave 10% headroom

const buckets = new Map<string, number[]>();

export async function acquireRateLimit(locationId: string): Promise<void> {
  const now = Date.now();
  let timestamps = buckets.get(locationId) || [];

  // Remove timestamps outside the window
  timestamps = timestamps.filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    // Wait until the oldest timestamp expires from the window
    const waitMs = WINDOW_MS - (now - timestamps[0]) + 100; // +100ms buffer
    await new Promise((r) => setTimeout(r, waitMs));
    // Recurse to re-check
    return acquireRateLimit(locationId);
  }

  timestamps.push(now);
  buckets.set(locationId, timestamps);
}
