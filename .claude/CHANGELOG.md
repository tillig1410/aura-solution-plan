# CHANGELOG — AurA Solutions

> Suivi des modifications du projet. Mis à jour après chaque session de développement.
> Format : `[TYPE] Description — fichier(s) modifié(s)`

---

## [0.6.0] — 2026-03-29 — Audit OWASP final ✅

### Sécurité (corrigé)
- `[SECURITY]` IDOR sur `PATCH /bookings/:id` — vérification merchant + `crossTenantBlocked`
- `[SECURITY]` Fuite `error.message` Supabase → messages génériques, détails en log serveur uniquement
- `[CONFIG]` Images Docker pinées : n8n `1.93.0`, certbot `v3.3.0`
- `[CONFIG]` Security headers ajoutés dans `next.config.ts`

### Restant (non bloquant)
- `[NOTE]` CSP `unsafe-inline` nginx — requis par l'UI n8n, non modifiable
- `[NOTE]` `availability.ts` — `${date}` interpolé dans `.or()` — sûr tant que l'appelant valide le format
- `[NOTE]` `createAdminClient` exporté — à restreindre si l'app grossit (LOW)
- `[NOTE]` IPs en clair dans les logs — documenter politique RGPD (LOW)

### Bilan global
- ✅ 14 vulnérabilités OWASP initiales corrigées
- ✅ 18 corrections code-review #2 appliquées
- ✅ 4 corrections OWASP supplémentaires
- ✅ `tsc --noEmit` passe sans erreur
- 🟢 **Posture sécurité : SOLIDE — prêt pour la prod**

---

## [0.5.0] — 2026-03-29 — Corrections code-review #2 (18 points)

### Bugs corrigés
- `[FIX] #1` — Régénération types Supabase — `InsertDto` ne résolvait plus en `never` — `src/types/supabase.ts`
- `[FIX] #2` — Ajout `merchant_id` à la PK de `practitioner_services` — `003_create_services.sql:32`
- `[FIX] #3` — Quote de la valeur `date` dans `.or()` PostgREST — `availability.ts:48`
- `[FIX] #4` — `try-catch` sur `request.json()` dans `bookings/[id]/route.ts`
- `[FIX] #5` — Migrations manquantes créées : `tips`, `packages`, `client_packages`, `client_subscriptions`, `loyalty_programs`, vues `tips_by_practitioner` et `booking_stats`

### Sécurité
- `[SECURITY] #6` — Validation Zod ajoutée sur POST/PATCH bookings (UUIDs, datetimes, enums)
- `[SECURITY] #7` — Limite de taille 1MB sur les webhooks (vérification `Content-Length`)
- `[SECURITY] #8` — Validation format `traceId` (`/^[0-9a-f-]{36}$/`) avant injection dans les logs

### Qualité
- `[PERF] #9` — `forward-to-n8n.ts` : fire-and-forget remplacé par queue Bull+Redis avec retry
- `[PERF] #10` — Index composite ajouté : `bookings(merchant_id, starts_at)`
- `[FIX] #11` — Body de réponse WhatsApp API parsé dans `channels/send.ts`
- `[FIX] #12` — `rate-limit.ts` : ajout `MAX_KEYS` + `setInterval` cleanup (évite fuite mémoire)
- `[FIX] #13` — Guard `if (!phoneNumber) return null` ajouté dans `normalize.ts:106`

### Conventions & Configuration
- `[REFACTOR] #14` — Format d'erreur API standardisé : `{ error, code?, traceId? }` sur toutes les routes
- `[CONFIG] #15` — `.env.example` complété : `GOOGLE_AI_API_KEY`, `WHATSAPP_PHONE_NUMBER_ID`, `STRIPE_WEBHOOK_ENDPOINT`
- `[CONFIG] #16` — Redis : `--requirepass` + `--appendonly yes` ajoutés dans `docker-compose.yml`
- `[CONFIG] #17` — Nginx : `Content-Security-Policy` ajouté aux headers de sécurité

