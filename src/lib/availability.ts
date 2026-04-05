import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

interface TimeSlot {
  starts_at: string;
  ends_at: string;
}

interface ScheduleBlock {
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface BookingSlot {
  starts_at: string;
  ends_at: string;
  status: string;
}

/**
 * Get available time slots for a practitioner on a given date.
 *
 * 1. Load recurring schedule for the day_of_week
 * 2. Check for exception_date overrides (holidays, special hours)
 * 3. Subtract existing non-cancelled bookings
 * 4. Generate free slots based on service duration
 */
export async function getAvailableSlots(
  supabase: SupabaseClient<Database>,
  params: {
    merchantId: string;
    practitionerId: string;
    date: string; // YYYY-MM-DD
    durationMinutes: number;
  },
): Promise<TimeSlot[]> {
  const { merchantId, practitionerId, date, durationMinutes } = params;
  const targetDate = new Date(date + "T00:00:00");
  const dayOfWeek = (targetDate.getDay() + 6) % 7; // JS Sunday=0 → our Monday=0

  // 1. Get recurring schedule for this day
  const { data: scheduleRows } = await supabase
    .from("practitioner_availability")
    .select("start_time, end_time, is_available, exception_date")
    .eq("merchant_id", merchantId)
    .eq("practitioner_id", practitionerId)
    .or(`day_of_week.eq.${dayOfWeek},exception_date.eq."${date}"`);

  if (!scheduleRows || scheduleRows.length === 0) return [];

  // 2. Check for exception overrides
  const exceptions = scheduleRows.filter((r) => r.exception_date === date);
  const schedule: ScheduleBlock[] =
    exceptions.length > 0
      ? exceptions // Exception overrides recurring schedule
      : scheduleRows.filter((r) => !r.exception_date);

  // If all blocks are unavailable → no slots
  const availableBlocks = schedule.filter((b) => b.is_available);
  if (availableBlocks.length === 0) return [];

  // 3. Get existing bookings for this practitioner on this date
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;

  const { data: bookings } = await supabase
    .from("bookings")
    .select("starts_at, ends_at, status")
    .eq("merchant_id", merchantId)
    .eq("practitioner_id", practitionerId)
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd)
    .not("status", "in", '("cancelled","no_show")');

  const occupiedSlots: BookingSlot[] = bookings ?? [];

  // 4. Generate free slots
  const freeSlots: TimeSlot[] = [];

  for (const block of availableBlocks) {
    const blockStart = parseTimeToMinutes(block.start_time);
    const blockEnd = parseTimeToMinutes(block.end_time);

    for (let t = blockStart; t + durationMinutes <= blockEnd; t += 15) {
      const slotStart = minutesToISODateTime(date, t);
      const slotEnd = minutesToISODateTime(date, t + durationMinutes);

      // Check overlap with existing bookings
      const isOccupied = occupiedSlots.some((b) =>
        slotsOverlap(slotStart, slotEnd, b.starts_at, b.ends_at),
      );

      if (!isOccupied) {
        freeSlots.push({ starts_at: slotStart, ends_at: slotEnd });
      }
    }
  }

  return freeSlots;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToISODateTime(date: string, minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${date}T${h}:${m}:00`;
}

function slotsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as < be && ae > bs;
}
