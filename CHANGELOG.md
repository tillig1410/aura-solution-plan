# CHANGELOG — AurA Solutions

> Suivi des modifications du projet. Mis à jour après chaque session de développement.
> Format : `[TYPE] Description — fichier(s) modifié(s)`

---

## [1.2.2] — 2026-04-04 — Audit Stripe complet (skills stripe-best-practices + stripe-integration)

### Critique
- **[FIX] C1** — Validation UUID sur toutes les metadata webhook (`merchant_id`, `booking_id`, `client_id`, `practitioner_id`) — `payment-succeeded.ts`
- **[FIX] C2** — `handleInvoicePaid` Plan SaaS : update `updated_at` au lieu du no-op `stripe_subscription_id = itself` — `invoice-handlers.ts`
- **[FIX] C3** — Tests webhook mockent `createAdminClient` au lieu de `createClient` (aligné avec le vrai code) — `webhook-stripe.test.ts`
- **[FIX] C4** — `createSimplePaymentLink` : idempotency keys sur Product, Price et PaymentLink — `payment-links.ts`

### Important
- **[FEAT] I1** — Customer Portal Stripe : endpoint `POST /api/v1/stripe/customer-portal` + bouton "Gérer mon abonnement" dans Settings — `customer-portal/route.ts`, `settings-content.tsx`
- **[FIX] I2** — Prix dynamiques via `calculatePrice()` partagé au lieu de valeurs hardcodées dans le frontend — `pricing.ts`, `settings-content.tsx`
- **[FIX] I3** — Idempotency key sur `accounts.create` dans Connect (`connect_{merchantId}`) — `connect.ts`
- **[FEAT] I4** — Handlers `charge.refunded` (annule le booking) et `charge.dispute.created` (alerte critique) — `charge-handlers.ts`, `route.ts`
- **[FIX] I5** — `handlePaymentSucceeded` utilise `SupabaseClient<Database>` pour type-safety — `payment-succeeded.ts`
- **[FIX] I6** — `createPaymentCheckout` lève une erreur si `session.url` est null au lieu de retourner `""` — `payment-links.ts`

### Mineur
- **[FIX] M1** — `getOrCreateCustomer` : recherche par `metadata["merchant_id"]` au lieu d'email (évite collisions), accepte `stripeCustomerId` optionnel — `subscription.ts`
- **[FIX] M2** — `parseInt(tip_amount_cents ?? "0", 10)` protège contre `NaN` — `payment-succeeded.ts`
- **[FIX] M3** — Logging amélioré dans le catch webhook : inclut `eventId` et `stack` trace — `route.ts`

### Fichiers créés
- `src/lib/stripe/pricing.ts`
- `src/lib/stripe/handlers/charge-handlers.ts`
- `src/app/api/v1/stripe/customer-portal/route.ts`

### Fichiers modifiés
- `src/lib/stripe/handlers/payment-succeeded.ts`
- `src/lib/stripe/handlers/invoice-handlers.ts`
- `src/lib/stripe/connect.ts`
- `src/lib/stripe/payment-links.ts`
- `src/lib/stripe/subscription.ts`
- `src/app/api/v1/webhooks/stripe/route.ts`
- `src/app/api/v1/stripe/connect/route.ts`
- `src/components/settings/settings-content.tsx`
- `tests/integration/webhook-stripe.test.ts`

### Validation
- ✅ `next build` — 0 erreur, 0 warning TypeScript

---

## [1.2.1] — 2026-04-04 — Audit Stripe bloquants (skill stripe-best-practices)

### Sécurité Webhook
- **[FIX] S1** — Webhook route utilise `createAdminClient()` (service role, bypass RLS) au lieu de `createClient()` — `webhooks/stripe/route.ts`
- **[FIX] S2** — `STRIPE_WEBHOOK_SECRET` validé au démarrage du module avec `throw new Error()` si absent
- **[FEAT] S3** — Handlers `handleInvoicePaid` et `handleInvoicePaymentFailed` — distinguent abonnements Plan SaaS (`metadata.source === "plan-saas"`) des abonnements clients — `invoice-handlers.ts`

