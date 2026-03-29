# Plan Constitution

## Core Principles

### I. Canal Privé First
Plan est un outil de réservation par **canal privé** (WhatsApp, Messenger, Telegram, SMS, téléphone). Ce n'est PAS une marketplace. Chaque décision produit doit renforcer la relation directe commerçant-client. Aucune fonctionnalité ne doit exposer les clients d'un commerçant à un autre. Le commerçant reste propriétaire de sa base clients à 100%.

### II. IA Proactive, pas un Simple Agenda
L'IA n'est pas un chatbot réactif. Elle **anticipe** : comble les blancs (service habituel, créneau préféré, praticien favori) grâce à l'historique client. L'objectif est une réservation complète en **1 à 2 messages** maximum. Chaque fonctionnalité IA doit réduire la friction, jamais en ajouter.

### III. Zéro Friction Client
Le client final ne crée **aucun compte**, n'installe **aucune app**, ne visite **aucun site**. Il envoie un message sur le canal qu'il utilise déjà. Cette contrainte est **non-négociable** : toute feature qui oblige le client à quitter sa messagerie est rejetée.

### IV. Test-First (NON-NÉGOCIABLE)
TDD obligatoire pour tout code critique (paiement, réservation, auth, IA) :
- Tests écrits → Validés → Tests échouent (red) → Implémentation (green) → Refactoring
- Couverture minimale : 80% sur les modules critiques
- Tests d'intégration obligatoires pour : webhooks Stripe, API Telnyx, Supabase RLS, flows n8n

### V. Sécurité by Design
- **Webhook HMAC** : toute entrée externe (Stripe, Telnyx, WhatsApp) validée par signature
- **Idempotency** : tout paiement Stripe protégé par clé d'idempotence
- **RLS Supabase** : chaque table a une policy Row Level Security. Aucune requête sans filtre tenant
- **Secrets** : vault Infisical, jamais de secret en clair ou en .env commité
- **MFA** : obligatoire sur Cloudflare, Supabase dashboard, Stripe dashboard

### VI. Résilience & Observabilité
- **Circuit breaker** sur tous les appels API externes (Gemini, Telnyx, Stripe, WhatsApp)
- **Trace ID** propagé de bout en bout (header → n8n → Supabase → logs)
- **Health checks** sur les 7 services (n8n, Redis, Supabase, Telnyx, Stripe, Gemini, WhatsApp)
- **Uptime Kuma** pour le monitoring SLA
- **Bull queue** avec backoff exponentiel pour les jobs asynchrones
- **Anti-race condition** : verrouillage optimiste sur les créneaux de réservation

### VII. Simplicité & YAGNI
- Commencer simple. Pas d'abstraction prématurée
- Pas de micro-services : monorepo Next.js + n8n suffit en phase de lancement
- Chaque ajout de complexité doit être justifié par un besoin utilisateur réel
- Si une feature peut attendre V2, elle attend V2

### VIII. API Versionnée
- Toutes les routes API sous `/api/v1/`
- Changements breaking = nouvelle version majeure
- Rétrocompatibilité maintenue pendant 6 mois minimum après dépréciation

---

## Stack Technique (verrouillée)

| Couche | Technologie | Justification |
|---|---|---|
| **Frontend** | Next.js 14+ (App Router) + Tailwind CSS + shadcn/ui | SSR, performance, DX |
| **Hébergement front** | Vercel | Deploy auto, edge functions |
| **Base de données** | Supabase (PostgreSQL) | Auth, RLS, Real-time, managé |
| **Orchestration IA** | n8n (self-hosted, Docker Compose) | Flexibilité, pas de vendor lock |
| **IA / NLU / STT** | Gemini 2.5 Flash Lite | Latence <2s, coût bas |
| **Messagerie** | WhatsApp Business API, Messenger, Telegram, SMS | Canaux privés du client |
| **Téléphonie** | Telnyx | ~1$/numéro, 20× moins cher que Twilio |
| **Paiement** | Stripe (Connect, Payment Links, empreinte CB) | Standard du marché |
| **Cache / Queue** | Redis + Bull | Queue mode n8n, cache sessions |
| **Hébergement n8n** | Hostinger VPS KVM 2 (2vCPU, 8GB) | Coût/perf optimal |
| **Failover** | Hetzner CX22 (miroir) | Résilience géographique |
| **Secrets** | Infisical | Vault centralisé |
| **Monitoring** | Uptime Kuma | SLA tracking |

