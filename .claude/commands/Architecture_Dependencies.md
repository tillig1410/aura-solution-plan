# AurA Solutions — Architecture & Dépendances

> Document de référence pour le développement. À maintenir à jour à chaque ajout de dépendance majeure.

---

## 1. Vue d'ensemble de l'architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT FINAL                               │
│         WhatsApp · Messenger · Telegram · SMS · Téléphone           │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ Message entrant
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     n8n (Orchestration IA)                          │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │ Webhook  │───▶│ Gemini 2.5  │───▶│  Logique métier          │  │
│  │ entrant  │    │ Flash Lite   │    │  (dispo, historique, RDV) │  │
│  └──────────┘    └──────────────┘    └──────────┬───────────────┘  │
│                                                  │                  │
│                                     ┌────────────▼──────────────┐  │
│                                     │      Supabase DB          │  │
│                                     │  (bookings, clients, etc) │  │
│                                     └────────────┬──────────────┘  │
│                                                  │                  │
│  ┌─────────────────────────────────────────────▼──────────────┐   │
│  │         Réponse client (WhatsApp / SMS / Vocal)             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  DASHBOARD COMMERÇANT (Next.js)                     │
│     Agenda · Clients · Messages · Services · Stats · Paramètres     │
│                   Supabase Auth + RLS                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack complète

### Frontend — Dashboard commerçant

| Technologie | Version | Rôle |
|---|---|---|
| **Next.js** | 14+ (App Router) | Framework React SSR/SSG |
| **React** | 18+ | UI library |
| **TypeScript** | 5+ | Typage statique |
| **Tailwind CSS** | 3+ | Styles utilitaires |
| **shadcn/ui** | latest | Composants UI accessibles |
| **Vercel** | — | Hébergement + déploiement auto |

### Backend — Base de données

| Technologie | Version | Rôle |
|---|---|---|
| **Supabase** | latest | PostgreSQL managé + Auth + RLS + Realtime |
| **PostgreSQL** | 15+ | Base de données relationnelle |
| **Supabase Auth** | — | Authentification commerçant (email + Magic Link) |
| **Row Level Security** | — | Isolation des données par tenant (merchant_id) |

### Backend — Orchestration IA

| Technologie | Version | Rôle |
|---|---|---|
| **n8n** | latest (self-hosted) | Orchestration des workflows IA |
| **Docker Compose** | — | Déploiement n8n |
| **Redis** | 7+ | Cache + Bull queue |
| **Bull** | 4+ | Queue de jobs asynchrones |

### IA & NLP

| Technologie | Version | Rôle |
|---|---|---|
| **Gemini 2.5 Flash Lite** | API Google | NLU + STT + génération réponses |

### Messagerie & Téléphonie

| Technologie | Rôle |
|---|---|
| **WhatsApp Business API** | Canal principal de messagerie |
| **Messenger API** | Canal Facebook |
| **Telegram Bot API** | Canal Telegram |
| **SMS API** | Canal SMS fallback |
| **Telnyx** | Téléphonie IP + numéro local + IA vocale |

### Paiement

| Technologie | Rôle |
|---|---|
| **Stripe** | Paiement en ligne, liens de paiement |
| **Stripe Connect** | Paiements pour les commerçants |
| **Stripe Payment Links** | Liens de paiement WhatsApp |
| **Stripe Billing** | Abonnements AurA SaaS |

### Infrastructure & Sécurité

| Technologie | Rôle |
|---|---|
| **Hostinger VPS KVM 2** | Hébergement n8n (2vCPU, 8GB RAM) |
| **Hetzner CX22** | Failover / miroir |
| **Infisical** | Vault de secrets (env vars chiffrées) |
| **Cloudflare** | DNS, WAF, protection DDoS, MFA |
| **Uptime Kuma** | Monitoring SLA + alertes |

---

## 3. Dépendances npm (package.json)