### Idempotence
- **[FIX] S4** — `createMerchantSubscription()` : paramètre `idempotencyKey` obligatoire passé à `stripe.subscriptions.create()` — `subscription.ts`
- **[FIX] S5** — `createPaymentCheckout()` : idempotency key (fallback `checkout_{booking_id}`) sur `checkout.sessions.create()` — `payment-links.ts`

### Connect v2
- **[FIX] S6** — Migration `type: "standard"` (v1) → propriétés `controller` (v2) : `stripe_dashboard.type: "full"`, `losses.payments: "stripe"`, `fees.payer: "account"` — `connect.ts`

### Fichiers créés
- `src/lib/stripe/handlers/invoice-handlers.ts`

### Validation
- ✅ `next build` — 0 erreur, 0 warning TypeScript

---

## [1.2.0] — 2026-04-04 — Audit Next.js Best Practices (skill nextjs-developer)

### Architecture Next.js

- **[REFACTOR] C3** — 9 pages migrées de Client Components monolithiques vers Server Components + Client Components feuilles : `agenda`, `clients`, `messages`, `services`, `settings`, `stats`, `login`, `onboarding`, `booking/[slug]` — code interactif extrait dans `src/components/*/`
- **[FEAT] C1** — `loading.tsx` ajouté dans `(dashboard)`, `(auth)`, `(booking)` — Suspense boundary automatique + fallback spinner pendant le chargement
- **[FEAT] C2** — `error.tsx` ajouté à la racine `app/` et dans `(dashboard)` — gestion gracieuse des erreurs avec bouton "Réessayer"
- **[FEAT] C4** — Metadata SEO : root layout avec `title.template "%s | Plan"` et description, `metadata` par page (Agenda, Clients, Messages, Services, Paramètres, Statistiques, Connexion, Onboarding), `generateMetadata` dynamique sur la page booking publique
- **[FEAT] I1** — `not-found.tsx` personnalisé avec lien retour dashboard
- **[FIX] I2** — Dashboard layout converti en Server Component async avec vérification auth côté serveur (`supabase.auth.getUser()` + `redirect("/login")`)
- **[FIX] I6** — Security headers complétés dans `next.config.ts` : HSTS (`max-age=63072000; includeSubDomains; preload`) + `X-DNS-Prefetch-Control`
- **[FIX] M1** — Page d'accueil remplace le template Next.js par un redirect `/agenda` (connecté) ou `/login` (non connecté)
- **[FIX] M2** — `<html lang="fr">` au lieu de `lang="en"`
- **[REFACTOR] M4** — `<Toaster>` extrait dans `ClientProviders` (`src/components/layout/client-providers.tsx`) pour isoler la directive `"use client"` du root layout Server Component

### Fichiers créés
- `src/app/(auth)/loading.tsx`
- `src/app/(booking)/loading.tsx`
- `src/app/(dashboard)/loading.tsx`
- `src/app/(dashboard)/error.tsx`
- `src/app/error.tsx`
- `src/app/not-found.tsx`
- `src/components/layout/client-providers.tsx`
- `src/components/agenda/agenda-content.tsx`
- `src/components/auth/login-content.tsx`
- `src/components/auth/onboarding-content.tsx`
- `src/components/booking/booking-content.tsx`
- `src/components/clients/clients-content.tsx`
- `src/components/messages/messages-content.tsx`
- `src/components/services/services-content.tsx`
- `src/components/settings/settings-content.tsx`
- `src/components/stats/stats-content.tsx`

### Validation
- ✅ `next build` — 0 erreur, 0 warning TypeScript
- ✅ `login` et `onboarding` prérendus statiquement (○)

---

## [1.1.0] — 2026-04-04 — Audit Postgres Best Practices (migrations 014–016)

