# Webhook Contracts

**Branch**: `001-saas-reservation-ia` | **Date**: 2026-03-28

Tous les webhooks entrants sont validés par signature HMAC (Constitution Principe V). Chaque webhook normalise le message en format unifié avant envoi à n8n.

---

## POST /api/v1/webhooks/stripe

**Signature** : Header `Stripe-Signature`, vérifié via `stripe.webhooks.constructEvent()`.

**Events traités** :
- `payment_intent.succeeded` — Marque le paiement comme reçu, attribue le pourboire au praticien
- `payment_intent.payment_failed` — Notifie le commerçant
- `customer.subscription.updated` — Met à jour le statut abonnement client
- `customer.subscription.deleted` — Annule l'abonnement client
- `account.updated` — Met à jour le statut Stripe Connect du commerçant
- `invoice.paid` — Confirme le paiement de l'abonnement Plan du commerçant
- `invoice.payment_failed` — Notifie le commerçant d'un échec de paiement

**Idempotency** : Chaque event est dédup par `event.id` (stocké en base, ignoré si déjà traité).

---

## POST /api/v1/webhooks/whatsapp

**Signature** : Header `X-Hub-Signature-256`, validé HMAC SHA-256 avec le app secret.

**Payload normalisé** :
```json
{
  "channel": "whatsapp",
  "sender_id": "33612345678",
  "merchant_id": "uuid (résolu via le numéro business)",
  "content": "Je voudrais un RDV coupe mercredi",
  "timestamp": "ISO8601",
  "metadata": {
    "message_id": "wamid.xxx",
    "profile_name": "Jean Dupont"
  }
}
```

---

## POST /api/v1/webhooks/messenger

**Signature** : Header `X-Hub-Signature-256`, validé HMAC SHA-256.

**Payload normalisé** : Même format unifié, `channel: "messenger"`, `sender_id` = PSID Messenger.

---

## POST /api/v1/webhooks/telegram

**Signature** : Validé via secret token dans l'URL du webhook (`/api/v1/webhooks/telegram?token=SECRET`).

**Payload normalisé** : Même format unifié, `channel: "telegram"`, `sender_id` = chat.id Telegram.

---

## POST /api/v1/webhooks/telnyx

**Signature** : Header `telnyx-signature-ed25519`, validé par public key Telnyx.

**Events traités** :
- `call.initiated` — Appel entrant, déclenche le flow IA vocal
- `call.answered` — Début de l'enregistrement/transcription
- `call.hangup` — Fin de l'appel, sauvegarde de la transcription
- `message.received` — SMS entrant

**Payload normalisé SMS** :
```json
{
  "channel": "sms",
  "sender_id": "33612345678",
  "merchant_id": "uuid (résolu via le numéro Telnyx)",
  "content": "Bonjour, je voudrais un RDV",
  "timestamp": "ISO8601",
  "metadata": { "telnyx_message_id": "xxx" }
}
```

**Payload normalisé Voice** :
```json
{
  "channel": "voice",
  "sender_id": "33612345678",
  "merchant_id": "uuid",
  "content": "(transcription Gemini STT)",
  "timestamp": "ISO8601",
  "metadata": {
    "call_id": "xxx",
    "duration_seconds": 120,
    "recording_url": "https://..."
  }
}
```

---

## Webhook → n8n (sortant)

Après normalisation, chaque webhook envoie le message unifié vers n8n via HTTP POST sur le webhook trigger n8n.

**URL** : `https://n8n.plan-app.com/webhook/booking-conversation`

**Headers** :
- `X-Trace-Id` : UUID de traçabilité bout en bout
- `X-Webhook-Source` : Nom du canal (`whatsapp`, `messenger`, `telegram`, `sms`, `voice`)

**Body** : Message unifié (voir format dans research.md R2).
