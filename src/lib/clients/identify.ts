import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Client, MessageChannel, InsertDto } from "@/types/supabase";

type ChannelIdField = "whatsapp_id" | "messenger_id" | "telegram_id" | "phone";

const CHANNEL_TO_FIELD: Record<MessageChannel, ChannelIdField> = {
  whatsapp: "whatsapp_id",
  messenger: "messenger_id",
  telegram: "telegram_id",
  sms: "phone",
  voice: "phone",
};

/**
 * Identify or create a client based on channel-specific ID.
 * Returns the existing client or creates a new one.
 */
export async function identifyClient(
  supabase: SupabaseClient<Database>,
  params: {
    merchantId: string;
    channel: MessageChannel;
    senderId: string;
    senderName?: string;
  },
): Promise<Client> {
  const { merchantId, channel, senderId, senderName } = params;
  const field = CHANNEL_TO_FIELD[channel];

  // Try to find existing client
  const { data: existing } = await supabase
    .from("clients")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq(field, senderId)
    .single();

  if (existing) {
    // Update name if we have a new one and current is empty
    if (senderName && !existing.name) {
      await supabase
        .from("clients")
        .update({ name: senderName })
        .eq("id", existing.id);
      return { ...existing, name: senderName };
    }
    return existing;
  }

  // Create new client
  const insertData: InsertDto<"clients"> = {
    merchant_id: merchantId,
    [field]: senderId,
    ...(senderName ? { name: senderName } : {}),
    ...(channel === "whatsapp" && senderId.match(/^\d+$/) ? { phone: `+${senderId}` } : {}),
  };

  const { data: newClient, error } = await supabase
    .from("clients")
    .insert(insertData)
    .select("*")
    .single();

  if (error) throw new Error("Failed to create client");
  if (!newClient) throw new Error("Client creation returned no data");

  return newClient;
}