### Base de données — Migrations

- **[DB] 014** — 3 index FK manquants (`notifications.client_id`, `messages(conversation_id, created_at DESC)`, `clients(merchant_id, created_at DESC)`) + 5 contraintes CHECK métier (`services.duration_minutes > 0`, `services.price_cents >= 0`, `merchants.seat_count > 0`, `bookings.ends_at > starts_at`, `client_packages.expires_at >= purchased_at`)
- **[DB] 015** — RLS performance : `auth.uid()` wrappé dans `(SELECT auth.uid())` sur 16 tables (jusqu'à 100× plus rapide) ; `FORCE ROW LEVEL SECURITY` sur 16 tables ; politiques granulaires SELECT/INSERT/UPDATE/DELETE + `service_role` sur toutes les tables ; `WITH CHECK` sur INSERT ; 7 index FK manquants (`clients.preferred_practitioner_id`, `clients.preferred_service_id`, `tips.booking_id`, `client_packages.package_id`, `client_subscriptions.service_id`, `practitioner_services` × 2)
- **[DB] 016** — Index redondants supprimés (`idx_bookings_merchant_id`, `idx_bookings_no_double_booking`) ; autovacuum agressif sur `bookings`, `messages`, `notifications` ; `booking_stats` et `tips_by_practitioner` converties en vues matérialisées ; `NOT NULL` sur `created_at`/`updated_at` (15 tables) ; `CHECK end_time > start_time` sur `practitioner_availability` ; validation email regex sur `merchants`, `practitioners`, `clients` ; extension `pg_stat_statements` activée

### Sécurité — Corrections code v1.0.2 → v1.1.0

- **[SEC] CSRF renforcé** — Comparaison stricte `new URL(origin).origin` sur la route réservation publique — `booking/[slug]/reserve/route.ts`
- **[SEC] Injection messagerie** — `sanitizeMessageText()` : strip caractères de contrôle, formatage WhatsApp, newlines — `src/lib/utils/sanitize.ts` (nouveau)
- **[SEC] RLS stripe_events** — RLS activé + politique `service_role` — `012_create_stripe_events.sql`
- **[SEC] RLS idempotence** — `DROP POLICY IF EXISTS` avant chaque `CREATE POLICY` — `013_security_constraints.sql`
- **[FIX] Validation Zod maxLength** — `clients` (name 255, phone 30, email 320, notes 5000), réservation publique (name 255, phone 30, email 320) — `clients/route.ts`, `reserve/route.ts`
- **[FIX] Dates invalides** — `isValidCalendarDate()` / `isValidCalendarMonth()` strict — `bookings/route.ts`
- **[FIX] Fire-and-forget** — `.catch()` explicite sur `handleNoShow`, `notifyClient`, `postWithRetry`
- **[FIX] Types Stripe/Supabase** — Suppression `as unknown as`, interface `PackageJoin` typée, cast `Record<string, unknown>` sur Invoice
- **[FIX] UI maxLength** — `maxLength={50}` + slice sur le champ nom IA — `ai-config.tsx`
- **[FIX] URL Supabase** — Typo corrigée dans `.env.local` (`zwvn` → `zvwn`)

### Déploiement

- Migrations 001–016 appliquées sur `resaapp-prod` (Supabase `txebdgmufdsnkrntzvwn`)

---

## [1.0.2] — 2026-03-29 — Security hardening (16 issues)

### Critical (2)

- **[SEC] Contrainte UNIQUE anti double-booking** — Migration `013_security_constraints.sql` : index `idx_bookings_no_double_booking (merchant_id, practitioner_id, starts_at) WHERE status != 'cancelled'` + gestion code 23505 dans `reserve/route.ts`
- **[SEC] Audit createAdminClient** — `booking/[slug]/route.ts` + `reserve/route.ts` : confirmé SELECT-only pour GET, ajout commentaires SECURITY sur les deux routes publiques

### High (5)

- **[SEC] RLS policies sur bookings** — Migration `013_security_constraints.sql` : policies `bookings_select_own`, `bookings_insert_own`, `bookings_update_own`, `bookings_delete_own` + `bookings_service_role` pour les routes publiques
- **[SEC] TELNYX_API_KEY throw si absent** — `src/lib/telnyx/voice.ts` : remplacement `?? ""` par `getTelnyxApiKey()` qui throw `Error("TELNYX_API_KEY is not configured")`
- **[SEC] Stripe idempotency robuste** — `webhooks/stripe/route.ts` : gestion `error.code === "23505"` comme succès idempotent, log + return 500 sur autres erreurs d'insertion
- **[SEC] Validation UUID metadata Stripe** — `subscription-updated.ts` : regex UUID sur `merchant_id` / `client_id` avant usage dans les deux handlers
- **[SEC] IP spoofing mitigation** — `middleware.ts` : priorité `x-vercel-forwarded-for` > `cf-connecting-ip` > `x-real-ip` > `x-forwarded-for`

### Medium (4)

- **[SEC] Health check sans anonKey** — `health/route.ts` : suppression des headers `apikey`/`Authorization` de la requête Supabase dans l'endpoint public
- **[SEC] CSRF origin check** — `reserve/route.ts` : vérification header `Origin` vs `NEXT_PUBLIC_APP_URL` / `VERCEL_URL`
- **[SEC] Float precision loyalty** — `loyalty/points.ts` : `Math.floor((amountCents * pointsPerEuro) / 100)` au lieu de `amountCents / 100 * pointsPerEuro`
- **[SEC] Contrainte UNIQUE clients(merchant_id, phone)** — Migration `013_security_constraints.sql` + gestion 23505 race condition dans `reserve/route.ts`

### Low (3)

- **[SEC] Fallback calls memory leak** — `voice.ts` : `fallbackCalls` converti de `Set` en `Map<string, number>` avec TTL 30s + cleanup interval 60s
- **[SEC] Optimistic lock packages is_active** — `packages/[id]/route.ts` : champ optionnel `expected_is_active` pour verrouillage optimiste + frontend envoie la valeur courante
- **[SEC] Seed SQL hardcoded UUID** — `seed.sql` : ajout warnings `LOCAL DEV ONLY`, `Do NOT run in staging or production`

### Fichiers créés
- `supabase/migrations/013_security_constraints.sql`

### Fichiers modifiés
- `src/middleware.ts`
- `src/app/api/v1/booking/[slug]/route.ts`
- `src/app/api/v1/booking/[slug]/reserve/route.ts`
- `src/app/api/v1/bookings/[id]/route.ts` (pas modifié — RLS couvre H1)
- `src/app/api/v1/webhooks/stripe/route.ts`
- `src/app/api/v1/health/route.ts`
- `src/app/api/v1/packages/[id]/route.ts`
- `src/lib/telnyx/voice.ts`
- `src/lib/stripe/handlers/subscription-updated.ts`
- `src/lib/loyalty/points.ts`
- `src/components/settings/packages-config.tsx`
- `supabase/seed.sql`

---

## [1.0.1] — 2026-03-29 — Corrections code-review v1.0.0 (11 issues)

### Critical

- **[FIX] Routes publiques booking bloquées par auth** — `src/middleware.ts` : ajout catégorie rate-limit `booking` (10/min), détection `/api/v1/booking/` avant `api`, bypass auth (même pattern que health/webhooks)
- **[FIX] Race condition no_show_count** — `src/app/api/v1/bookings/[id]/route.ts` : ajout `.eq("no_show_count", client.no_show_count)` + `.select("id")` au update, retry unique si lock échoue
- **[FIX] Validation seuils fidélité incomplète** — `src/app/api/v1/loyalty/route.ts` : query existing program AVANT validation, fusion valeurs existantes + requête pour validation cross-field sur PUT partiel

### Medium

- **[FIX] Import Loader2 inutilisé** — `src/components/settings/ai-config.tsx` : retrait de l'import
- **[FIX] Prop merchantId inutilisée** — `src/components/settings/loyalty-config.tsx` + `settings/page.tsx` : suppression interface + prop
- **[FIX] Comparaison dates string fragile** — `src/lib/packages/consume.ts` : `new Date(cp.expires_at) < new Date(now)` (2 occurrences)
- **[FIX] Health check Redis non fonctionnel** — `src/app/api/v1/health/route.ts` : Redis accédé par Bull/n8n, pas Next.js → `Promise.resolve({ status: "ok" })`
- **[FIX] setTimeout bloquant dans fallback vocal** — `src/lib/telnyx/voice.ts` : refactoring event-driven (`fallbackCalls` Set, `call.answered` → `speakText`, `call.speak.ended` → `hangupCall`)

### Minor

- **[FIX] Format réponse POST packages** — `src/app/api/v1/packages/route.ts` : `{ data: created }` au lieu de `created` seul
- **[FIX] PackagesConfig utilisait client Supabase browser** — Nouveau `src/app/api/v1/packages/[id]/route.ts` (PATCH handler), `packages-config.tsx` → `fetch PATCH`, retrait `createClient` + prop `merchantId`
- **[FIX] QR code Google Charts (déprécié)** — `npm install qrcode`, réécriture `src/lib/utils/qr-code.ts` avec `QRCode.toDataURL()`, `settings/page.tsx` → state + useEffect async

### Fichiers créés
- `src/app/api/v1/packages/[id]/route.ts`

### Fichiers modifiés
- `src/middleware.ts`
- `src/app/api/v1/bookings/[id]/route.ts`
- `src/app/api/v1/loyalty/route.ts`
- `src/app/api/v1/packages/route.ts`
- `src/app/api/v1/health/route.ts`
- `src/components/settings/ai-config.tsx`
- `src/components/settings/loyalty-config.tsx`
- `src/components/settings/packages-config.tsx`
- `src/app/(dashboard)/settings/page.tsx`
- `src/lib/packages/consume.ts`
- `src/lib/telnyx/voice.ts`
- `src/lib/utils/qr-code.ts`
- `package.json` / `package-lock.json` (ajout `qrcode` + `@types/qrcode`)

---

## [1.0.0] — 2026-03-29 — Phases 7, 8, 10, 11 : Fidélité, Téléphonie IA, Site Public, Polish (T071–T108)

### Phase 7 — Fidélité, Forfaits & Abonnements (T071–T078b)

#### Fichiers créés
- `src/app/api/v1/packages/route.ts` — GET (liste avec join service) + POST (création Zod, cross-tenant, auto sort_order)
- `src/lib/packages/consume.ts` — `consumePackage()` verrouillage optimiste remaining_uses + `hasActivePackageOrSubscription()` pour n8n
- `src/lib/loyalty/points.ts` — `addLoyaltyPoints()` (points_per_visit + points_per_euro) + `computeTier()` transitions Bronze/Silver/Gold
- `src/app/api/v1/loyalty/route.ts` — GET (fetch programme) + PUT (upsert avec validation gold > silver)
- `src/lib/stripe/handlers/subscription-updated.ts` — `handleSubscriptionUpdated()` + `handleSubscriptionDeleted()` Stripe status mapping
- `src/components/settings/loyalty-config.tsx` — Toggle activation, config points, paliers visuels Bronze/Silver/Gold
- `src/components/settings/packages-config.tsx` — Liste forfaits, toggle, Dialog création, sélecteur service
- `n8n/workflows/package-expiration-check.json` — Schedule 9h, forfaits expirant sous 7j, notifications personnalisées

#### Fichiers modifiés
- `src/app/api/v1/webhooks/stripe/route.ts` — Import + routing vers handlers subscription-updated/deleted
- `src/app/(dashboard)/settings/page.tsx` — Onglet fidélité → LoyaltyConfig, onglet paiements → PackagesConfig
- `n8n/workflows/booking-conversation.json` — Ajout nodes Check Client Packages + Check Client Subscriptions, contexte forfait dans prompt IA

### Phase 8 — Répondeur Téléphonique IA (T079–T085)

#### Fichiers créés
- `tests/integration/webhook-telnyx-voice.test.ts` — 5 tests (call events, SMS vs voice, signature rejection)
- `src/lib/telnyx/voice.ts` — `handleVoiceEvent()`, `answerCall()`, `startGathering()` (speech recognition), `speakText()` TTS, `hangupCall()`, `playFallbackAndHangup()` (non abonnés)
- `src/lib/telnyx/transcription.ts` — `saveTranscription()` insère messages with `is_voice_transcription = true`
- `n8n/workflows/voice-call-handler.json` — Voice webhook → identify client → Gemini prompt vocal optimisé (réponses courtes TTS) → speak + save

#### Fichiers modifiés
- `src/app/api/v1/webhooks/telnyx/route.ts` — Réécriture complète : SMS + Voice events, gather.ended → transcription → n8n
- `src/components/settings/ai-config.tsx` — Section Répondeur Téléphonique IA (toggle, pricing, états activated/deactivated)

### Phase 10 — Site de Réservation Public (T092–T096)

#### Fichiers créés
- `src/app/api/v1/booking/[slug]/route.ts` — GET public : merchant par slug, services, praticiens avec availability
- `src/app/api/v1/booking/[slug]/reserve/route.ts` — POST public : Zod, find/create client, conflit check, source "booking_page"
- `src/app/(booking)/[slug]/page.tsx` — Wizard 5 étapes : service → praticien → date/heure → infos client → confirmation
- `src/lib/utils/qr-code.ts` — `getBookingUrl()` + `getQrCodeUrl()` via Google Charts API

#### Fichiers modifiés
- `src/app/(dashboard)/settings/page.tsx` — Onglet site : URL réservation + copie + QR code + lien externe

### Phase 11 — Polish & Cross-Cutting (T097–T106)

#### Fichiers créés
- `src/lib/utils/circuit-breaker.ts` — Pattern Circuit Breaker générique (CLOSED/OPEN/HALF_OPEN) + factory breakers pré-configurés (Gemini, Telnyx, Stripe, WhatsApp, Messenger, Telegram)
- `src/app/api/v1/health/route.ts` — Health check (Supabase, Redis, n8n), statuts healthy/degraded/unhealthy

#### Fichiers modifiés
- `src/middleware.ts` — Trace ID bout en bout (UUID, propagation X-Trace-Id, validation format), bypass auth pour /health
- `src/app/api/v1/bookings/[id]/route.ts` — No-show flow inline (increment no_show_count, block à 3, notification client)
- `supabase/seed.sql` — Seed complet : 5 tips, 1 loyalty program, 2 packages, 2 client_packages, 3 conversations, 6 messages

### Tâches déférées (infrastructure externe)
- `T100` — Monitoring Uptime Kuma (configuration serveur externe)
- `T107` — Infisical vault pour secrets production (intégration Vercel + VPS)
- `T108` — Tests de charge k6/Artillery (infrastructure dédiée)

### Validation
- ✅ `tsc --noEmit` — 0 erreur TypeScript
- ✅ 28 tâches complétées (T071–T078b, T079–T085, T092–T096, T097–T099, T101, T104–T106)
- ✅ Toutes les phases implémentables terminées

---

## [0.9.1] — 2026-03-29 — Phase 9 : Statistiques & Avis Google + corrections (T086–T091)

### Fichiers créés
- `src/app/api/v1/stats/route.ts` — GET /api/v1/stats (agrégation par période, 6 requêtes, deltas)
- `src/components/stats/revenue-chart.tsx` — AreaChart CA courant + comparaison période préc.
- `src/components/stats/bookings-chart.tsx` — BarChart RDV par heure (8h–21h)
- `src/components/stats/practitioner-performance.tsx` — Tableau praticiens, trophée leader, pill taux
- `src/components/stats/tips-summary.tsx` — BarChart pourboires par praticien + top 3 clients
- `n8n/workflows/google-review-request.json` — Workflow demande avis Google (schedule 5min, idempotent)

### Fichiers modifiés
- `src/app/(dashboard)/stats/page.tsx` — Page complète : 4 KPI, 7 sections graphiques, export CSV
- `src/lib/utils.ts` — Ajout `formatEuros` partagé (suppression des 4 copies dans les composants)
- `package.json` — +recharts

### Corrections code-review (6 points)
- `[FIX] BLOQUANT` — Revenue delta faussé : query période préc. filtre maintenant `status = completed`
- `[FIX] BLOQUANT` — `previous_cents` hardcodé à 0 : calculé réellement par jour via offset mapping ; `prevFillRate` calculé (plus hardcodé)
- `[FIX] BLOQUANT` — Noms clients `null` dans top CA : ajout join `client:clients(id, name)` dans query bookings
- `[FIX] MOYEN` — `formatEuros` dupliqué 4× → extrait dans `@/lib/utils`
- `[FIX] MOYEN` — Injection JSON n8n : template literal remplacé par `specifyBody: keypair`
- `[FIX] MINEUR` — Graphique horaire filtré 8h–21h (suppression barres vides nuit)

### Dette technique (non bloquant — V2)
- `[DEBT]` Clients inactifs : 2 requêtes fetching tous les `client_id` de `bookings` (recent 90j + all-time) avec diff JS — à remplacer par une vue SQL ou un `COUNT(DISTINCT client_id)` filtré pour éviter le scan complet sur gros volumes
- `[DEBT]` Timezone UTC : `new Date()` serveur = UTC, le groupement par jour (`starts_at.slice(0, 10)`) peut décaler d'un jour pour les bookings en soirée si le salon est en UTC+1/+2 — à corriger en V2 via le champ `timezone` de `merchants`

### Validation
- ✅ `tsc --noEmit` — 0 erreur TypeScript
- ✅ 6/6 tâches Phase 9 complétées (T086–T091)

---

## [0.9.0] — 2026-03-29 — Phase 6 : Paiements, Pourboires & Facturation (T061–T070
)

