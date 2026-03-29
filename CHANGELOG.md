# Changelog

## [0.9.0] — 2026-03-29 — Phase 6 : Paiements, Pourboires & Facturation (T061–T070)

### Stripe Integration
- **Webhook Stripe** : `POST /api/v1/webhooks/stripe` — validation signature SDK, idempotency par `event.id` (table `stripe_events`), routing vers handlers (`payment_intent.succeeded`, `subscription.updated/deleted`, `account.updated`, `invoice.paid/failed`)
- **Payment handler** : `handlePaymentSucceeded` — marque le booking payé + crée un pourboire nominatif attribué au praticien via metadata PaymentIntent
- **Stripe Connect** : Helper complet (création compte Standard, onboarding link, dashboard link, vérification statut) + routes API `POST /api/v1/stripe/connect` et `POST /api/v1/stripe/dashboard-link`
- **Payment Links** : Génération de sessions Checkout avec option pourboire intégrée (line items optionnels)
- **Abonnements** : Helper `subscription.ts` — grille tarifaire 1-7 sièges (16,90€–54,90€) + option voix (+7€–52€), coupon Early Adopter -30%, création/mise à jour/annulation Stripe Subscription

### API Routes
- **GET /api/v1/tips** : Liste paginée avec filtrage par praticien et période, joins praticien + client
- **GET /api/v1/tips/summary** : Agrégation par praticien (total, count, moyenne), classement décroissant

### Dashboard
- **Section Paiements** (onglet Paramètres) : Onboarding Stripe Connect (état connecté/non connecté), bouton Dashboard Stripe, statut pourboires nominatifs

### Migrations
- `012_create_stripe_events.sql` : Table d'idempotency pour les webhooks Stripe
- Types Supabase mis à jour avec `stripe_events`

### Tests
- `webhook-stripe.test.ts` : 5 tests (signature, idempotency, event routing, ack silencieux)
- `tip-attribution.test.ts` : 4 tests (attribution praticien, absence de tip, tip à 0, booking payé)

### Validation
- ✅ `tsc --noEmit` — 0 erreur
- ✅ 57/57 tests passent (hors 5 pré-existants dans agenda-day-view)

## [0.8.2] — 2026-03-29 — Corrections code-review #2 (8 points)

### Sécurité (critique)
- **Injection PostgREST** : `GET /api/v1/clients?search` — les métacaractères PostgREST (`%`, `_`, `.`, `,`, `(`, `)`) sont maintenant strippés du paramètre `search` avant injection dans `.or()`, empêchant la manipulation du filtre

### Bugs haute priorité
- **conversation-view.tsx** : `createClient()` wrappé dans `useMemo` (évite re-création à chaque render) + suppression des `eslint-disable` + `supabase` ajouté dans les deps du `useEffect` pour cleanup Realtime correct
- **messages/page.tsx** : Supprimé `eslint-disable react-hooks/exhaustive-deps` ; ajouté `supabase` dans les deps du `useCallback`
- **settings/page.tsx** : `saveMerchant()` vérifie maintenant `.error` de Supabase et throw si erreur (au lieu d'ignorer silencieusement)

### UX (moyenne)
- **Toast notifications** : Ajout de `sonner` — feedback succès/erreur sur toutes les opérations de sauvegarde (salon, services, horaires)
- **Confirmation suppression** : Dialog de confirmation avant désactivation d'un service (empêche les clics accidentels)

### Tests (moyenne)
- **api-bookings.test.ts** : Ajout de 2 tests vérifiant les appels mock Supabase (`.from()`, `.eq()`, `.gte()` avec les bons filtres)

### Performance (basse)
- **useMemo filtres** : `activeServices`, `activePractitioners` (services/page.tsx) et `filtered` (messages/page.tsx) sont maintenant mémorisés

### Validation
- ✅ `tsc --noEmit` — 0 erreur
- ✅ 16/16 tests api-bookings passent (dont 2 nouveaux)

## [0.8.1] — 2026-03-29 — Corrections code-review (8 points)

### Bugs fonctionnels (bloquants)
- **Service assignments persistées** : Nouvel endpoint `PUT /api/v1/practitioners/:id/services` + appel dans `PractitionerManager.handleSave` — les cases à cocher "Services assignés" sont maintenant sauvegardées en BDD (`practitioner_services`)
- **Rollback availability** : `PUT /api/v1/practitioners/:id/availability` — ajout d'un backup + best-effort rollback si le INSERT échoue après le DELETE (protection perte de données)

### Tests (importants)
- **`api-bookings.test.ts`** : Réécriture complète — appelle le vrai handler `GET()` via `NextRequest`, mock Supabase chainable injecté, tests auth 401/404, validation 400, réponse 200 avec contenu JSON réel
- **`agenda-day-view.test.ts`** : Réécriture complète — rend le composant `DayView` via `render()`, assertions DOM (noms des praticiens, noms clients, pause déjeuner, calcul top/height CSS), test de clic avec `fireEvent`

### Corrections moyennes
- **Week UTC** : `GET /api/v1/bookings?week_start` — calcul de fin de semaine via `Date.UTC()` au lieu de `new Date(string)` pour éviter les décalages DST (ex: +02:00 → perte d'un jour)
- **AI canaux** : `AiConfig` — supprimé le badge "Actif" hardcodé sur tous les canaux ; remplacé par "Configuration via intégration"

### Corrections mineures
- **`sort_order` race condition** : Ajout d'un commentaire documentant la race condition TOCTOU dans `POST /api/v1/services` et suggestion de migration (séquence Postgres)
- **`is_active` practitioners** : Ajout du champ `is_active` dans le schéma Zod de création + propagé dans l'INSERT

### Validation
- ✅ `tsc --noEmit` — 0 erreur

## [Unreleased] — 2026-03-29

### Phase 5 — US3 Catalogue Services & Configuration (T052–T060)

#### API Routes
- **Services CRUD** : `GET/POST /api/v1/services` (liste avec join practitioner_ids, validation Zod) + `PATCH/DELETE /api/v1/services/:id` (soft delete)
- **Practitioners CRUD** : `GET/POST /api/v1/practitioners` (join services+availability) + `PATCH /api/v1/practitioners/:id`
- **Availability** : `GET/PUT /api/v1/practitioners/:id/availability` (horaires récurrents + exceptions, stratégie DELETE+INSERT)

#### Pages Dashboard
- **Page Services** : 4 onglets (Services, Praticiens, Horaires, Fermetures) — liste, Dialog CRUD inline, durée/prix, dots praticiens
- **Page Paramètres** : 7 onglets (Mon salon, IA & Canaux, Paiements, Mon site, Fidélité, Équipe, Mon abonnement)

#### Composants
- **PractitionerManager** : Cartes praticiens avec avatars colorés, Dialog création/édition (12 couleurs, spécialités, services assignés, horaires 7 jours)
- **AiConfig** : Personnalité IA (nom, ton, langues fr/en/es/ar/pt), canaux, délai annulation

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
