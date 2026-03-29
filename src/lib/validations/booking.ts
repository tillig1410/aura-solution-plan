import { z } from "zod";

const uuid = z.string().uuid();
const datetime = z.string().datetime({ offset: true });

const sourceChannelEnum = z.enum([
  "whatsapp",
  "messenger",
  "telegram",
  "sms",
  "voice",
  "dashboard",
  "booking_page",
]);

const statusEnum = z.enum([
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
]);

const cancelledByEnum = z.enum(["client", "merchant"]);

/** POST /api/v1/bookings */
export const createBookingSchema = z.object({
  client_id: uuid,
  practitioner_id: uuid,
  service_id: uuid,
  starts_at: datetime,
  ends_at: datetime,
  source_channel: sourceChannelEnum.optional().default("dashboard"),
});

/** PATCH /api/v1/bookings/:id */
export const updateBookingSchema = z
  .object({
    version: z.number().int().nonnegative(),
    status: statusEnum.optional(),
    starts_at: datetime.optional(),
    ends_at: datetime.optional(),
    practitioner_id: uuid.optional(),
    service_id: uuid.optional(),
    cancelled_by: cancelledByEnum.optional(),
  })
  .refine(
    (data) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { version, ...fields } = data;
      return Object.values(fields).some((v) => v !== undefined);
    },
    { message: "At least one field to update is required besides version" },
  );

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
