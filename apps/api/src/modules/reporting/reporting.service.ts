import { resolvePlanLimits, resolveTenantPlan, type ActiveDeviceStore, type TenantPlanStore } from "../../plan/plan-policy.js";
import type { DeletedSubjectsRepository } from "../../repositories/deleted-subjects-repo.js";

export type ReportingMetric =
  | "stamps"
  | "rewards"
  | "referral_links"
  | "referral_qualified"
  | "referral_bonus_stamps";

export type ReportingBucketSize = "day" | "week" | "month";

type ReportingEventName =
  | "stamps.claimed"
  | "reward.redeemed"
  | "referral.link.issued"
  | "referral.first_stamp.qualified"
  | "referral.bonus_stamp.credited"
  | "plan.limit.warning_emitted"
  | "plan.limit.upgrade_signal_emitted";

export type ReportingEvent = {
  tenantId: string;
  event: ReportingEventName;
  at: number;
  subjectId?: string;
};

export type ReportingCounts = {
  day: number;
  week: number;
  month: number;
};

export type ReportingRates = {
  day: number;
  week: number;
  month: number;
};

export type ReportingSummary = {
  stamps: ReportingCounts;
  rewards: ReportingCounts;
  referrals: {
    linksIssued: ReportingCounts;
    qualified: ReportingCounts;
    bonusStamps: ReportingCounts;
    conversionRate: ReportingRates;
  };
  deviceActivity: {
    activeDevices: number;
  };
  planUsage: {
    period: string;
    stampsUsed: number;
    stampsLimit: number | null;
    usagePercent: number | null;
    warningEmitted: boolean;
    upgradeSignalEmitted: boolean;
  };
  activeCampaigns: number;
};

export type ReportingTimeseriesBucket = {
  start: string;
  end: string;
  count: number;
};

export type ReportingTimeseries = {
  metric: ReportingMetric;
  bucket: ReportingBucketSize;
  from: string;
  to: string;
  series: ReportingTimeseriesBucket[];
};

export interface ReportingStore {
  recordEvent: (event: { tenantId: string; event: string; at: number; subjectId?: string }) => void;
  listEvents: (params: {
    tenantId: string;
    from: number;
    to: number;
    eventNames?: ReportingEventName[];
  }) => ReportingEvent[];
}

const REPORTING_EVENTS: ReadonlySet<string> = new Set([
  "stamps.claimed",
  "reward.redeemed",
  "referral.link.issued",
  "referral.first_stamp.qualified",
  "referral.bonus_stamp.credited",
  "plan.limit.warning_emitted",
  "plan.limit.upgrade_signal_emitted",
]);

const METRIC_EVENT_MAP: Record<ReportingMetric, ReportingEventName> = {
  stamps: "stamps.claimed",
  rewards: "reward.redeemed",
  referral_links: "referral.link.issued",
  referral_qualified: "referral.first_stamp.qualified",
  referral_bonus_stamps: "referral.bonus_stamp.credited",
};

export class InMemoryReportingStore implements ReportingStore {
  private readonly eventsByTenant = new Map<string, ReportingEvent[]>();

  recordEvent(event: { tenantId: string; event: string; at: number; subjectId?: string }): void {
    if (!REPORTING_EVENTS.has(event.event)) {
      return;
    }
    const existing = this.eventsByTenant.get(event.tenantId) ?? [];
    existing.push({
      tenantId: event.tenantId,
      event: event.event as ReportingEventName,
      at: event.at,
      subjectId: event.subjectId,
    });
    this.eventsByTenant.set(event.tenantId, existing);
  }

  listEvents(params: {
    tenantId: string;
    from: number;
    to: number;
    eventNames?: ReportingEventName[];
  }): ReportingEvent[] {
    const events = this.eventsByTenant.get(params.tenantId) ?? [];
    if (!events.length) {
      return [];
    }
    const allowed = params.eventNames ? new Set(params.eventNames) : null;
    return events.filter((event) => {
      if (event.at < params.from || event.at >= params.to) {
        return false;
      }
      if (allowed && !allowed.has(event.event)) {
        return false;
      }
      return true;
    });
  }
}