### Fichiers créés
- `src/app/api/v1/webhooks/stripe/route.ts` — Webhook Stripe (signature, idempotency, routing)
- `src/lib/stripe/handlers/payment-succeeded.ts` — Handler paiement réussi + tip
- `src/lib/stripe/connect.ts` — Stripe Connect onboarding
- `src/lib/stripe/payment-links.ts` — Checkout sessions avec pourboire
- `src/lib/stripe/subscription.ts` — Abonnements commerçant par sièges
- `src/app/api/v1/tips/route.ts` — GET /api/v1/tips (liste)
- `src/app/api/v1/tips/summary/route.ts` — GET /api/v1/tips/summary (agrégation)
- `src/app/api/v1/stripe/connect/route.ts` — POST Stripe Connect onboarding
- `src/app/api/v1/stripe/dashboard-link/route.ts` — POST dashboard link
- `supabase/migrations/012_create_stripe_events.sql` — Table idempotency
- `tests/integration/webhook-stripe.test.ts` — 5 tests
- `tests/unit/tip-attribution.test.ts` — 4 tests

### Fichiers modifiés
- `src/app/(dashboard)/settings/page.tsx` — Section paiements réelle (Stripe Connect)
- `src/types/supabase.ts` — Ajout type `stripe_events`
- `package.json` — +stripe +sonner

