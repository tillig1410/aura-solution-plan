import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

// ---------- Types ----------

type Period = "today" | "week" | "month" | "quarter" | "year";

interface PeriodRange {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
}

interface BookingRow {
  id: string;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
  starts_at: string;
  source_channel: string;
  client_id: string;
  practitioner_id: string;
  service: { price_cents: number; name: string } | null;
  practitioner: { id: string; name: string; color: string } | null;
  client: { id: string; name: string | null } | null;
}

type BookingStatus = BookingRow["status"];

interface PrevBookingRow {
  id: string;
  status: BookingStatus;
  starts_at: string;
  service: { price_cents: number } | null;
}

interface TipRow {
  id: string;
  amount_cents: number;
  practitioner_id: string;
  client_id: string;
  practitioner: { id: string; name: string; color: string } | null;
  client: { id: string; name: string | null } | null;
}

interface PrevTipRow {
  amount_cents: number;
}

interface ClientRow {
  id: string;
  created_at: string;
}

// ---------- Period helpers ----------

const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfDay = (d: Date): Date => {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
};

const endOfDay = (d: Date): Date => {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
};

const computePeriod = (period: Period): PeriodRange => {
  const now = new Date();

  let from: Date;
  let to: Date;

  switch (period) {
    case "today": {
      from = startOfDay(now);
      to = endOfDay(now);
      break;
    }
    case "week": {
      from = getMonday(now);
      to = new Date(from);
      to.setDate(from.getDate() + 6);
      to = endOfDay(to);
      break;
    }
    case "month": {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
      break;
    }
    case "year": {
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    }
  }

  const durationMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - durationMs - 1);
  const prevTo = new Date(from.getTime() - 1);

  return { from, to, prevFrom, prevTo };
};

// ---------- Aggregation helpers ----------

const deltaPct = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

