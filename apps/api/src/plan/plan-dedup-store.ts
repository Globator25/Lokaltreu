// NOTE: This module is intended for Plan-Enforcement dedup logic (Step 22).

export interface PlanWarningDedupStore {
  hasEmitted: (tenantId: string, periodKey: string, threshold: number) => Promise<boolean>;
  markEmitted: (tenantId: string, periodKey: string, threshold: number) => Promise<void>;
}

export class InMemoryPlanWarningDedupStore implements PlanWarningDedupStore {
  private readonly map = new Map<string, { emittedAt: number }>();
  private readonly nowFn: () => number;

  constructor(nowFn: () => number = () => Date.now()) {
    this.nowFn = nowFn;
  }

  private key(tenantId: string, periodKey: string, threshold: number): string {
    return `${tenantId}:${periodKey}:${threshold}`;
  }

  hasEmitted(tenantId: string, periodKey: string, threshold: number): Promise<boolean> {
    const entry = this.map.get(this.key(tenantId, periodKey, threshold));
    if (!entry) {
      return Promise.resolve(false);
    }
    const ttlMs = 24 * 60 * 60 * 1000;
    return Promise.resolve(this.nowFn() - entry.emittedAt < ttlMs);
  }

  markEmitted(tenantId: string, periodKey: string, threshold: number): Promise<void> {
    this.map.set(this.key(tenantId, periodKey, threshold), { emittedAt: this.nowFn() });
    return Promise.resolve();
  }
}