---

## [0.8.0] — 2026-03-29 — Phase 5 : Catalogue Services & Configuration (T052–T060)

### API Routes
- `[FEAT] T052` — `GET/POST /api/v1/services` — liste avec join practitioner_ids, création avec validation Zod (name min 2, duration 5-480, price_cents ≥ 0, auto sort_order) — `src/app/api/v1/services/route.ts`
- `[FEAT] T053` — `PATCH/DELETE /api/v1/services/:id` — mise à jour partielle + soft delete (is_active=false), cross-tenant check — `src/app/api/v1/services/[id]/route.ts`
- `[FEAT] T055` — `GET/POST /api/v1/practitioners` — liste avec join services + availability, création avec couleur #hex et spécialités — `src/app/api/v1/practitioners/route.ts`
- `[FEAT] T056` — `PATCH /api/v1/practitioners/:id` — champs optionnels, cross-tenant check — `src/app/api/v1/practitioners/[id]/route.ts`
- `[FEAT] T057` — `GET/PUT /api/v1/practitioners/:id/availability` — horaires récurrents (DELETE+INSERT strategy) + exceptions — `src/app/api/v1/practitioners/[id]/availability/route.ts`

### Pages Dashboard
- `[FEAT] T054` — Page Services avec 4 onglets (Services, Praticiens, Horaires, Fermetures) — liste, Dialog CRUD, durée/prix, dots praticiens — `src/app/(dashboard)/services/page.tsx`
- `[FEAT] T058` — Page Paramètres avec 7 onglets (Mon salon, IA & Canaux, Paiements, Mon site, Fidélité, Équipe, Mon abonnement) — formulaire salon + stubs futurs — `src/app/(dashboard)/settings/page.tsx`

