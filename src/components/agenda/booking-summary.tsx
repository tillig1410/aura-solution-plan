"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CalendarClock,
  Clock,
  User,
  Scissors,
  CreditCard,
  RotateCcw,
} from "lucide-react";
import type { Booking, Practitioner, Service, Client } from "@/types/supabase";

interface BookingWithDetails extends Booking {
  client: { id: string; name: string | null; phone: string | null; preferred_language: string } | null;
  practitioner: { id: string; name: string; color: string } | null;
  service: { id: string; name: string; duration_minutes: number; price_cents: number } | null;
}

interface BookingSummaryProps {
  open: boolean;
  onClose: () => void;
  onReschedule: () => void;
  booking: BookingWithDetails;
}

const STATUS_CONFIG: Record<Booking["status"], { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "bg-yellow-100 text-yellow-700" },
  confirmed: { label: "Confirmé", cls: "bg-green-100 text-green-700" },
  in_progress: { label: "En cours", cls: "bg-blue-100 text-blue-700" },
  completed: { label: "Terminé", cls: "bg-gray-100 text-gray-600" },
  cancelled: { label: "Annulé", cls: "bg-red-100 text-red-600" },
  no_show: { label: "Absent", cls: "bg-orange-100 text-orange-600" },
};

const BookingSummary = ({ open, onClose, onReschedule, booking }: BookingSummaryProps) => {
  const status = STATUS_CONFIG[booking.status];
  const price = booking.service ? (booking.service.price_cents / 100).toFixed(2) : null;
  const dateLabel = new Date(booking.starts_at).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStart = new Date(booking.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const timeEnd = new Date(booking.ends_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Résumé du rendez-vous</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Status badge */}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold rounded-full px-3 py-1 ${status.cls}`}>
              {status.label}
            </span>
            {booking.practitioner && (
              <span
                className="text-xs font-semibold text-white px-3 py-1 rounded-full"
                style={{ backgroundColor: booking.practitioner.color }}
              >
                {booking.practitioner.name}
              </span>
            )}
          </div>

          {/* Client */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {booking.client?.name ?? "Client inconnu"}
              </p>
              {booking.client?.phone && (
                <p className="text-xs text-gray-500">{booking.client.phone}</p>
              )}
            </div>
          </div>

          {/* Service */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <Scissors className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {booking.service?.name ?? "Service inconnu"}
              </p>
              <p className="text-xs text-gray-500">
                {booking.service?.duration_minutes} min
              </p>
            </div>
            {price && (
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{price} €</p>
              </div>
            )}
          </div>

          {/* Date + time */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <CalendarClock className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 capitalize">{dateLabel}</p>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                {timeStart} — {timeEnd}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          {booking.status !== "cancelled" && (
            <Button onClick={onReschedule} className="gap-2">
              <RotateCcw className="h-3.5 w-3.5" />
              Reprogrammer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BookingSummary;
