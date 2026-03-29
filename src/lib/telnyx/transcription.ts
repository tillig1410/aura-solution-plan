import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";

/**
 * T083 — Save a voice transcription as a message in conversations/messages.
 *
 * 1. Find or create active conversation for the client + voice channel
 * 2. Insert message with is_voice_transcription = true
 */
export const saveTranscription = async (
  supabase: SupabaseClient<Database>,
  merchantId: string,
  clientId: string,
  transcription: string,
  traceId?: string,
): Promise<{ conversationId: string; messageId: string } | null> => {
  // 1. Find or create conversation
  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("client_id", clientId)
    .eq("channel", "voice")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  let conversationId: string;

  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({
        merchant_id: merchantId,
        client_id: clientId,
        channel: "voice",
        is_active: true,
      })
      .select("id")
      .single();

    if (convError || !newConv) {
      logger.error("transcription.conv_create_failed", {
        error: convError?.message,
        clientId,
        traceId,
      });
      return null;
    }

    conversationId = newConv.id;
  }

  // 2. Save the transcription as a client message
  const { data: message, error: msgError } = await supabase
    .from("messages")
    .insert({
      merchant_id: merchantId,
      conversation_id: conversationId,
      sender: "client",
      content: transcription,
      is_voice_transcription: true,
    })
    .select("id")
    .single();

  if (msgError || !message) {
    logger.error("transcription.msg_save_failed", {
      error: msgError?.message,
      conversationId,
      traceId,
    });
    return null;
  }

  logger.info("transcription.saved", {
    conversationId,
    messageId: message.id,
    clientId,
    merchantId,
    traceId,
  });

  return { conversationId, messageId: message.id };
};
