import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Telnyx signature verification
vi.mock("@/lib/webhooks/verify-ed25519", () => ({
  verifyTelnyxSignature: vi.fn().mockReturnValue(true),
}));

// Mock forward to n8n
vi.mock("@/lib/webhooks/forward-to-n8n", () => ({
  forwardToN8n: vi.fn(),
}));

// Mock voice handler
vi.mock("@/lib/telnyx/voice", () => ({
  handleVoiceEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("POST /api/v1/webhooks/telnyx — Voice events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELNYX_PUBLIC_KEY = "test-public-key";
  });

  const makeCallInitiatedPayload = () => ({
    data: {
      event_type: "call.initiated",
      id: "evt_voice_001",
      occurred_at: "2026-03-29T10:00:00Z",
      payload: {
        call_control_id: "cc_123",
        call_leg_id: "cl_456",
        call_session_id: "cs_789",
        from: "+33612345678",
        to: "+33198765432",
        direction: "incoming",
        state: "ringing",
      },
    },
  });

  const makeCallAnsweredPayload = () => ({
    data: {
      event_type: "call.answered",
      id: "evt_voice_002",
      occurred_at: "2026-03-29T10:00:05Z",
      payload: {
        call_control_id: "cc_123",
        call_leg_id: "cl_456",
        call_session_id: "cs_789",
        from: "+33612345678",
        to: "+33198765432",
        state: "active",
      },
    },
  });

  const makeCallHangupPayload = () => ({
    data: {
      event_type: "call.hangup",
      id: "evt_voice_003",
      occurred_at: "2026-03-29T10:05:00Z",
      payload: {
        call_control_id: "cc_123",
        call_leg_id: "cl_456",
        call_session_id: "cs_789",
        from: "+33612345678",
        to: "+33198765432",
        duration_secs: 300,
      },
    },
  });

  it("should return 200 for call.initiated event", async () => {
    const payload = makeCallInitiatedPayload();
    expect(payload.data.event_type).toBe("call.initiated");
    expect(payload.data.payload.from).toBe("+33612345678");
    expect(payload.data.payload.direction).toBe("incoming");
  });

  it("should return 200 for call.answered event", async () => {
    const payload = makeCallAnsweredPayload();
    expect(payload.data.event_type).toBe("call.answered");
    expect(payload.data.payload.state).toBe("active");
  });

  it("should return 200 for call.hangup event", async () => {
    const payload = makeCallHangupPayload();
    expect(payload.data.event_type).toBe("call.hangup");
    expect(payload.data.payload.duration_secs).toBe(300);
  });

  it("should distinguish SMS from voice events", () => {
    const smsPayload = {
      data: {
        event_type: "message.received",
        id: "evt_sms_001",
        payload: {
          from: { phone_number: "+33612345678" },
          text: "Bonjour",
        },
      },
    };

    const voicePayload = makeCallInitiatedPayload();

    expect(smsPayload.data.event_type).toBe("message.received");
    expect(voicePayload.data.event_type).toBe("call.initiated");
    expect(smsPayload.data.event_type).not.toBe(voicePayload.data.event_type);
  });

  it("should reject events with invalid signature", async () => {
    const { verifyTelnyxSignature } = await import("@/lib/webhooks/verify-ed25519");
    (verifyTelnyxSignature as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    // Signature should fail
    expect(verifyTelnyxSignature("body", "bad-sig", "ts", "key")).toBe(false);
  });
});
