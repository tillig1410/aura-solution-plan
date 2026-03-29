# Implementation Plan: Plan — SaaS de Réservation par IA

**Branch**: `001-saas-reservation-ia` | **Date**: 2026-03-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-saas-reservation-ia/spec.md`

## Summary

SaaS multi-tenant de gestion de réservations par IA conversationnelle pour les commerçants de services beauté/bien-être. L'IA (Gemini 2.5 Flash Lite orchestrée via n8n) gère les réservations clients sur 5 canaux (WhatsApp, Messenger, Telegram, SMS, téléphone). Le commerçant dispose d'un dashboard Next.js avec 6 pages (Agenda, Clients, Messages, Services, Statistiques, Paramètres). Le système intègre Stripe Connect pour les paiements, les pourboires nominatifs, la fidélité, les forfaits et les abonnements.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, no `any`)
**Primary Dependencies**: Next.js 14+ (App Router), Tailwind CSS, shadcn/ui, Supabase JS SDK, Stripe SDK, Bull, n8n
**Storage**: Supabase (PostgreSQL) avec RLS multi-tenant, Redis (cache/queue)
**Testing**: Vitest + React Testing Library + Supabase local
**Target Platform**: Web (Vercel) + n8n self-hosted (Hostinger VPS KVM 2 + failover Hetzner CX22)
**Project Type**: Web application SaaS (monorepo Next.js + orchestration n8n)
**Performance Goals**: Réponse IA < 2s, dashboard < 1s TTFB, 500 commerçants simultanés
**Constraints**: Multi-tenant strict (RLS), euros uniquement, RGPD, aucun secret en frontend
**Scale/Scope**: 500 commerçants (V1), 1-7 praticiens/salon, 6 pages dashboard, 5 canaux messagerie

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Statut | Vérification |
|----------|--------|-------------|
| I. Canal Privé First | ✅ PASS | Tous les canaux sont privés (WhatsApp, Messenger, Telegram, SMS, tél). Aucune marketplace. |
| II. IA Proactive | ✅ PASS | L'IA utilise l'historique pour pré-remplir (FR-002). Objectif : 1-2 messages (SC-001 : ≤3 échanges). |
| III. Zéro Friction Client | ✅ PASS | Aucun compte client, aucune app, aucun site. Le client reste sur sa messagerie. |
| IV. Test-First | ✅ PASS | Vitest + RTL + Supabase local. Tests d'intégration pour webhooks, RLS, flows n8n. |
| V. Sécurité by Design | ✅ PASS | HMAC webhooks, idempotency Stripe, RLS sur chaque table, secrets dans Infisical. |
| VI. Résilience & Observabilité | ✅ PASS | Circuit breaker APIs externes, Trace ID bout en bout, health checks, Bull avec backoff. |
| VII. Simplicité & YAGNI | ✅ PASS | Monorepo Next.js + n8n. Pas de micro-services. Features V2 reportées. |
| VIII. API Versionnée | ✅ PASS | Routes sous `/api/v1/`. Rétrocompatibilité 6 mois. |

**Résultat** : Tous les gates passent. Pas de violation à justifier.

## Project Structure

### Documentation (this feature)

```text
specs/001-saas-reservation-ia/
├── plan.md              # Ce fichier
├── research.md          # Phase 0 : recherche et décisions techniques
├── data-model.md        # Phase 1 : modèle de données complet
├── quickstart.md        # Phase 1 : guide de démarrage rapide
├── contracts/           # Phase 1 : contrats API
│   ├── api-v1.md        # Routes REST API /api/v1/
│   └── webhooks.md      # Contrats webhooks entrants
└── tasks.md             # Phase 2 : tâches (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Login Magic Link, onboarding
│   │   ├── login/page.tsx
│   │   ├── onboarding/page.tsx
│   │   └── auth/callback/route.ts
│   ├── (dashboard)/              # Dashboard commerçant (protégé)
│   │   ├── agenda/page.tsx
│   │   ├── clients/page.tsx
│   │   ├── messages/page.tsx
│   │   ├── services/page.tsx
│   │   ├── stats/page.tsx
│   │   └── settings/page.tsx
│   ├── (booking)/                # Site de réservation public
│   │   └── [slug]/page.tsx
│   └── api/v1/                   # API Routes
│       ├── bookings/route.ts
│       ├── clients/route.ts
│       ├── services/route.ts
│       ├── practitioners/route.ts
│       ├── tips/route.ts
│       ├── stats/route.ts
│       └── webhooks/
│           ├── stripe/route.ts
│           ├── telnyx/route.ts
│           ├── whatsapp/route.ts
│           ├── messenger/route.ts
│           └── telegram/route.ts
├── components/
│   ├── ui/                       # shadcn/ui
│   ├── agenda/                   # Calendrier jour/semaine/mois
│   ├── clients/                  # Liste, fiche client
│   ├── messages/                 # Conversations multi-canal
│   ├── services/                 # CRUD services/praticiens
│   ├── stats/                    # Graphiques, métriques
│   └── layout/                   # Sidebar, TopBar, etc.
├── lib/
│   ├── supabase/                 # Client, types générés, helpers RLS
│   ├── stripe/                   # Helpers Connect, webhooks, idempotency
│   ├── telnyx/                   # Helpers Voice, SMS
│   └── utils/                    # Helpers génériques
├── hooks/                        # Custom React hooks
├── types/                        # Types TypeScript partagés
└── styles/                       # Styles globaux Tailwind

supabase/
├── migrations/                   # Migrations SQL versionnées (001_, 002_, ...)
├── functions/                    # Edge Functions (webhooks)
└── seed.sql                      # Données de test

n8n/
└── workflows/                    # Exports JSON des workflows
    ├── booking-conversation.json # Flow principal de réservation
    ├── reminder-notifications.json
    ├── voice-call-handler.json
    └── google-review-request.json

tests/
├── unit/                         # Logique métier pure
├── integration/                  # Webhooks, RLS, Supabase local
└── e2e/                          # Flows complets
```

**Structure Decision** : Monorepo Next.js unique avec orchestration n8n séparée. Conforme au principe VII (Simplicité) de la constitution. Le dossier `src/` suit la convention App Router avec les 6 pages dashboard et les routes API versionnées sous `/api/v1/`.

## Complexity Tracking

> Aucune violation détectée. Pas de complexité à justifier.