const iterateDays = (from: Date, to: Date): string[] => {
  const days: string[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const limit = new Date(to);
  limit.setHours(0, 0, 0, 0);
  while (cursor <= limit) {
    days.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const DAY_LABELS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

// ---------- Route handler ----------

/**
 * T087 — GET /api/v1/stats?period=month
 * period: today | week | month | quarter | year
 */
export async function GET(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", 401, { traceId });
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!merchant) {
    return apiError("Merchant not found", 404, { traceId });
  }

  const { searchParams } = new URL(request.url);
  const rawPeriod = searchParams.get("period") ?? "month";
  const validPeriods: Period[] = ["today", "week", "month", "quarter", "year"];
  const period: Period = validPeriods.includes(rawPeriod as Period)
    ? (rawPeriod as Period)
    : "month";

  const { from, to, prevFrom, prevTo } = computePeriod(period);
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const prevFromISO = prevFrom.toISOString();
  const prevToISO = prevTo.toISOString();

  // ---- 1. Current period bookings ----
  const { data: currentBookingsRaw, error: bookingsError } = await supabase
    .from("bookings")
    .select(
      `id, status, starts_at, source_channel, client_id, practitioner_id,
       service:services(price_cents, name),
       practitioner:practitioners(id, name, color),
       client:clients(id, name)`,
    )
    .eq("merchant_id", merchant.id)
    .gte("starts_at", fromISO)
    .lte("starts_at", toISO)
    .limit(10_000);

  if (bookingsError) {
    logger.error("stats.bookings_fetch_failed", { error: bookingsError.message, traceId });
    return apiError("Failed to fetch bookings", 500, { traceId });
  }

  const currentBookings = (currentBookingsRaw ?? []) as BookingRow[];

  // ---- 2. Previous period bookings ----
  const { data: prevBookingsRaw, error: prevBookingsError } = await supabase
    .from("bookings")
    .select(`id, status, starts_at, service:services(price_cents)`)
    .eq("merchant_id", merchant.id)
    .gte("starts_at", prevFromISO)
    .lte("starts_at", prevToISO)
    .limit(10_000);

  if (prevBookingsError) {
    logger.error("stats.prev_bookings_fetch_failed", { error: prevBookingsError.message, traceId });
    return apiError("Failed to fetch previous period bookings", 500, { traceId });
  }

  const prevBookings = (prevBookingsRaw ?? []) as PrevBookingRow[];

  // ---- 3. Current period tips ----
  const { data: currentTipsRaw, error: tipsError } = await supabase
    .from("tips")
    .select(
      `id, amount_cents, practitioner_id, client_id,
       practitioner:practitioners(id, name, color),
       client:clients(id, name)`,
    )
    .eq("merchant_id", merchant.id)
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .limit(10_000);

  if (tipsError) {
    logger.error("stats.tips_fetch_failed", { error: tipsError.message, traceId });
    return apiError("Failed to fetch tips", 500, { traceId });
  }

  const currentTips = (currentTipsRaw ?? []) as TipRow[];

  // ---- 4. Previous period tips (minimal) ----
  const { data: prevTipsRaw, error: prevTipsError } = await supabase
    .from("tips")
    .select(`amount_cents`)
    .eq("merchant_id", merchant.id)
    .gte("created_at", prevFromISO)
    .lte("created_at", prevToISO);

  if (prevTipsError) {
    logger.error("stats.prev_tips_fetch_failed", { error: prevTipsError.message, traceId });
    return apiError("Failed to fetch previous period tips", 500, { traceId });
  }

  const prevTips = (prevTipsRaw ?? []) as PrevTipRow[];

  // ---- 5. New clients this period ----
  const { data: newClientsRaw, error: newClientsError } = await supabase
    .from("clients")
    .select(`id, created_at`)
    .eq("merchant_id", merchant.id)
    .gte("created_at", fromISO)
    .lte("created_at", toISO);

  if (newClientsError) {
    logger.error("stats.new_clients_fetch_failed", { error: newClientsError.message, traceId });
    return apiError("Failed to fetch new clients", 500, { traceId });
  }

  const newClients = (newClientsRaw ?? []) as ClientRow[];

  // ---- 6. Previous period new clients count ----
  const { count: prevNewClientsCount, error: prevNewClientsError } = await supabase
    .from("clients")
    .select(`id`, { count: "exact", head: true })
    .eq("merchant_id", merchant.id)
    .gte("created_at", prevFromISO)
    .lte("created_at", prevToISO);

  if (prevNewClientsError) {
    logger.error("stats.prev_new_clients_fetch_failed", {
      error: prevNewClientsError.message,
      traceId,
    });
    return apiError("Failed to fetch previous period new clients", 500, { traceId });
  }

  // ---- 7. Inactive clients (no booking in last 90 days) ----
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Get all clients with at least one booking, then find last booking date
  const { data: recentBookingClientsRaw } = await supabase
    .from("bookings")
    .select(`client_id`)
    .eq("merchant_id", merchant.id)
    .gte("starts_at", ninetyDaysAgo.toISOString());

  const activeClientIds = new Set(
    (recentBookingClientsRaw ?? []).map((b: { client_id: string }) => b.client_id),
  );

  // All clients who have had at least one booking (ever)
  const { data: allBookingClientsRaw } = await supabase
    .from("bookings")
    .select(`client_id`)
    .eq("merchant_id", merchant.id);

  const allBookedClientIds = new Set(
    (allBookingClientsRaw ?? []).map((b: { client_id: string }) => b.client_id),
  );

  // Inactive = have had booking but not in last 90 days
  let inactiveCount = 0;
  for (const clientId of allBookedClientIds) {
    if (!activeClientIds.has(clientId)) {
      inactiveCount++;
    }
  }

  // ---- Aggregate ----

  // Revenue
  const currentRevenue = currentBookings
    .filter((b) => b.status === "completed")
    .reduce((sum, b) => sum + (b.service?.price_cents ?? 0), 0);

  const prevRevenueCompleted = prevBookings
    .filter((b) => b.status === "completed")
    .reduce((sum, b) => sum + (b.service?.price_cents ?? 0), 0);

  // Bookings counts
  const currentBookingsCount = currentBookings.length;
  const prevBookingsCount = prevBookings.length;

  // Fill rate (completed / settled bookings)
  const completed = currentBookings.filter((b) => b.status === "completed").length;
  const cancelled = currentBookings.filter((b) => b.status === "cancelled").length;
  const no_show = currentBookings.filter((b) => b.status === "no_show").length;
  const fillRate = Math.round((completed / Math.max(completed + cancelled + no_show, 1)) * 100);

  const prevCompleted = prevBookings.filter((b) => b.status === "completed").length;
  const prevCancelled = prevBookings.filter((b) => b.status === "cancelled").length;
  const prevNoShow = prevBookings.filter((b) => b.status === "no_show").length;
  const prevFillRate = Math.round(
    (prevCompleted / Math.max(prevCompleted + prevCancelled + prevNoShow, 1)) * 100,
  );

  // Tips
  const currentTipsTotal = currentTips.reduce((sum, t) => sum + t.amount_cents, 0);
  const prevTipsTotal = prevTips.reduce((sum, t) => sum + t.amount_cents, 0);

  // Revenue by day — with previous period mapped by day offset
  const days = iterateDays(from, to);
  const prevDays = iterateDays(prevFrom, prevTo);

  // Build prev revenue by offset index
  const prevRevenueByOffset: Map<number, number> = new Map();
  for (const b of prevBookings) {
    if (b.status !== "completed") continue;
    const dayStr = b.starts_at.slice(0, 10);
    const offsetIdx = prevDays.indexOf(dayStr);
    if (offsetIdx >= 0) {
      prevRevenueByOffset.set(offsetIdx, (prevRevenueByOffset.get(offsetIdx) ?? 0) + (b.service?.price_cents ?? 0));
    }
  }

  const revByDay: { date: string; current_cents: number; previous_cents: number }[] = days.map(
    (day, idx) => {
      const current = currentBookings
        .filter((b) => b.status === "completed" && b.starts_at.slice(0, 10) === day)
        .reduce((sum, b) => sum + (b.service?.price_cents ?? 0), 0);

      return { date: day, current_cents: current, previous_cents: prevRevenueByOffset.get(idx) ?? 0 };
    },
  );

  // Bookings by day
  const bookingsByDay: { date: string; count: number; completed: number; cancelled: number }[] =
    days.map((day) => {
      const dayBookings = currentBookings.filter((b) => b.starts_at.slice(0, 10) === day);
      return {
        date: day,
        count: dayBookings.length,
        completed: dayBookings.filter((b) => b.status === "completed").length,
        cancelled: dayBookings.filter((b) => b.status === "cancelled").length,
      };
    });

  // By channel
  const channelMap: Record<string, number> = {};
  for (const b of currentBookings) {
    channelMap[b.source_channel] = (channelMap[b.source_channel] ?? 0) + 1;
  }
  const total = Object.values(channelMap).reduce((s, c) => s + c, 0);
  const byChannel = Object.entries(channelMap).map(([channel, count]) => ({
    channel,
    count,
    pct: total > 0 ? Math.round((count / total) * 100) : 0,
  }));

  // Practitioners
  const practitionerMap: Map<
    string,
    {
      id: string;
      name: string;
      color: string;
      bookings_count: number;
      revenue_cents: number;
      completed: number;
      cancelled: number;
      no_show: number;
      tips_cents: number;
      serviceCount: Map<string, number>;
    }
  > = new Map();

  for (const b of currentBookings) {
    if (!b.practitioner) continue;
    const pid = b.practitioner.id;
    if (!practitionerMap.has(pid)) {
      practitionerMap.set(pid, {
        id: pid,
        name: b.practitioner.name,
        color: b.practitioner.color,
        bookings_count: 0,
        revenue_cents: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
        tips_cents: 0,
        serviceCount: new Map(),
      });
    }
    const p = practitionerMap.get(pid)!;
    p.bookings_count++;
    if (b.status === "completed") {
      p.revenue_cents += b.service?.price_cents ?? 0;
      p.completed++;
    }
    if (b.status === "cancelled") p.cancelled++;
    if (b.status === "no_show") p.no_show++;
    if (b.service?.name) {
      p.serviceCount.set(b.service.name, (p.serviceCount.get(b.service.name) ?? 0) + 1);
    }
  }

  for (const t of currentTips) {
    if (!practitionerMap.has(t.practitioner_id) && t.practitioner) {
      practitionerMap.set(t.practitioner_id, {
        id: t.practitioner_id,
        name: t.practitioner.name,
        color: t.practitioner.color,
        bookings_count: 0,
        revenue_cents: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
        tips_cents: 0,
        serviceCount: new Map(),
      });
    }
    const p = practitionerMap.get(t.practitioner_id);
    if (p) p.tips_cents += t.amount_cents;
  }

  const practitioners = Array.from(practitionerMap.values()).map((p) => {
    let topService: string | null = null;
    let maxCount = 0;
    for (const [svc, cnt] of p.serviceCount) {
      if (cnt > maxCount) {
        maxCount = cnt;
        topService = svc;
      }
    }
    const pFillRate = Math.round(
      (p.completed / Math.max(p.completed + p.cancelled + p.no_show, 1)) * 100,
    );
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      bookings_count: p.bookings_count,
      revenue_cents: p.revenue_cents,
      fill_rate: pFillRate,
      tips_cents: p.tips_cents,
      top_service: topService,
    };
  });

  // Tips by practitioner
  const tipsByPractMap: Map<
    string,
    { practitioner_id: string; name: string; color: string; total_cents: number; count: number }
  > = new Map();

  for (const t of currentTips) {
    if (!t.practitioner) continue;
    const pid = t.practitioner_id;
    if (!tipsByPractMap.has(pid)) {
      tipsByPractMap.set(pid, {
        practitioner_id: pid,
        name: t.practitioner.name,
        color: t.practitioner.color,
        total_cents: 0,
        count: 0,
      });
    }
    const tp = tipsByPractMap.get(pid)!;
    tp.total_cents += t.amount_cents;
    tp.count++;
  }
  const tipsByPractitioner = Array.from(tipsByPractMap.values()).sort(
    (a, b) => b.total_cents - a.total_cents,
  );

  // Top tipping clients
  const clientTipMap: Map<string, { client_id: string; name: string | null; total_cents: number }> =
    new Map();
  for (const t of currentTips) {
    const cid = t.client_id;
    if (!clientTipMap.has(cid)) {
      clientTipMap.set(cid, {
        client_id: cid,
        name: t.client?.name ?? null,
        total_cents: 0,
      });
    }
    clientTipMap.get(cid)!.total_cents += t.amount_cents;
  }
  const topTippingClients = Array.from(clientTipMap.values())
    .sort((a, b) => b.total_cents - a.total_cents)
    .slice(0, 5);

  // Clients section
  const newCount = newClients.length;
  const prevNewCount = prevNewClientsCount ?? 0;

  // Return rate: clients with > 1 booking in current period
  const clientBookingCount: Record<string, number> = {};
  for (const b of currentBookings) {
    clientBookingCount[b.client_id] = (clientBookingCount[b.client_id] ?? 0) + 1;
  }
  const returningClients = Object.values(clientBookingCount).filter((c) => c > 1).length;
  const totalUniqueClients = Object.keys(clientBookingCount).length;
  const returnRate =
    totalUniqueClients > 0 ? Math.round((returningClients / totalUniqueClients) * 100) : 0;

  // Top clients by revenue
  const clientRevenueMap: Map<
    string,
    { client_id: string; name: string | null; revenue_cents: number }
  > = new Map();
  for (const b of currentBookings) {
    if (b.status !== "completed") continue;
    if (!clientRevenueMap.has(b.client_id)) {
      clientRevenueMap.set(b.client_id, {
        client_id: b.client_id,
        name: b.client?.name ?? null,
        revenue_cents: 0,
      });
    }
    const entry = clientRevenueMap.get(b.client_id)!;
    entry.revenue_cents += b.service?.price_cents ?? 0;
    if (!entry.name && b.client?.name) entry.name = b.client.name;
  }
  const topClientsByRevenue = Array.from(clientRevenueMap.values())
    .sort((a, b) => b.revenue_cents - a.revenue_cents)
    .slice(0, 5);

  // Booking patterns
  const cancelRate =
    currentBookingsCount > 0 ? Math.round((cancelled / currentBookingsCount) * 100) : 0;
  const noshowRate =
    currentBookingsCount > 0 ? Math.round((no_show / currentBookingsCount) * 100) : 0;

  const hourMap: Record<number, number> = {};
  for (const b of currentBookings) {
    const h = new Date(b.starts_at).getHours();
    hourMap[h] = (hourMap[h] ?? 0) + 1;
  }
  const byHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: hourMap[h] ?? 0,
  }));

  const dowMap: Record<number, number> = {};
  for (const b of currentBookings) {
    const d = new Date(b.starts_at).getDay();
    dowMap[d] = (dowMap[d] ?? 0) + 1;
  }
  const byDayOfWeek = Array.from({ length: 7 }, (_, d) => ({
    day: d,
    label: DAY_LABELS_FR[d],
    count: dowMap[d] ?? 0,
  }));

  logger.info("stats.fetched", { merchantId: merchant.id, period, traceId });

  return NextResponse.json({
    period,
    from: fromISO,
    to: toISO,
    summary: {
      revenue_cents: currentRevenue,
      revenue_delta_pct: deltaPct(currentRevenue, prevRevenueCompleted),
      bookings_count: currentBookingsCount,
      bookings_delta_pct: deltaPct(currentBookingsCount, prevBookingsCount),
      fill_rate: fillRate,
      fill_rate_delta_pts: fillRate - prevFillRate,
      tips_total_cents: currentTipsTotal,
      tips_delta_pct: deltaPct(currentTipsTotal, prevTipsTotal),
    },
    revenue_by_day: revByDay,
    bookings_by_day: bookingsByDay,
    by_channel: byChannel,
    practitioners,
    tips_by_practitioner: tipsByPractitioner,
    top_tipping_clients: topTippingClients,
    clients: {
      new_count: newCount,
      new_delta_pct: deltaPct(newCount, prevNewCount),
      return_rate: returnRate,
      inactive_count: inactiveCount,
    },
    top_clients_by_revenue: topClientsByRevenue,
    booking_patterns: {
      cancel_rate: cancelRate,
      noshow_rate: noshowRate,
      by_hour: byHour,
      by_day_of_week: byDayOfWeek,
    },
  });
}