### Composants
- `[FEAT] T059` — Composant PractitionerManager — cartes praticiens avec avatars colorés, Dialog création/édition (nom, email, 12 couleurs prédéfinies, spécialités, services assignés, horaires 7 jours) — `src/components/settings/practitioner-manager.tsx`
- `[FEAT] T060` — Composant AiConfig — personnalité IA (nom, ton friendly/formal/casual), langues (fr/en/es/ar/pt avec flags), canaux, délai annulation (0-2880 min) — `src/components/settings/ai-config.tsx`

### Validation
- ✅ `tsc --noEmit` — 0 erreur TypeScript
- ✅ 9/9 tâches Phase 5 complétées (T052–T060)

---

## [0.7.0] — 2026-03-29 — Phase 4 : Dashboard Agenda & Gestion (T038–T051b)

### Ajouté
- `[FEAT] T040` — API `GET /api/v1/bookings` — filtrage par date/semaine/mois/praticien/statut
- `[FEAT] T041` — Composant vue jour agenda — colonnes par praticien, 1px/min, ligne horaire courante
- `[FEAT] T042` — Composant vue semaine — grille 7 jours, jour actuel surligné, dimanche "Fermé"
- `[FEAT] T043` — Composant vue mois — calendrier 6×7, dots colorés par praticien
- `[FEAT] T044` — Page Agenda — switch jour/semaine/mois, navigation, filtre praticiens
- `[FEAT] T045` — Formulaire booking — Dialog useReducer, auto calcul fin depuis durée service
- `[FEAT] T046-T047b` — API Clients CRUD — GET paginé/recherche, POST, PATCH, fiche complète
- `[FEAT] T048` — Page Clients — table, debounce 300ms, filtres rapides, Dialog nouveau client
- `[FEAT] T049` — Composant fiche client — slide-over, badge fidélité, historique, forfaits, notes
- `[FEAT] T050` — Page Messages — 3 colonnes, filtres canaux, indicateur IA active
- `[FEAT] T051` — Composant conversation — bulles chat, Realtime Supabase, "Reprendre en main"
- `[FEAT] T051b` — Notification client fire-and-forget sur modif/annulation booking

### Tests
- `[TEST] T038` — Test intégration API bookings GET avec filtres
- `[TEST] T039` — Test unitaire agenda day-view (grouping, couleurs, positions)

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
