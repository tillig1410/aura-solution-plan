import { logger } from "@/lib/logger";

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_API_BASE = "https://api.telnyx.com/v2";

const getTelnyxApiKey = (): string => {
  if (!TELNYX_API_KEY) {
    throw new Error("TELNYX_API_KEY is not configured");
  }
  return TELNYX_API_KEY;
};

// Track calls in fallback flow (event-driven instead of setTimeout)
const fallbackCalls = new Map<string, number>();

// Cleanup stale entries every 60s (in case call.speak.ended never arrives)
const FALLBACK_TTL_MS = 30_000;
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of fallbackCalls) {
    if (now - ts > FALLBACK_TTL_MS) {
      fallbackCalls.delete(id);
    }
  }
}, 60_000);

interface TelnyxCallPayload {
  call_control_id: string;
  call_leg_id: string;
  call_session_id: string;
  from: string;
  to: string;
  direction?: string;
  state?: string;
  duration_secs?: number;
}

interface VoiceEventData {
  event_type: string;
  id: string;
  occurred_at: string;
  payload: TelnyxCallPayload;
}

/**
 * T081 — Handle incoming voice events from Telnyx.
 * Routes to the appropriate action based on event type.
 */
export const handleVoiceEvent = async (
  data: VoiceEventData,
  merchantVoiceEnabled: boolean,
  traceId?: string,
): Promise<void> => {
  const { event_type, payload } = data;

  switch (event_type) {
    case "call.initiated":
      if (merchantVoiceEnabled) {
        await answerCall(payload.call_control_id, traceId);
      } else {
        await playFallbackAndHangup(payload.call_control_id, traceId);
      }
      break;

    case "call.answered":
      if (fallbackCalls.has(payload.call_control_id)) {
        await speakText(
          payload.call_control_id,
          "Bonjour. Ce salon utilise AurA pour ses réservations. Pour prendre rendez-vous, envoyez-nous un message par WhatsApp ou SMS. Merci et à bientôt !",
          traceId,
        );
      } else {
        await startGathering(payload.call_control_id, traceId);
      }
      break;

    case "call.speak.ended":
      if (fallbackCalls.has(payload.call_control_id)) {
        fallbackCalls.delete(payload.call_control_id);
        await hangupCall(payload.call_control_id, traceId);
        logger.info("telnyx.fallback_played", { callControlId: payload.call_control_id, traceId });
      }
      break;

    case "call.hangup":
      logger.info("telnyx.call_ended", {
        callControlId: payload.call_control_id,
        from: payload.from,
        durationSecs: payload.duration_secs,
        traceId,
      });
      break;

    case "call.gather.ended":
      // Speech gathered — will be forwarded to n8n for Gemini processing
      logger.info("telnyx.gather_ended", {
        callControlId: payload.call_control_id,
        traceId,
      });
      break;

    default:
      logger.info("telnyx.voice_event_unhandled", { event_type, traceId });
  }
};

/**
 * Answer an incoming call via Telnyx Call Control API.
 */
const answerCall = async (callControlId: string, traceId?: string): Promise<void> => {
  try {
    const res = await fetch(`${TELNYX_API_BASE}/calls/${callControlId}/actions/answer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getTelnyxApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error("telnyx.answer_failed", { callControlId, status: res.status, error: errText, traceId });
    } else {
      logger.info("telnyx.call_answered", { callControlId, traceId });
    }
  } catch (err) {
    logger.error("telnyx.answer_error", {
      callControlId,
      error: err instanceof Error ? err.message : "Unknown",
      traceId,
    });
  }
};

/**
 * Start gathering speech from the caller using Telnyx Speech Recognition.
 * The gathered text will be sent back as a webhook event (call.gather.ended).
 */
const startGathering = async (callControlId: string, traceId?: string): Promise<void> => {
  try {
    // First, play a greeting
    await speakText(
      callControlId,
      "Bonjour et bienvenue. Comment puis-je vous aider ? Vous pouvez me demander un rendez-vous, une annulation, ou toute autre information.",
      traceId,
    );

    // Then start gathering speech
    const res = await fetch(`${TELNYX_API_BASE}/calls/${callControlId}/actions/gather`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getTelnyxApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        minimum_digits: 1,
        maximum_digits: 128,
        timeout_millis: 10000,
        inter_digit_timeout_millis: 5000,
        valid_digits: "",
        // Use speech recognition
        gather_type: "speech",
        language: "fr-FR",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error("telnyx.gather_failed", { callControlId, status: res.status, error: errText, traceId });
    }
  } catch (err) {
    logger.error("telnyx.gather_error", {
      callControlId,
      error: err instanceof Error ? err.message : "Unknown",
      traceId,
    });
  }
};

/**
 * Play text-to-speech on an active call.
 */
export const speakText = async (
  callControlId: string,
  text: string,
  traceId?: string,
): Promise<void> => {
  try {
    const res = await fetch(`${TELNYX_API_BASE}/calls/${callControlId}/actions/speak`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getTelnyxApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: text,
        voice: "female",
        language: "fr-FR",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error("telnyx.speak_failed", { callControlId, status: res.status, error: errText, traceId });
    }
  } catch (err) {
    logger.error("telnyx.speak_error", {
      callControlId,
      error: err instanceof Error ? err.message : "Unknown",
      traceId,
    });
  }
};

/**
 * Hangup an active call.
 */
export const hangupCall = async (callControlId: string, traceId?: string): Promise<void> => {
  try {
    await fetch(`${TELNYX_API_BASE}/calls/${callControlId}/actions/hangup`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getTelnyxApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    logger.info("telnyx.call_hangup", { callControlId, traceId });
  } catch (err) {
    logger.error("telnyx.hangup_error", {
      callControlId,
      error: err instanceof Error ? err.message : "Unknown",
      traceId,
    });
  }
};

/**
 * T085 — Initiate fallback flow for salons without voice option.
 * Answers the call and registers it for fallback handling.
 * The speak + hangup happen event-driven via call.answered / call.speak.ended.
 */
const playFallbackAndHangup = async (callControlId: string, traceId?: string): Promise<void> => {
  fallbackCalls.set(callControlId, Date.now());
  await answerCall(callControlId, traceId);
};

/**
 * Extract voice event data from raw Telnyx webhook body.
 */
export const extractVoiceEvent = (body: Record<string, unknown>): VoiceEventData | null => {
  try {
    const data = body.data as Record<string, unknown>;
    if (!data) return null;

    const eventType = data.event_type as string;
    if (!eventType?.startsWith("call.")) return null;

    const payload = data.payload as TelnyxCallPayload;
    if (!payload?.call_control_id) return null;

    return {
      event_type: eventType,
      id: data.id as string,
      occurred_at: (data.occurred_at as string) ?? new Date().toISOString(),
      payload,
    };
  } catch {
    return null;
  }
};
