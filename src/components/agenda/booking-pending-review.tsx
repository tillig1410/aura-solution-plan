"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CalendarClock,
  Clock,
  User,
  Scissors,
  Check,
  X,
  PenLine,
} from "lucide-react";
import type { Booking } from "@/types/supabase";

interface BookingWithDetails extends Booking {
  client: { id: string; name: string | null; phone: string | null; preferred_language: string; notes: string | null; loyalty_tier: string; loyalty_points: number } | null;
  practitioner: { id: string; name: string; color: string } | null;
  service: { id: string; name: string; duration_minutes: number; price_cents: number } | null;
}

interface BookingPendingReviewProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onRefuse: () => Promise<void>;
  onModify: () => void;
  booking: BookingWithDetails;
}

const BookingPendingReview = ({ open, onClose, onConfirm, onRefuse, onModify, booking }: BookingPendingReviewProps) => {
  const price = booking.service ? (booking.service.price_cents / 100).toFixed(2) : null;
  const dateLabel = new Date(booking.starts_at).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStart = new Date(booking.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const timeEnd = new Date(booking.ends_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const color = booking.practitioner?.color ?? "#6366f1";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            RDV à confirmer
            <span className="text-[10px] font-bold rounded-full px-2.5 py-1 bg-amber-100 text-amber-700">
              En attente
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {/* Practitioner */}
          {booking.practitioner && (
            <div className="flex justify-end">
              <span
                className="text-[10px] font-bold text-white px-2.5 py-1 rounded-full uppercase"
                style={{ backgroundColor: color }}
              >
                Avec {booking.practitioner.name}
              </span>
            </div>
          )}

          {/* Client */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {booking.client?.name ?? "Client inconnu"}
              </p>
              {booking.client?.phone && (
                <p className="text-xs text-gray-500">{booking.client.phone}</p>
              )}
            </div>
            {booking.source_channel !== "dashboard" && (
              <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                via {booking.source_channel}
              </span>
            )}
          </div>

          {/* Service */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <Scissors className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{booking.service?.name ?? "Service"}</p>
              <p className="text-xs text-gray-500">{booking.service?.duration_minutes} min</p>
            </div>
            {price && (
              <p className="text-lg font-bold text-gray-900">{price} €</p>
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

          {/* Notes */}
          {booking.client?.notes && (
            <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2">
              <p className="text-xs text-gray-600 italic">&ldquo;{booking.client.notes}&rdquo;</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={onConfirm}
            >
              <Check className="h-4 w-4" />
              Confirmer le RDV
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={onModify}
              >
                <PenLine className="h-3.5 w-3.5" />
                Modifier l&apos;horaire
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2 text-red-600 border-red-200 hover:bg-red-50"
                onClick={onRefuse}
              >
                <X className="h-3.5 w-3.5" />
                Refuser
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookingPendingReview;
