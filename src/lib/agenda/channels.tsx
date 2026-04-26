import {
  MessageSquare,
  MessageCircle,
  Send,
  Phone,
  PhoneCall,
  Monitor,
  Globe,
} from "lucide-react";
import type { Booking } from "@/types/supabase";

interface Props {
  channel: Booking["source_channel"];
  size?: number;
  className?: string;
}

const CHANNEL_COLOR: Record<Booking["source_channel"], string> = {
  whatsapp: "#22c55e",
  messenger: "#3b82f6",
  telegram: "#0ea5e9",
  sms: "#6b7280",
  voice: "#a855f7",
  dashboard: "#6b7280",
  booking_page: "#6366f1",
};

export const ChannelIcon = ({ channel, size = 12, className = "" }: Props) => {
  const Icon =
    channel === "whatsapp" ? MessageSquare
    : channel === "messenger" ? MessageCircle
    : channel === "telegram" ? Send
    : channel === "sms" ? Phone
    : channel === "voice" ? PhoneCall
    : channel === "booking_page" ? Globe
    : Monitor;
  return <Icon className={className} style={{ width: size, height: size, color: CHANNEL_COLOR[channel] }} />;
};
