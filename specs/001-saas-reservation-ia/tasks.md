# Tasks: Plan — SaaS de Réservation par IA

**Input**: Design documents from `/specs/001-saas-reservation-ia/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Inclus pour les modules critiques (paiement, réservation, auth, IA) conformément au Principe IV de la constitution (Test-First NON-NÉGOCIABLE).

**Organization**: Tasks groupées par user story pour permettre une implémentation et un test indépendants de chaque story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Peut être exécuté en parallèle (fichiers différents, pas de dépendances)
- **[Story]**: User story concernée (US1, US2, US3, etc.)
- Chemins exacts inclus dans les descriptions

---

## Phase 1: Setup

**Purpose**: Initialisation du projet et structure de base

- [X] T001 Initialiser le projet Next.js 14+ avec App Router, TypeScript strict, Tailwind CSS dans `src/`
- [X] T002 [P] Configurer shadcn/ui et installer les composants de base (Button, Input, Card, Dialog, Table, Calendar) dans `src/components/ui/`
- [X] T003 [P] Configurer ESLint + Prettier avec les règles TypeScript strict (no `any`) dans `.eslintrc.json`
- [X] T004 [P] Configurer Vitest + React Testing Library dans `vitest.config.ts`
- [X] T005 [P] Créer le fichier `docker-compose.yml` avec services n8n + Redis
- [X] T006 [P] Créer `.env.example` avec toutes les variables d'environnement documentées (Supabase, Stripe, Telnyx, WhatsApp, Messenger, Telegram, Redis, n8n)
- [X] T007 [P] Configurer les alias d'import `@/` dans `tsconfig.json`
- [X] T008 Initialiser Supabase local avec `supabase/config.toml`

**Checkpoint**: Structure du projet prête. Tous les outils configurés.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure partagée qui DOIT être complète avant toute user story

**⚠️ CRITICAL**: Aucune user story ne peut commencer avant la fin de cette phase

- [X] T009 Créer la migration `supabase/migrations/001_create_merchants.sql` — table `merchants` avec tous les champs (voir data-model.md), RLS policy tenant isolation
- [X] T010 [P] Créer la migration `supabase/migrations/002_create_practitioners.sql` — tables `practitioners`, `practitioner_availability`, `practitioner_services` avec RLS
- [X] T011 [P] Créer la migration `supabase/migrations/003_create_services.sql` — table `services` avec RLS
- [X] T012 [P] Créer la migration `supabase/migrations/004_create_clients.sql` — table `clients` avec indexes uniques multi-canal, champs no_show/is_blocked, RLS
- [X] T013 Créer la migration `supabase/migrations/005_create_bookings.sql` — table `bookings` avec 6 statuts, index unique créneau, colonne `version` pour verrouillage optimiste, RLS
- [X] T014 [P] Créer la migration `supabase/migrations/006_create_conversations_messages.sql` — tables `conversations` et `messages` avec RLS
- [X] T015 [P] Créer la migration `supabase/migrations/007_create_notifications.sql` — table `notifications` avec RLS
- [X] T016 Générer les types TypeScript Supabase dans `src/types/supabase.ts` via `npx supabase gen types typescript`
- [X] T017 Implémenter le client Supabase (browser + server) dans `src/lib/supabase/client.ts` et `src/lib/supabase/server.ts`
- [X] T018 [P] Implémenter le middleware d'authentification Magic Link dans `src/middleware.ts` — protection des routes `(dashboard)`
- [X] T019 [P] Créer le layout dashboard avec Sidebar (6 pages) + TopBar dans `src/components/layout/sidebar.tsx` et `src/components/layout/topbar.tsx`
- [X] T020 [P] Créer le layout principal `src/app/(dashboard)/layout.tsx` intégrant Sidebar + TopBar
- [X] T021 Créer `supabase/seed.sql` — données de test : 1 commerçant, 2 praticiens, 5 services, 10 clients, 20 bookings
- [X] T022 Écrire les tests d'intégration RLS dans `tests/integration/rls.test.ts` — vérifier qu'un commerçant ne peut PAS accéder aux données d'un autre
- [X] T022b [P] Créer la page d'authentification Magic Link dans `src/app/(auth)/login/page.tsx` — formulaire email + envoi Magic Link + page d'attente
- [X] T022c [P] Créer la page d'onboarding dans `src/app/(auth)/onboarding/page.tsx` — wizard : nom salon, slug, services, praticiens, horaires, Stripe Connect

**Checkpoint**: Foundation prête — authentification, pages login/onboarding, BDD, layout dashboard, RLS validé. Les user stories peuvent commencer.

---

## Phase 3: User Story 1 — Réservation Conversationnelle (Priority: P1) 🎯 MVP

**Goal**: Un client réserve via WhatsApp/Messenger/Telegram/SMS. L'IA utilise l'historique pour pré-remplir et confirmer en ≤3 échanges.

**Independent Test**: Envoyer un message simulé via webhook, vérifier que l'IA propose un créneau, confirme, et crée le booking.

### Tests User Story 1

- [X] T023 [P] [US1] Écrire le test d'intégration webhook WhatsApp dans `tests/integration/webhook-whatsapp.test.ts` — payload reçu → message normalisé → envoyé à n8n
- [X] T024 [P] [US1] Écrire le test d'intégration booking concurrency dans `tests/integration/booking-concurrency.test.ts` — 2 réservations simultanées sur le même créneau → 1 succès, 1 conflit 409
- [X] T025 [P] [US1] Écrire le test unitaire disponibilités dans `tests/unit/availability.test.ts` — calcul des créneaux libres à partir des horaires praticien et bookings existants

### Implementation User Story 1

- [X] T026 [US1] Implémenter le service de calcul de disponibilités dans `src/lib/availability.ts` — créneaux libres par praticien/jour en tenant compte des bookings et des exceptions d'horaires
- [X] T027 [US1] Implémenter la route webhook WhatsApp dans `src/app/api/v1/webhooks/whatsapp/route.ts` — validation HMAC, normalisation message unifié, envoi à n8n
- [X] T028 [P] [US1] Implémenter la route webhook Messenger dans `src/app/api/v1/webhooks/messenger/route.ts` — validation HMAC, normalisation, envoi à n8n
- [X] T029 [P] [US1] Implémenter la route webhook Telegram dans `src/app/api/v1/webhooks/telegram/route.ts` — validation token, normalisation, envoi à n8n
- [X] T030 [P] [US1] Implémenter la route webhook Telnyx SMS dans `src/app/api/v1/webhooks/telnyx/route.ts` — validation signature, normalisation SMS, envoi à n8n
- [X] T031 [US1] Implémenter la route POST /api/v1/bookings dans `src/app/api/v1/bookings/route.ts` — création de booking avec verrouillage optimiste (conflit 409 si créneau pris)
- [X] T032 [US1] Implémenter la route PATCH /api/v1/bookings/:id dans `src/app/api/v1/bookings/[id]/route.ts` — modification statut/heure/praticien avec vérification version
- [X] T033 [US1] Implémenter le helper d'identification client par canal dans `src/lib/clients/identify.ts` — résolution client par whatsapp_id/messenger_id/telegram_id/phone
- [X] T034 [US1] Créer le workflow n8n principal `n8n/workflows/booking-conversation.json` — webhook trigger → identification client → appel Gemini avec historique → vérification disponibilité → création/confirmation booking → réponse au client
- [X] T035 [US1] Implémenter le helper de réponse multi-canal dans `src/lib/channels/send.ts` — envoi de message sur WhatsApp/Messenger/Telegram/SMS selon le canal d'origine
- [X] T036 [US1] Implémenter l'annulation par le client dans le workflow n8n — détection intention annulation → vérification délai configurable → annulation ou refus
- [X] T037 [US1] Créer le workflow n8n rappels dans `n8n/workflows/reminder-notifications.json` — Bull job déclenché 24h et 1h avant chaque RDV → envoi rappel sur canal d'origine

**Checkpoint**: User Story 1 complète. Un client peut réserver, annuler, et recevoir des rappels via messagerie. L'IA utilise l'historique.

---

## Phase 4: User Story 2 — Dashboard Agenda & Gestion (Priority: P2)

**Goal**: Le commerçant visualise son agenda jour/semaine/mois, crée/modifie/annule des RDV, consulte ses clients et les conversations IA.

**Independent Test**: Se connecter, voir l'agenda du jour, créer un RDV manuellement, ouvrir une fiche client.

### Tests User Story 2

- [X] T038 [P] [US2] Écrire le test d'intégration API bookings GET dans `tests/integration/api-bookings.test.ts` — liste filtrée par jour/semaine/mois/praticien
- [X] T039 [P] [US2] Écrire le test unitaire composant agenda dans `tests/unit/agenda-day-view.test.ts` — rendu correct des bookings par praticien avec couleurs

### Implementation User Story 2

- [X] T040 [US2] Implémenter la route GET /api/v1/bookings dans `src/app/api/v1/bookings/route.ts` — filtrage par date/semaine/mois/praticien/statut
- [X] T041 [US2] Implémenter le composant vue jour de l'agenda dans `src/components/agenda/day-view.tsx` — colonnes par praticien, couleurs, créneaux horaires
- [X] T042 [P] [US2] Implémenter le composant vue semaine dans `src/components/agenda/week-view.tsx` — grille 7 jours × praticiens
- [X] T043 [P] [US2] Implémenter le composant vue mois dans `src/components/agenda/month-view.tsx` — calendrier mensuel avec indicateurs de RDV
- [X] T044 [US2] Implémenter la page Agenda dans `src/app/(dashboard)/agenda/page.tsx` — switch jour/semaine/mois, navigation date, filtre praticien
- [X] T045 [US2] Implémenter le formulaire de création/édition de RDV dans `src/components/agenda/booking-form.tsx` — sélection client, praticien, service, créneau avec vérification disponibilité
- [X] T046 [US2] Implémenter la route GET /api/v1/clients dans `src/app/api/v1/clients/route.ts` — liste paginée avec recherche par nom/téléphone
- [X] T047 [US2] Implémenter la route GET /api/v1/clients/:id dans `src/app/api/v1/clients/[id]/route.ts` — fiche complète avec historique bookings, fidélité, forfaits
- [X] T047b [US2] Implémenter les routes POST /api/v1/clients et PATCH /api/v1/clients/:id dans `src/app/api/v1/clients/route.ts` et `src/app/api/v1/clients/[id]/route.ts` — création manuelle de client, mise à jour (nom, téléphone, notes, déblocage no-show)
- [X] T048 [US2] Implémenter la page Clients dans `src/app/(dashboard)/clients/page.tsx` — liste + recherche + clic vers fiche client
- [X] T049 [US2] Implémenter le composant fiche client dans `src/components/clients/client-detail.tsx` — historique visites, préférences, fidélité, forfaits, notes
- [X] T050 [US2] Implémenter la page Messages dans `src/app/(dashboard)/messages/page.tsx` — liste conversations + vue détail avec historique multi-canal
- [X] T051 [US2] Implémenter le composant conversation dans `src/components/messages/conversation-view.tsx` — affichage messages IA/client, tag canal, transcriptions vocales
- [X] T051b [US2] Implémenter la notification client sur modification/annulation de RDV depuis le dashboard — envoi automatique sur le canal d'origine via `src/lib/channels/send.ts` lors d'un PATCH booking

**Checkpoint**: Dashboard opérationnel. Le commerçant peut gérer ses RDV, consulter ses clients et voir les conversations IA.

---

## Phase 5: User Story 3 — Catalogue de Services & Configuration (Priority: P3)

**Goal**: Le commerçant configure services, praticiens, horaires, comportement IA, et créneaux bloqués.

**Independent Test**: Créer un service, ajouter un praticien avec horaires, vérifier les créneaux proposés.

### Implementation User Story 3

- [X] T052 [US3] Implémenter les routes CRUD /api/v1/services dans `src/app/api/v1/services/route.ts` — GET, POST
- [X] T053 [P] [US3] Implémenter les routes /api/v1/services/:id dans `src/app/api/v1/services/[id]/route.ts` — PATCH, DELETE (soft delete)
- [X] T054 [US3] Implémenter la page Services dans `src/app/(dashboard)/services/page.tsx` — liste services avec CRUD inline, ajout/suppression
- [X] T055 [US3] Implémenter les routes CRUD /api/v1/practitioners dans `src/app/api/v1/practitioners/route.ts` — GET, POST
- [X] T056 [P] [US3] Implémenter les routes /api/v1/practitioners/:id dans `src/app/api/v1/practitioners/[id]/route.ts` — PATCH
- [X] T057 [US3] Implémenter les routes /api/v1/practitioners/:id/availability dans `src/app/api/v1/practitioners/[id]/availability/route.ts` — GET, PUT (horaires récurrents + exceptions)
- [X] T058 [US3] Implémenter la page Paramètres dans `src/app/(dashboard)/settings/page.tsx` — sections : praticiens, horaires salon, configuration IA (nom, ton, langues), délai annulation
- [X] T059 [US3] Implémenter le composant gestion praticiens dans `src/components/settings/practitioner-manager.tsx` — CRUD praticiens, couleurs, spécialités, horaires hebdomadaires, congés
- [X] T060 [US3] Implémenter le composant configuration IA dans `src/components/settings/ai-config.tsx` — nom, ton (friendly/formal/casual), langues supportées (multiselect)

**Checkpoint**: Le commerçant peut configurer son salon. L'IA utilise cette configuration pour les réservations.

---

## Phase 6: User Story 4 — Paiements, Pourboires & Facturation (Priority: P4)

**Goal**: Paiement client via Stripe Connect, pourboires nominatifs, abonnement commerçant par siège.

**Independent Test**: Simuler un paiement, vérifier le pourboire attribué au bon praticien, souscrire un abonnement.

### Tests User Story 4

- [X] T061 [P] [US4] Écrire le test d'intégration webhook Stripe dans `tests/integration/webhook-stripe.test.ts` — validation signature, idempotency, routing events
- [X] T062 [P] [US4] Écrire le test unitaire attribution pourboire dans `tests/unit/tip-attribution.test.ts` — pourboire attribué au bon practitioner_id

### Implementation User Story 4

- [X] T063 [US4] Créer la migration `supabase/migrations/008_create_tips.sql` — table `tips` avec RLS
- [X] T064 [US4] Implémenter la route webhook Stripe dans `src/app/api/v1/webhooks/stripe/route.ts` — validation signature, idempotency par event.id, routing vers handlers
- [X] T065 [US4] Implémenter le handler `payment_intent.succeeded` dans `src/lib/stripe/handlers/payment-succeeded.ts` — marquer booking payé, créer tip si pourboire inclus
- [X] T066 [US4] Implémenter le helper Stripe Connect onboarding dans `src/lib/stripe/connect.ts` — création compte Connect Standard, OAuth flow, vérification statut
- [X] T067 [US4] Implémenter le helper Payment Links dans `src/lib/stripe/payment-links.ts` — génération lien paiement post-prestation avec option pourboire nominatif
- [X] T068 [US4] Implémenter les routes GET /api/v1/tips et GET /api/v1/tips/summary dans `src/app/api/v1/tips/route.ts` — liste et agrégation par praticien
- [X] T069 [US4] Implémenter la section paiements dans la page Paramètres — onboarding Stripe Connect, statut du compte, gestion abonnement Plan
- [X] T070 [US4] Implémenter le helper abonnement commerçant dans `src/lib/stripe/subscription.ts` — création Stripe Subscription par nombre de sièges, grille tarifaire, Early Adopter coupon

**Checkpoint**: Paiements fonctionnels. Pourboires attribués au bon praticien. Commerçant peut s'abonner.

---

## Phase 7: User Story 5 — Fidélité, Forfaits & Abonnements Client (Priority: P5)

**Goal**: Programme fidélité, forfaits prépayés, abonnements clients récurrents.

**Independent Test**: Créer un forfait, l'attribuer, simuler des visites, vérifier le décompte.

### Implementation User Story 5

- [ ] T071 [US5] Créer la migration `supabase/migrations/009_create_loyalty_packages_subscriptions.sql` — tables `loyalty_programs`, `packages`, `client_packages`, `client_subscriptions` avec RLS
- [ ] T072 [US5] Implémenter les routes CRUD forfaits dans `src/app/api/v1/packages/route.ts` — création/liste des forfaits commerçant
- [ ] T073 [US5] Implémenter le service de décompte forfait dans `src/lib/packages/consume.ts` — décrémentation `remaining_uses` à chaque visite, vérification expiration
- [ ] T074 [US5] Implémenter le service fidélité dans `src/lib/loyalty/points.ts` — ajout points par visite/euro, mise à jour palier (bronze → silver → gold), notification palier
- [ ] T075 [US5] Implémenter les routes programme fidélité dans `src/app/api/v1/loyalty/route.ts` — GET/PUT configuration programme par commerçant
- [ ] T076 [US5] Implémenter le handler abonnement client dans `src/lib/stripe/handlers/subscription-updated.ts` — mise à jour statut `client_subscriptions` sur events Stripe
- [ ] T077 [US5] Implémenter la section fidélité/forfaits dans la page Paramètres — configuration programme fidélité, CRUD forfaits, gestion abonnements clients
- [ ] T078 [US5] Intégrer la vérification forfait/abonnement dans le workflow n8n de réservation — si le client a un forfait actif pour le service demandé, ne pas demander de paiement
- [ ] T078b [US5] Créer un Bull job de notification d'expiration forfait — vérification quotidienne des forfaits expirant dans 7 jours, envoi notification au client via canal d'origine

**Checkpoint**: Fidélité, forfaits et abonnements fonctionnels. Décompte automatique à chaque visite.

---

## Phase 8: User Story 6 — Répondeur Téléphonique IA (Priority: P6)

**Goal**: Option payante : l'IA décroche les appels, comprend la demande vocalement, réserve, transcrit.

**Independent Test**: Appeler le numéro, formuler une demande de RDV, vérifier le booking créé et la transcription.

### Tests User Story 6

- [ ] T079 [P] [US6] Écrire le test d'intégration webhook Telnyx Voice dans `tests/integration/webhook-telnyx-voice.test.ts` — validation signature, events call.initiated/hangup

### Implementation User Story 6

- [ ] T080 [US6] Implémenter le handler Telnyx Voice dans `src/app/api/v1/webhooks/telnyx/route.ts` — extension pour events `call.initiated`, `call.answered`, `call.hangup`
- [ ] T081 [US6] Implémenter le helper Telnyx Voice dans `src/lib/telnyx/voice.ts` — répondre à l'appel, streamer audio vers Gemini STT, envoyer réponse TTS
- [ ] T082 [US6] Créer le workflow n8n vocal dans `n8n/workflows/voice-call-handler.json` — même logique que le workflow texte mais avec entrée/sortie voix
- [ ] T083 [US6] Implémenter la sauvegarde transcription dans `src/lib/telnyx/transcription.ts` — stocker la transcription comme message dans `conversations`/`messages` avec `is_voice_transcription = true`
- [ ] T084 [US6] Implémenter l'activation/désactivation option téléphone dans la page Paramètres — toggle voice_enabled, provisioning numéro Telnyx, mise à jour tarif abonnement
- [ ] T085 [US6] Implémenter le message d'accueil standard dans `src/lib/telnyx/fallback.ts` — pour les salons sans option téléphone, message invitant à utiliser WhatsApp/SMS

**Checkpoint**: Répondeur IA vocal opérationnel. Appels transcrits et visibles dans Messages.

---

## Phase 9: User Story 7 — Statistiques & Avis Google (Priority: P7)

**Goal**: Page statistiques (RDV, CA, taux remplissage, praticiens, pourboires) + demande avis Google automatique.

**Independent Test**: Consulter les statistiques avec données de test, vérifier les métriques.

### Implementation User Story 7

- [X] T086 [US7] Créer les vues SQL `tips_by_practitioner` et `booking_stats` dans `supabase/migrations/010_create_views.sql`
- [X] T087 [US7] Implémenter la route GET /api/v1/stats dans `src/app/api/v1/stats/route.ts` — agrégation par période (jour/semaine/mois/année), par praticien
- [X] T088 [US7] Implémenter la page Statistiques dans `src/app/(dashboard)/stats/page.tsx` — graphiques CA, nombre RDV, taux remplissage, top praticiens, pourboires
- [X] T089 [US7] Implémenter les composants graphiques dans `src/components/stats/` — `revenue-chart.tsx`, `bookings-chart.tsx`, `practitioner-performance.tsx`, `tips-summary.tsx`
- [X] T090 [US7] Créer le workflow n8n demande avis Google dans `n8n/workflows/google-review-request.json` — Bull job 2h après prestation terminée → envoi message avec lien avis Google sur canal d'origine
- [X] T091 [US7] Implémenter la configuration Google Place ID dans la page Paramètres — champ `google_place_id` pour générer le lien avis

**Checkpoint**: Statistiques visibles. Demandes d'avis envoyées automatiquement post-prestation.

---

## Phase 10: User Story Bonus — Site de Réservation Public

**Goal**: Site de réservation avec URL personnalisable et QR code pour chaque salon (FR-019).

### Implementation

- [ ] T092 Implémenter la route GET /api/v1/booking/:slug dans `src/app/api/v1/booking/[slug]/route.ts` — infos publiques du salon (nom, services, praticiens, créneaux disponibles)
- [ ] T093 Implémenter la route POST /api/v1/booking/:slug/reserve dans `src/app/api/v1/booking/[slug]/reserve/route.ts` — création réservation publique
- [ ] T094 Implémenter la page de réservation publique dans `src/app/(booking)/[slug]/page.tsx` — sélection service → praticien → créneau → confirmation
- [ ] T095 [P] Implémenter la génération QR code dans `src/lib/utils/qr-code.ts` — QR pointant vers l'URL de réservation du salon
- [ ] T096 Ajouter la section site de réservation dans la page Paramètres — affichage URL + QR code + personnalisation slug

**Checkpoint**: Site de réservation public fonctionnel. QR code disponible.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Améliorations transverses à toutes les user stories

- [ ] T097 [P] Implémenter les circuit breakers sur tous les appels API externes dans `src/lib/utils/circuit-breaker.ts` — Gemini, Telnyx, Stripe, WhatsApp, Messenger, Telegram
- [ ] T098 [P] Implémenter le Trace ID bout en bout dans `src/middleware.ts` — génération UUID, propagation header `X-Trace-Id` vers n8n et logs
- [ ] T099 [P] Implémenter les health checks dans `src/app/api/v1/health/route.ts` — vérification des 7 services (n8n, Redis, Supabase, Telnyx, Stripe, Gemini, WhatsApp)
- [ ] T100 [P] Configurer le monitoring Uptime Kuma pour les endpoints health
- [ ] T101 Implémenter le no-show flow complet — marquage par commerçant → incrémentation `no_show_count` → notification client → blocage IA à 3 no-shows
- [ ] T104 Audit sécurité — vérifier HMAC sur tous les webhooks, RLS sur toutes les tables, aucun secret en clair, idempotency Stripe
- [ ] T105 [P] Optimiser les performances — Server Components par défaut, `use client` minimal, ISR sur pages publiques
- [ ] T106 Mettre à jour `supabase/seed.sql` avec les données complètes pour toutes les user stories
- [ ] T107 [P] Configurer Infisical pour la gestion des secrets en production — migration des variables d'environnement vers le vault, intégration SDK Infisical dans le déploiement Vercel et le VPS n8n
- [ ] T108 [P] Écrire et exécuter des tests de charge avec k6 ou Artillery — simuler 500 commerçants simultanés, valider SC-004 (pas de dégradation perceptible)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Aucune dépendance — démarrage immédiat
- **Foundational (Phase 2)**: Dépend du Setup — BLOQUE toutes les user stories
- **US1 Réservation (Phase 3)**: Dépend de Foundational — MVP
- **US2 Dashboard (Phase 4)**: Dépend de Foundational — peut être parallélisé avec US1
- **US3 Configuration (Phase 5)**: Dépend de Foundational — peut être parallélisé avec US1/US2
- **US4 Paiements (Phase 6)**: Dépend de US1 (bookings existants pour payer)
- **US5 Fidélité (Phase 7)**: Dépend de US4 (Stripe pour les abonnements clients)
- **US6 Téléphonie (Phase 8)**: Dépend de US1 (même workflow de réservation)
- **US7 Statistiques (Phase 9)**: Dépend de US1 + US4 (données de bookings et paiements)
- **Bonus Site (Phase 10)**: Dépend de US1 + US3 (réservation + configuration)
- **Polish (Phase 11)**: Dépend de toutes les stories souhaitées

### User Story Dependencies

```
Phase 1 (Setup)
    └── Phase 2 (Foundational)
            ├── Phase 3 (US1 Réservation) ←── MVP
            ├── Phase 4 (US2 Dashboard)    ←── parallélisable avec US1
            ├── Phase 5 (US3 Configuration) ←── parallélisable avec US1/US2
            │       └── Phase 10 (Bonus Site)
            ├── Phase 6 (US4 Paiements)    ←── après US1
            │       └── Phase 7 (US5 Fidélité)
            ├── Phase 8 (US6 Téléphonie)   ←── après US1
            └── Phase 9 (US7 Statistiques) ←── après US1 + US4
                    └── Phase 11 (Polish)
