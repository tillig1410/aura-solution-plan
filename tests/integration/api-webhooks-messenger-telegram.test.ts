import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests: POST /api/v1/webhooks/messenger + POST /api/v1/webhooks/telegram
 * Vérifie signature HMAC / token, parsing JSON, forwarding.
 */

vi.mock("@/lib/webhooks/verify-hmac", () => ({
  verifyHmacSha256: vi.fn(),
}));
vi.mock("@/lib/webhooks/normalize", () => ({
  normalizeMessenger: vi.fn(),
  normalizeTelegram: vi.fn(),
}));
vi.mock("@/lib/webhooks/forward-to-n8n", () => ({
  forwardToN8n: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  webhookLog: { received: vi.fn(), forwarded: vi.fn(), invalidPayload: vi.fn() },
  securityLog: { signatureRejected: vi.fn(), misconfiguration: vi.fn() },
}));

const { verifyHmacSha256 } = await import("@/lib/webhooks/verify-hmac");
const { normalizeMessenger, normalizeTelegram } = await import("@/lib/webhooks/normalize");
const { forwardToN8n } = await import("@/lib/webhooks/forward-to-n8n");
const { GET: MSG_GET, POST: MSG_POST } = await import("@/app/api/v1/webhooks/messenger/route");
const { POST: TG_POST } = await import("@/app/api/v1/webhooks/telegram/route");

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  process.env = originalEnv;
});

// ---- Messenger GET (webhook verification) ----------------------------------

describe("GET /api/v1/webhooks/messenger — vérification", () => {
  beforeEach(() => {
    process.env = { ...originalEnv, MESSENGER_VERIFY_TOKEN: "my-verify-token" };
  });

  it("retourne 200 avec challenge si token correct", async () => {
    const url = new URL("http://localhost/api/v1/webhooks/messenger");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", "my-verify-token");
    url.searchParams.set("hub.challenge", "challenge-123");

    const res = await MSG_GET(new NextRequest(url.toString()));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("challenge-123");
  });

  it("retourne 403 si token incorrect", async () => {
    const url = new URL("http://localhost/api/v1/webhooks/messenger");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", "wrong-token");
    url.searchParams.set("hub.challenge", "challenge-123");

    const res = await MSG_GET(new NextRequest(url.toString()));
    expect(res.status).toBe(403);
  });

  it("retourne 403 si mode n'est pas subscribe", async () => {
    const url = new URL("http://localhost/api/v1/webhooks/messenger");
    url.searchParams.set("hub.mode", "unsubscribe");
    url.searchParams.set("hub.verify_token", "my-verify-token");

    const res = await MSG_GET(new NextRequest(url.toString()));
    expect(res.status).toBe(403);
  });
});

// ---- Messenger POST --------------------------------------------------------

describe("POST /api/v1/webhooks/messenger — signature HMAC", () => {
  it("retourne 500 si MESSENGER_APP_SECRET non configuré", async () => {
    process.env = { ...originalEnv, MESSENGER_APP_SECRET: "" };

    const res = await MSG_POST(new NextRequest("http://localhost/api/v1/webhooks/messenger", {
      method: "POST",
      body: "{}",
    }));
    expect(res.status).toBe(500);
  });

  it("retourne 401 si signature HMAC invalide", async () => {
    process.env = { ...originalEnv, MESSENGER_APP_SECRET: "secret123" };
    vi.mocked(verifyHmacSha256).mockReturnValue(false);

    const res = await MSG_POST(new NextRequest("http://localhost/api/v1/webhooks/messenger", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=bad" },
      body: "{}",
    }));
    expect(res.status).toBe(401);
  });

  it("retourne 200 si signature valide et forward", async () => {
    process.env = { ...originalEnv, MESSENGER_APP_SECRET: "secret123" };
    vi.mocked(verifyHmacSha256).mockReturnValue(true);
    vi.mocked(normalizeMessenger).mockReturnValue({ channel: "messenger", text: "hello" } as ReturnType<typeof normalizeMessenger>);

    const res = await MSG_POST(new NextRequest("http://localhost/api/v1/webhooks/messenger", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=valid" },
      body: JSON.stringify({ entry: [] }),
    }));
    expect(res.status).toBe(200);
    expect(forwardToN8n).toHaveBeenCalled();
  });

  it("ne forward pas si normalize retourne null", async () => {
    process.env = { ...originalEnv, MESSENGER_APP_SECRET: "secret123" };
    vi.mocked(verifyHmacSha256).mockReturnValue(true);
    vi.mocked(normalizeMessenger).mockReturnValue(null);

    const res = await MSG_POST(new NextRequest("http://localhost/api/v1/webhooks/messenger", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=valid" },
      body: JSON.stringify({ entry: [] }),
    }));
    expect(res.status).toBe(200);
    expect(forwardToN8n).not.toHaveBeenCalled();
  });
});

// ---- Telegram POST ---------------------------------------------------------

describe("POST /api/v1/webhooks/telegram — token secret", () => {
  it("retourne 500 si TELEGRAM_WEBHOOK_SECRET non configuré", async () => {
    process.env = { ...originalEnv, TELEGRAM_WEBHOOK_SECRET: "" };

    const res = await TG_POST(new NextRequest("http://localhost/api/v1/webhooks/telegram", {
      method: "POST",
      body: "{}",
    }));
    expect(res.status).toBe(500);
  });

  it("retourne 401 si secret token incorrect", async () => {
    process.env = { ...originalEnv, TELEGRAM_WEBHOOK_SECRET: "correct-secret" };

    const res = await TG_POST(new NextRequest("http://localhost/api/v1/webhooks/telegram", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "wrong-secret" },
      body: "{}",
    }));
    expect(res.status).toBe(401);
  });

  it("retourne 200 si secret valide et forward", async () => {
    process.env = { ...originalEnv, TELEGRAM_WEBHOOK_SECRET: "correct-secret" };
    vi.mocked(normalizeTelegram).mockReturnValue({ channel: "telegram", text: "hello" } as ReturnType<typeof normalizeTelegram>);

    const res = await TG_POST(new NextRequest("http://localhost/api/v1/webhooks/telegram", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "correct-secret" },
      body: JSON.stringify({ message: { text: "hello" } }),
    }));
    expect(res.status).toBe(200);
    expect(forwardToN8n).toHaveBeenCalled();
  });

  it("retourne 400 si JSON malformé", async () => {
    process.env = { ...originalEnv, TELEGRAM_WEBHOOK_SECRET: "correct-secret" };

    const res = await TG_POST(new NextRequest("http://localhost/api/v1/webhooks/telegram", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "correct-secret" },
      body: "not-json",
    }));
    expect(res.status).toBe(400);
  });
});