**Changement de stack interdit** sans discussion explicite et mise à jour de cette constitution.

---

## Conventions de Code

### Structure du projet
```
aura-app/
├── src/
│   ├── app/              # Next.js App Router (pages, layouts, API routes)
│   ├── components/       # Composants React réutilisables
│   │   ├── ui/           # shadcn/ui components
│   │   └── dashboard/    # Composants métier dashboard
│   ├── lib/              # Utilitaires, helpers, clients API
│   │   ├── supabase/     # Client Supabase, types, helpers
│   │   ├── stripe/       # Helpers Stripe, webhooks
│   │   └── telnyx/       # Helpers Telnyx
│   ├── hooks/            # Custom React hooks
│   ├── types/            # Types TypeScript partagés
│   └── styles/           # Styles globaux Tailwind
├── supabase/
│   ├── migrations/       # Migrations SQL versionnées
│   └── seed.sql          # Données de test
├── n8n/
│   └── workflows/        # Exports JSON des workflows n8n
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/                 # Documentation technique
```

### Règles TypeScript
- **Strict mode** activé (`"strict": true`)
- Nommage : `camelCase` variables/fonctions, `PascalCase` composants/types, `UPPER_SNAKE` constantes
- Pas de `any` — utiliser `unknown` + type guard si le type est incertain
- Tous les composants React en **functional components** avec hooks
- Server Components par défaut, `"use client"` uniquement si interactivité nécessaire

### Règles SQL (Supabase)
- Tables en `snake_case`, colonnes en `snake_case`
- Toute table a : `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`
- Chaque table a un `merchant_id` (multi-tenant) avec **RLS policy**
- Indexes sur les colonnes de recherche et les foreign keys
- Migrations numérotées : `001_create_merchants.sql`, `002_create_services.sql`, etc.

### Règles Git
- Commits en français, format : `type(scope): description`
  - Types : `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `security`
  - Exemple : `feat(booking): ajout réservation vocale via Telnyx`
- Branches : `feature/nom`, `fix/nom`, `hotfix/nom`
- PR obligatoire pour merge sur `main`
- Pas de force push sur `main`

---

## Modèle Économique (contraintes produit)

- **Pricing par siège** : 16,90€ (1 siège) → dégressif → +6€/siège après 7
- **Option téléphonie** : +5€/siège (7€ → 52€ pour 10 sièges)
- **Zéro commission** sur les réservations — engagement fort, non-négociable
- **Sans engagement** — résiliation à tout moment
- **Early Adopter** : -30% à vie pour les 50 premiers inscrits
- **Break-even** estimé : ~91 clients

Toute feature ayant un coût marginal par client (API calls, SMS, minutes téléphone) doit être modélisée financièrement avant implémentation.

---

## Tables de Base de Données (référence)

Tables existantes et validées :
`merchants`, `practitioners`, `services`, `clients`, `bookings`, `availability`, `messages`, `payments`, `tips`, `subscriptions`, `loyalty_programs`, `reviews`

Vues : `tips_by_practitioner`, `tips_history`

Chaque nouvelle table doit respecter : UUID, timestamps, merchant_id, RLS policy, migration versionnée.

---

## Gouvernance

- Cette constitution **prime sur toutes les autres pratiques**
- Tout PR/review doit vérifier la conformité avec cette constitution
- Modification de la constitution = PR dédiée avec justification écrite
- Tout ajout de complexité doit être justifié par un besoin utilisateur documenté
- En cas de doute, choisir la solution la plus simple

**Version** : 1.0.0 | **Ratifiée** : 2026-03-28 | **Dernière modification** : 2026-03-28
