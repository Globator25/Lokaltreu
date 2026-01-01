// Test-only hooks for stamp claim behavior.
const testHooksEnabled = process.env.NODE_ENV === "test";
let stampClaimCount = 0;

export function recordStampClaim(): void {
  if (!testHooksEnabled) {
    return;
  }
  stampClaimCount += 1;
}

export function getStampClaimCount(): number {
  if (!testHooksEnabled) {
    return 0;
  }
  return stampClaimCount;
}

export function resetStampClaimCount(): void {
  if (!testHooksEnabled) {
    return;
  }
  stampClaimCount = 0;
}

export function isStampTestHooksEnabled(): boolean {
  return testHooksEnabled;
}
