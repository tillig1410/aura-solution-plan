# Changelog

## [Unreleased] — 2026-03-29

### Corrections de bugs (bloquants prod)
- **Types Supabase** : Corrigé `InsertDto` qui résolvait en `never` — réécrits en types explicites (non auto-référencés) avec `Relationships[]` requis par supabase-js v2.100+. Les champs avec valeurs par défaut en BDD sont maintenant optionnels dans `Insert`. Corrigé aussi `identify.ts` qui passait un `Record<string, string>` au lieu d'un `InsertDto<"clients">`. **0 erreur TypeScript** après correction.
- **PK practitioner_services** : Ajouté `merchant_id` à la clé primaire composite `(merchant_id, practitioner_id, service_id)` pour garantir l'isolation multi-tenant au niveau BDD.
- **availability.ts `.or()`** : Quoté la valeur date dans le filtre PostgREST `.or()` pour éviter les erreurs de parsing.
- **try-catch `request.json()`** : Ajouté sur POST et PATCH `/api/v1/bookings` pour gérer les bodies JSON malformés.
- **Migrations manquantes** : Créé `008_create_tips.sql` (tips + vue `tips_by_practitioner`), `009_create_packages.sql` (packages + client_packages), `010_create_subscriptions_loyalty.sql` (client_subscriptions + loyalty_programs + vue `booking_stats`).

### Sécurité
- **Validation Zod** : Ajouté des schémas Zod (`createBookingSchema`, `updateBookingSchema`) pour valider UUIDs, datetimes ISO et enums sur les endpoints bookings.
- **Limite taille webhooks** : Rejet des payloads > 1MB via vérification `Content-Length` dans le middleware (HTTP 413).
- **Validation traceId** : Le traceId provenant du header `X-Trace-Id` est maintenant validé contre le format UUID avant injection dans les logs. Les traceIds invalides sont remplacés par un UUID généré.

### Qualité
- **Retry forward-to-n8n** : Remplacé le fire-and-forget par un retry avec backoff exponentiel (3 tentatives : 1s, 5s, 15s) sur les erreurs 5xx et réseau.
- **Index composite bookings** : Ajouté `idx_bookings_merchant_starts_at` sur `(merchant_id, starts_at)` pour optimiser les requêtes agenda.
- **Erreurs WhatsApp API** : Le body de réponse d'erreur est maintenant parsé pour extraire le message détaillé.
- **Rate limiter MAX_KEYS** : Ajouté une limite de 50 000 clés avec cleanup forcé au dépassement pour prévenir les fuites mémoire.
- **Guard normalize Telnyx SMS** : Ajouté vérification `if (!phoneNumber) return null` pour éviter un `sender_id` vide.

### Conventions
- **Format erreur API standardisé** : Toutes les réponses d'erreur suivent le format `{ error, code?, traceId?, details? }` via le helper `apiError()`.
- **`.env.example` complété** : Ajouté `GOOGLE_AI_API_KEY`, `WHATSAPP_PHONE_NUMBER_ID`, `STRIPE_WEBHOOK_ENDPOINT`, `REDIS_PASSWORD`.
- **Redis sécurisé** : Ajouté `--requirepass` et `--appendonly yes` dans docker-compose.
- **Content-Security-Policy** : Ajouté CSP + `Permissions-Policy` dans la config Nginx.

### Audit OWASP Phase 4 (cette session)
- **HIGH — IDOR PATCH /bookings/:id** : Ajouté vérification merchant ownership + cross-tenant check avant toute mise à jour
- **HIGH — Fuite structure BDD** : Remplacé `error.message` Supabase par messages génériques dans toutes les réponses API (erreur détaillée loggée côté serveur uniquement)
- **MEDIUM — Images Docker pinées** : n8n `1.93.0`, certbot `v3.3.0` (au lieu de `latest`)
- **MEDIUM — Security headers Next.js** : Ajouté `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` dans `next.config.ts`

### Audit OWASP Phases 1-3 (corrections précédentes)
- C1 : Vérification signature ed25519 Telnyx
- C2 : Allowlist champs PATCH bookings
- H1 : `crypto.timingSafeEqual` pour HMAC
- H2 : try-catch `JSON.parse` sur tous les webhooks
- H3 : Statut forcé à `pending` à la création
- H4 : Path matching middleware corrigé pour route groups
- H5 : Sanitisation prompt injection n8n/Gemini
- M1 : Rate limiting 3 tiers (webhook/api/auth)
- M2 : Guard `!secret` sur verify-hmac
- M3 : Vérification FK cross-tenant
- M4 : Timing-safe compare Telegram
- B1 : Logging structuré JSON avec trace ID
- B2 : Safe redirect (allowlist origines)
- B3 : Nginx reverse proxy HTTPS + Let's Encrypt
