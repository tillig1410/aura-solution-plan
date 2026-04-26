import type { Booking } from "@/types/supabase";

export type ColorBy = "practitioner" | "service" | "state";

interface BookingForColor {
  status: Booking["status"];
  practitioner: { color: string } | null;
  service: { name: string } | null;
}

const SERVICE_COLOR_BY_KEYWORD: Array<{ match: RegExp; color: string }> = [
  { match: /couleur|coloration/i, color: "#c084fc" },
  { match: /m[èe]ch/i,             color: "#f59e0b" },
  { match: /barbe|moustache/i,     color: "#fb923c" },
  { match: /soin|massage|gommage/i, color: "#10b981" },
  { match: /coupe|brushing|shampoing/i, color: "#8b5cf6" },
];
const SERVICE_DEFAULT = "#64748b";

const STATE_COLOR: Record<Booking["status"], string> = {
  confirmed:   "#10b981",
  pending:     "#f59e0b",
  in_progress: "#3b82f6",
  completed:   "#475569",
  cancelled:   "#94a3b8",
  no_show:     "#ef4444",
};

export const getBookingColor = (booking: BookingForColor, colorBy: ColorBy, fallback: string): string => {
  if (booking.status === "cancelled" || booking.status === "no_show") return "#9ca3af";
  if (colorBy === "state") return STATE_COLOR[booking.status] ?? fallback;
  if (colorBy === "service" && booking.service?.name) {
    const hit = SERVICE_COLOR_BY_KEYWORD.find((r) => r.match.test(booking.service!.name));
    return hit?.color ?? SERVICE_DEFAULT;
  }
  return booking.practitioner?.color ?? fallback;
};