export function createReportingService(deps: {
  store: ReportingStore;
  planStore: TenantPlanStore;
  activeDeviceStore: ActiveDeviceStore;
  tombstoneRepo?: DeletedSubjectsRepository;
  now?: () => Date;
}) {
  const nowFn = deps.now ?? (() => new Date());

  async function getSummary(params: { tenantId: string }): Promise<ReportingSummary> {
    const now = nowFn();
    const dayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const nowMs = now.getTime();
    const tombstonedSubjects = await listTombstonedSubjects(params.tenantId);

    const stamps = buildCounts(
      params.tenantId,
      "stamps.claimed",
      dayStart,
      weekStart,
      monthStart,
      nowMs,
      tombstonedSubjects
    );
    const rewards = buildCounts(
      params.tenantId,
      "reward.redeemed",
      dayStart,
      weekStart,
      monthStart,
      nowMs,
      tombstonedSubjects
    );
    const referralLinks = buildCounts(
      params.tenantId,
      "referral.link.issued",
      dayStart,
      weekStart,
      monthStart,
      nowMs,
      tombstonedSubjects
    );
    const referralQualified = buildCounts(
      params.tenantId,
      "referral.first_stamp.qualified",
      dayStart,
      weekStart,
      monthStart,
      nowMs,
      tombstonedSubjects
    );
    const referralBonus = buildCounts(
      params.tenantId,
      "referral.bonus_stamp.credited",
      dayStart,
      weekStart,
      monthStart,
      nowMs,
      tombstonedSubjects
    );

    const conversionRate = {
      day: computeRate(referralQualified.day, referralLinks.day),
      week: computeRate(referralQualified.week, referralLinks.week),
      month: computeRate(referralQualified.month, referralLinks.month),
    };

    const plan = resolveTenantPlan(await deps.planStore.getPlan(params.tenantId));
    const planLimits = resolvePlanLimits(plan);
    const stampsUsed = stamps.month;
    const stampsLimit = planLimits.stampsPerMonth ?? null;
    const usagePercent =
      stampsLimit && stampsLimit > 0 ? Math.min(100, Math.round((stampsUsed / stampsLimit) * 100)) : null;

    const warningEmitted = hasEvent(
      params.tenantId,
      "plan.limit.warning_emitted",
      monthStart.getTime(),
      nowMs,
      tombstonedSubjects
    );
    const upgradeSignalEmitted = hasEvent(
      params.tenantId,
      "plan.limit.upgrade_signal_emitted",
      monthStart.getTime(),
      nowMs,
      tombstonedSubjects
    );

    const activeDevices = await deps.activeDeviceStore.countActive(params.tenantId);
    const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    return {
      stamps,
      rewards,
      referrals: {
        linksIssued: referralLinks,
        qualified: referralQualified,
        bonusStamps: referralBonus,
        conversionRate,
      },
      deviceActivity: {
        activeDevices,
      },
      planUsage: {
        period,
        stampsUsed,
        stampsLimit,
        usagePercent,
        warningEmitted,
        upgradeSignalEmitted,
      },
      activeCampaigns: 1,
    };
  }

  function buildCounts(
    tenantId: string,
    eventName: ReportingEventName,
    dayStart: Date,
    weekStart: Date,
    monthStart: Date,
    nowMs: number,
    tombstonedSubjects: Set<string>
  ): ReportingCounts {
    return {
      day: countEvents(tenantId, eventName, dayStart.getTime(), nowMs, tombstonedSubjects),
      week: countEvents(tenantId, eventName, weekStart.getTime(), nowMs, tombstonedSubjects),
      month: countEvents(tenantId, eventName, monthStart.getTime(), nowMs, tombstonedSubjects),
    };
  }

  function countEvents(
    tenantId: string,
    eventName: ReportingEventName,
    from: number,
    to: number,
    tombstonedSubjects: Set<string>
  ): number {
    const events = deps.store.listEvents({ tenantId, from, to, eventNames: [eventName] });
    return filterTombstoned(events, tombstonedSubjects).length;
  }

  function hasEvent(
    tenantId: string,
    eventName: ReportingEventName,
    from: number,
    to: number,
    tombstonedSubjects: Set<string>
  ): boolean {
    return countEvents(tenantId, eventName, from, to, tombstonedSubjects) > 0;
  }

  async function getTimeseries(params: {
    tenantId: string;
    metric: ReportingMetric;
    bucket: ReportingBucketSize;
    from: Date;
    to: Date;
  }): Promise<ReportingTimeseries> {
    const fromMs = params.from.getTime();
    const toMs = params.to.getTime();
    const eventName = METRIC_EVENT_MAP[params.metric];
    const events = deps.store.listEvents({
      tenantId: params.tenantId,
      from: fromMs,
      to: toMs,
      eventNames: [eventName],
    });
    const tombstonedSubjects = await listTombstonedSubjects(params.tenantId);
    const filteredEvents = filterTombstoned(events, tombstonedSubjects);

    const alignedStart = alignToBucket(params.from, params.bucket);
    const series: ReportingTimeseriesBucket[] = [];
    let cursor = alignedStart;

    while (cursor.getTime() < toMs) {
      const next = addBucket(cursor, params.bucket);
      const bucketStart = cursor.getTime() < fromMs ? new Date(fromMs) : cursor;
      const bucketEnd = next.getTime() > toMs ? new Date(toMs) : next;
      if (bucketStart.getTime() < bucketEnd.getTime()) {
        const count = filteredEvents.filter(
          (event) => event.at >= bucketStart.getTime() && event.at < bucketEnd.getTime()
        ).length;
        series.push({
          start: bucketStart.toISOString(),
          end: bucketEnd.toISOString(),
          count,
        });
      }
      cursor = next;
    }

    return {
      metric: params.metric,
      bucket: params.bucket,
      from: params.from.toISOString(),
      to: params.to.toISOString(),
      series,
    };
  }

  function alignToBucket(date: Date, bucket: ReportingBucketSize): Date {
    if (bucket === "day") {
      return startOfDay(date);
    }
    if (bucket === "week") {
      return startOfWeek(date);
    }
    return startOfMonth(date);
  }

  function addBucket(date: Date, bucket: ReportingBucketSize): Date {
    if (bucket === "day") {
      return addDays(date, 1);
    }
    if (bucket === "week") {
      return addDays(date, 7);
    }
    return addMonths(date, 1);
  }

  return {
    getSummary,
    getTimeseries,
  };

  function filterTombstoned(events: ReportingEvent[], tombstonedSubjects: Set<string>): ReportingEvent[] {
    if (!tombstonedSubjects.size) {
      return events;
    }
    return events.filter((event) => !event.subjectId || !tombstonedSubjects.has(event.subjectId));
  }

  async function listTombstonedSubjects(tenantId: string): Promise<Set<string>> {
    if (!deps.tombstoneRepo) {
      return new Set();
    }
    const tombstones = await deps.tombstoneRepo.listTombstones(tenantId);
    const set = new Set(tombstones.map((record) => record.subjectId));
    return set;
  }
}

function computeRate(qualified: number, links: number): number {
  if (links <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((qualified / links) * 100));
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfWeek(date: Date): Date {
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff));
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}