### Sécurité basses (B1, B2, B3)
- `[SECURITY] B1` — Logging structuré JSON avec `trace ID` propagé sur toutes les routes API
- `[SECURITY] B2` — Validation URLs de redirection avec allowlist de domaines autorisés
- `[SECURITY] B3` — n8n configuré derrière reverse proxy HTTPS (Nginx + Let's Encrypt)

---

## [0.4.0] — 2026-03-29 — Phase 3 : Réservation Conversationnelle MVP

### Ajouté
- `[FEAT]` Webhook WhatsApp entrant avec validation HMAC
- `[FEAT]` Workflow n8n : réception message → Gemini (intent) → dispo Supabase → booking → confirmation
- `[FEAT]` Réponse WhatsApp de confirmation avec détails RDV
- `[FEAT]` Gestion des cas limites : pas de dispo, service inconnu, client nouveau

---

## [0.3.0] — 2026-03-29 — Corrections sécurité (code-review)

### Sécurité
- `[FIX] C1` — Implémentation vérification signature ed25519 Telnyx sur webhooks entrants
- `[FIX] C2` — Allowlist des champs autorisés sur `PATCH /api/v1/bookings/:id`
- `[FIX] H1` — Remplacement par `crypto.timingSafeEqual` natif pour comparaison des signatures
- `[FIX] H2` — Ajout `try-catch` sur `JSON.parse` dans tous les webhooks (Stripe, Telnyx, WhatsApp)
- `[FIX] H3` — Statut forcé à la création des bookings
- `[FIX] H4` — Correction des patterns middleware pour les route groups Next.js
- `[FIX] H5` — Sanitisation des inputs avant injection dans le prompt Gemini
- `[FIX] M2` — Rejet des secrets vides au démarrage de l'application
- `[FIX] M3` — Vérification FK cross-tenant avant chaque insert en base

---

## [0.2.0] — 2026-03-29 — Phase 2 : Dashboard commerçant

### Ajouté
- `[FEAT]` Page Agenda — vue semaine/jour, fiche client, statut payé/non payé, bouton encaissement
- `[FEAT]` API `GET /api/v1/bookings` — liste des RDV avec filtres
- `[FEAT]` API `POST /api/v1/bookings` — création RDV
- `[FEAT]` API `PATCH /api/v1/bookings/:id` — modification/annulation
- `[FEAT]` API `POST /api/v1/bookings/:id/noshow` — marquage no-show + notification + blocage après 3

---

## [0.1.0] — 2026-03-29 — Phase 1 : Fondations

### Infrastructure
- `[INIT]` Setup projet Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- `[INIT]` Configuration Supabase Auth (email + mot de passe + Magic Link)
- `[INIT]` Middleware Next.js — protection des routes dashboard

### Base de données (migrations Supabase)
- `[DB]` `001_create_merchants.sql` — table merchants
- `[DB]` `002_create_practitioners.sql` — table practitioners
- `[DB]` `003_create_services.sql` — table services + categories
- `[DB]` `004_create_clients.sql` — table clients
- `[DB]` `005_create_bookings.sql` — table bookings + availability
- `[DB]` `006_create_conversations_messages.sql` — tables conversations + messages
- `[DB]` `007_create_payments_tips.sql` — tables payments + tips (pourboires nominatifs)
- `[DB]` `008_create_subscriptions_loyalty.sql` — tables subscriptions + loyalty_programs
- `[DB]` RLS policies sur toutes les tables (isolation par merchant_id)
- `[DB]` Vues : `tips_by_practitioner`, `tips_history`

### Sécurité initiale
- `[SECURITY]` Validation HMAC sur webhooks entrants (Stripe, WhatsApp, Telnyx)
- `[SECURITY]` Idempotency keys sur PaymentIntents Stripe
- `[SECURITY]` Configuration Infisical vault pour les secrets

---

## Template pour les prochaines entrées

```
## [X.Y.Z] — YYYY-MM-DD — Titre de la release

### Ajouté
- `[FEAT]` Description — fichier(s)

### Modifié
- `[UPDATE]` Description — fichier(s)

### Corrigé
- `[FIX]` Description — fichier(s)

### Sécurité
- `[SECURITY]` Description — fichier(s)

### Supprimé
- `[REMOVE]` Description — fichier(s)
```

---

> **Comment l'utiliser avec Claude Code :**
> Après chaque session, dis à Claude Code :
> `"Mets à jour CHANGELOG.md avec les modifications de cette session"`
> Il ajoutera automatiquement une nouvelle entrée en haut du fichier.
