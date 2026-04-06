# Plan — Corrections Trail of Bits v1.4.1

## Context
3 audits Trail of Bits effectués (insecure-defaults, sharp-edges, supply-chain).
Résultat combiné : 2 CRITIQUE, 5 IMPORTANT, 2 MINEUR à corriger dans le code.
Les items d'infrastructure (Redis rate limiter, circuit breaker timeout) sont notés
comme dette technique V2 dans le CHANGELOG.

## Corrections à appliquer

### CRITIQUE

**C1 — WhatsApp webhook fail-open** `src/app/api/v1/webhooks/whatsapp/route.ts`
- Pattern: `process.env.WHATSAPP_APP_SECRET ?? ""`
- Fix: Ajouter check `if (!secret)` → return 500 "Server misconfiguration"
- Même pattern que Telnyx (qui a déjà ce check)

**C2 — Messenger webhook fail-open** `src/app/api/v1/webhooks/messenger/route.ts`
- Pattern: `process.env.MESSENGER_APP_SECRET ?? ""`
- Fix: Identique à C1

### IMPORTANT

**I1 — Telegram webhook fail-open** `src/app/api/v1/webhooks/telegram/route.ts`
- Pattern: `process.env.TELEGRAM_WEBHOOK_SECRET ?? ""`
- Fix: Ajouter check `if (!expectedToken)` → return 500

**I2 — n8n forward HTTPS non enforced** `src/lib/webhooks/forward-to-n8n.ts`
- Le code warn seulement en production, mais envoie quand même
- Fix: En production, bloquer (return early) au lieu de juste logger

**I3 — Content-Length manquant bypass size check** `src/middleware.ts`
- `parseInt("", 10)` retourne NaN → le check `> 1_048_576` passe
- Fix: Si Content-Length absent/invalide sur POST, rejeter avec 411 "Length Required"
- Appliquer sur webhooks ET routes API générales

**I4 — CSRF Origin manquant** `src/app/api/v1/booking/[slug]/reserve/route.ts`
- Si Origin header absent, le check est silencieusement skippé
- Fix: En production, exiger Origin header pour les POST publics

**I5 — QR code domaine hardcodé** `src/lib/utils/qr-code.ts`
- `process.env.NEXT_PUBLIC_APP_URL ?? "https://app.aura-book.fr"`
- Fix: Supprimer le fallback hardcodé, throw si absent

### MINEUR

**M1 — safe-redirect localhost en prod** `src/lib/safe-redirect.ts`
- Fallback `http://localhost:3000` en production si NEXT_PUBLIC_APP_URL manque
- Fix: Throw en production

**M2 — ed25519 silent catch** `src/lib/webhooks/verify-ed25519.ts`
- `catch { return false; }` sans logging
- Fix: Ajouter `console.error` dans le catch pour diagnostiquer les erreurs de parsing

## Fichiers modifiés (9 fichiers)
- `src/app/api/v1/webhooks/whatsapp/route.ts`
- `src/app/api/v1/webhooks/messenger/route.ts`
- `src/app/api/v1/webhooks/telegram/route.ts`
- `src/lib/webhooks/forward-to-n8n.ts`
- `src/middleware.ts`
- `src/app/api/v1/booking/[slug]/reserve/route.ts`
- `src/lib/utils/qr-code.ts`
- `src/lib/safe-redirect.ts`
- `src/lib/webhooks/verify-ed25519.ts`

## CHANGELOG v1.4.1
Ajouter section dans CHANGELOG.md avec les corrections Trail of Bits.

## Dette technique V2 (pas corrigé)
- Rate limiter in-memory → migrer vers Upstash Redis
- Circuit breaker sans timeout configurable
- Package consumption race condition sur expiry
- Supply chain : surveiller tw-animate-css, qrcode, clsx, cva, sonner
- Message normalization Zod schemas sur webhooks WhatsApp/Messenger

## Vérification
- `npm run build` — 0 erreur TypeScript
- Commit avec message descriptif
