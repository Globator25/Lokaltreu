// NOTE: This module is intended for tests only (Step 22 Plan-Enforcement).

import { getCurrentPeriodKey, type ActiveDeviceStore, type PlanCounterStore } from "./plan-policy.js";

export interface PlanTestSetupOptions {
  tenantId: string;
  periodKey?: string;
  stampsLimit: number;
  stampsUsed: number;
  devicesAllowed?: number;
  devicesActive?: number;
  counterStore?: PlanCounterStore;
  activeDeviceStore?: ActiveDeviceStore;
}

let counterStoreRef: PlanCounterStore | null = null;
let activeDeviceStoreRef: ActiveDeviceStore | null = null;

export function setPlanCounterStoreForTest(store: PlanCounterStore): void {
  counterStoreRef = store;
}

export function setActiveDeviceStoreForTest(store: ActiveDeviceStore): void {
  activeDeviceStoreRef = store;
}

export function getCurrentPeriodKeyForTest(now: Date = new Date()): string {
  return getCurrentPeriodKey(now);
}

export async function seedPlanCounterForTest(opts: PlanTestSetupOptions): Promise<void> {
  const counterStore = opts.counterStore ?? counterStoreRef;
  if (!counterStore) {
    throw new Error("PlanCounterStore not provided for test seeding.");
  }
  const periodKey = opts.periodKey ?? getCurrentPeriodKeyForTest();
  const increments = Math.max(0, opts.stampsUsed);
  for (let i = 0; i < increments; i += 1) {
    await counterStore.incrementStamps({
      tenantId: opts.tenantId,
      periodKey,
      limit: opts.stampsLimit,
    });
  }

  const activeDeviceStore = opts.activeDeviceStore ?? activeDeviceStoreRef;
  if (opts.devicesActive != null) {
    if (!activeDeviceStore) {
      throw new Error("ActiveDeviceStore not provided for device seeding.");
    }
    for (let i = 0; i < opts.devicesActive; i += 1) {
      await activeDeviceStore.markActive({
        tenantId: opts.tenantId,
        deviceId: `device-${i + 1}`,
      });
    }
  }
}

export async function seedUsage79Percent(opts: {
  tenantId: string;
  stampsLimit: number;
  counterStore?: PlanCounterStore;
  periodKey?: string;
}): Promise<void> {
  // 79% is rounded down (floor).
  const stampsUsed = Math.floor(opts.stampsLimit * 0.79);
  return seedPlanCounterForTest({
    tenantId: opts.tenantId,
    periodKey: opts.periodKey,
    stampsLimit: opts.stampsLimit,
    stampsUsed,
    counterStore: opts.counterStore,
  });
}

export async function seedUsage80Percent(opts: {
  tenantId: string;
  stampsLimit: number;
  counterStore?: PlanCounterStore;
  periodKey?: string;
}): Promise<void> {
  // 80% uses ceil to reach the threshold.
  const stampsUsed = Math.ceil(opts.stampsLimit * 0.8);
  return seedPlanCounterForTest({
    tenantId: opts.tenantId,
    periodKey: opts.periodKey,
    stampsLimit: opts.stampsLimit,
    stampsUsed,
    counterStore: opts.counterStore,
  });
}

export async function seedUsage100Percent(opts: {
  tenantId: string;
  stampsLimit: number;
  counterStore?: PlanCounterStore;
  periodKey?: string;
}): Promise<void> {
  // 100% is full utilization (stampsUsed == stampsLimit).
  return seedPlanCounterForTest({
    tenantId: opts.tenantId,
    periodKey: opts.periodKey,
    stampsLimit: opts.stampsLimit,
    stampsUsed: opts.stampsLimit,
    counterStore: opts.counterStore,
  });
}