### Production

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "typescript": "^5.0.0",

    "@supabase/supabase-js": "^2.0.0",
    "@supabase/ssr": "^0.1.0",
    "@supabase/auth-helpers-nextjs": "^0.8.0",

    "stripe": "^14.0.0",
    "@stripe/stripe-js": "^2.0.0",

    "@google/generative-ai": "^0.1.0",

    "telnyx": "^2.0.0",

    "bull": "^4.0.0",
    "ioredis": "^5.0.0",

    "zod": "^3.0.0",
    "date-fns": "^3.0.0",
    "date-fns-tz": "^2.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": "^0.300.0"
  }
}
```

### Dev / Tests

```json
{
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",

    "eslint": "^8.0.0",
    "eslint-config-next": "^14.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",

    "prettier": "^3.0.0",
    "prettier-plugin-tailwindcss": "^0.5.0",

    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@playwright/test": "^1.40.0",

    "husky": "^8.0.0",
    "lint-staged": "^14.0.0"
  }
}
```

---

## 4. Variables d'environnement requises

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Google Gemini
GOOGLE_GEMINI_API_KEY=

# Telnyx
TELNYX_API_KEY=
TELNYX_WEBHOOK_SECRET=
TELNYX_PHONE_NUMBER=

# WhatsApp Business API
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_WEBHOOK_SECRET=

# n8n
N8N_WEBHOOK_URL=
N8N_API_KEY=

# Redis
REDIS_URL=

# App
NEXT_PUBLIC_APP_URL=
NODE_ENV=
```

> **Important** : tous ces secrets sont gérés via **Infisical**. Ne jamais les committer en clair.

---

## 5. Structure des dossiers

```
aura-app/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Routes auth (login, register)
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/              # Routes dashboard (protégées)
│   │   │   ├── agenda/page.tsx
│   │   │   ├── clients/page.tsx
│   │   │   ├── messages/page.tsx
│   │   │   ├── services/page.tsx
│   │   │   ├── stats/page.tsx
│   │   │   └── parametres/page.tsx
│   │   └── api/
│   │       └── v1/                   # Toutes les routes API
│   │           ├── bookings/
│   │           ├── clients/
│   │           ├── webhooks/
│   │           │   ├── stripe/
│   │           │   ├── whatsapp/
│   │           │   └── telnyx/
│   │           └── payments/
│   ├── components/
│   │   ├── ui/                       # shadcn/ui
│   │   └── dashboard/                # Composants métier
│   │       ├── agenda/
│   │       ├── clients/
│   │       ├── messages/
│   │       └── shared/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Client browser
│   │   │   ├── server.ts             # Client server
│   │   │   └── types.ts              # Types générés
│   │   ├── stripe/
│   │   │   ├── client.ts
│   │   │   └── webhooks.ts
│   │   ├── telnyx/
│   │   │   └── client.ts
│   │   └── gemini/
│   │       └── client.ts
│   ├── hooks/
│   ├── types/
│   └── middleware.ts                 # Auth middleware Next.js
├── supabase/
│   ├── migrations/                   # SQL migrations (versionnées)
│   └── seed.sql
├── n8n/
│   └── workflows/                    # Exports JSON n8n
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
```

---

## 6. Flux de données principaux

### Réservation WhatsApp
```
Client → WhatsApp → Webhook n8n → Gemini (intent)
→ Supabase (dispo + historique) → Confirmation → WhatsApp Client
```

### Paiement
```
Client → Stripe Payment Link (WhatsApp) → Stripe Checkout
→ Webhook Stripe → Supabase (statut payé) → Notification WhatsApp
```

### Pourboire nominatif
```
Client → "Envoyer pourboire à Léa ?" → Stripe Payment Intent
→ Webhook → Supabase tips (practitioner_id) → Cumul dashboard
```

### Répondeur téléphonique
```
Appel entrant → Telnyx → Webhook n8n → Gemini (STT + NLU)
→ Réservation Supabase → TTS → Confirmation vocale
```

---

## 7. Sécurité — Points critiques

| Point | Implémentation |
|---|---|
| Webhooks entrants | Validation HMAC (Stripe, Telnyx, WhatsApp) |
| Idempotency Stripe | Clé d'idempotence sur chaque PaymentIntent |
| Isolation données | RLS Supabase sur `merchant_id` pour chaque table |
| Secrets | Infisical vault — jamais en .env commité |
| Auth dashboard | Supabase Auth — email + Magic Link + MFA |
| API routes | Middleware Next.js — vérification session à chaque route |
| Inputs Gemini | Sanitisation avant injection dans les prompts |
| Cross-tenant | Vérification FK par merchant_id avant chaque insert |

---

## 8. Services externes — Limites & coûts

| Service | Limite | Coût estimé |
|---|---|---|
| Gemini 2.5 Flash Lite | — | ~0,001$/1K tokens (très bas) |
| Telnyx | — | ~1$/numéro/mois + 0,004$/SMS |
| Stripe | — | 1,5% + 0,25€ par transaction |
| Supabase | 500MB free, 8GB pro | 25$/mois pro |
| Vercel | 100GB bandwidth free | 20$/mois pro |
| n8n (self-hosted) | Illimité | Inclus VPS Hostinger ~15€/mois |

---

*Mis à jour le 29/03/2026 — Version architecture 5.0*