```

### Within Each User Story

- Tests DOIVENT être écrits et ÉCHOUER avant implémentation (modules critiques)
- Migrations avant services
- Services avant routes API
- Routes API avant composants UI
- Intégration avant polish

### Parallel Opportunities

```bash
# Phase 1 — tous en parallèle :
T002, T003, T004, T005, T006, T007

# Phase 2 — après T009 :
T010, T011, T012 en parallèle
T014, T015 en parallèle
T018, T019, T020 en parallèle

# Phase 3 — tests en parallèle :
T023, T024, T025 en parallèle
# Puis webhooks en parallèle :
T028, T029, T030 en parallèle

# Phases 3, 4, 5 après Foundational — parallélisables entre elles
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Compléter Phase 1: Setup
2. Compléter Phase 2: Foundational (CRITICAL)
3. Compléter Phase 3: User Story 1 — Réservation Conversationnelle
4. **STOP et VALIDER** : tester un flow complet de réservation via WhatsApp
5. Déployer le MVP

### Incremental Delivery

1. Setup + Foundational → Infrastructure prête
2. US1 Réservation → MVP déployable
3. US2 Dashboard + US3 Configuration → Commerçant autonome
4. US4 Paiements → Monétisation active
5. US5 Fidélité → Rétention client
6. US6 Téléphonie → Option premium
7. US7 Statistiques + Site public → Valeur ajoutée
8. Polish → Production-ready

### Parallel Team Strategy

Avec 2+ développeurs après Phase 2 :
- **Dev A** : US1 (Réservation) + US6 (Téléphonie)
- **Dev B** : US2 (Dashboard) + US3 (Configuration)
- Puis convergence sur US4/US5/US7

---

## Notes

- [P] tasks = fichiers différents, pas de dépendances
- [Story] label mappe chaque tâche à sa user story
- Chaque user story est indépendamment testable
- Tests écrits avant implémentation pour les modules critiques (Constitution Principe IV)
- Commit après chaque tâche ou groupe logique
- Arrêt possible à chaque checkpoint pour validation
