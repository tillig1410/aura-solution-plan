# PLAN — Instructions pour Claude Code

## Langue
Toujours répondre en français.

## Projet
Plan est un SaaS de gestion de réservations avec IA conversationnelle destiné aux salons de coiffure, barbiers et instituts de beauté. L'IA gère les réservations via WhatsApp, SMS, Messenger et Téléphone (voix).

## Stack technique
- **Frontend** : Next.js 14+ (App Router) + Tailwind CSS + shadcn/ui — déployé sur Vercel
- **Backend/BDD** : Supabase (PostgreSQL, Auth, RLS, Realtime, Edge Functions)
- **IA / NLU** : Gemini 2.5 Flash Lite (Google AI API)
- **Orchestration** : n8n (self-hosted, Docker Compose)
- **Téléphonie & SMS** : Telnyx (Voice, SMS, numéros locaux)
- **Messagerie** : WhatsApp Business API, Messenger API
- **Paiement** : Stripe (Connect, PaymentIntent, Subscriptions)
- **Cache/Queue** : Redis + Bull
- **Hébergement n8n** : Hostinger VPS KVM 2 + failover Hetzner CX22

## Structure du projet
```
aura-solutions/
├── frontend/                # Next.js app (dashboard commerçant + site réservation)
│   ├── app/                 # App Router (pages)
│   │   ├── (auth)/          # Login, register, onboarding
│   │   ├── (dashboard)/     # Interface commerçant
│   │   │   ├── agenda/      # Vue calendrier (jour/semaine/mois)
│   │   │   ├── clients/     # Liste + fiche client
│   │   │   ├── messages/    # Conversations WhatsApp/SMS/Tél IA
│   │   │   ├── services/    # Catalogue services, praticiens, horaires
│   │   │   ├── stats/       # Statistiques, performance, pourboires
│   │   │   └── settings/    # Paramètres salon, IA, paiements, fidélité
│   │   └── (booking)/       # Site de réservation public
│   ├── components/          # Composants réutilisables
│   │   ├── ui/              # shadcn/ui components
│   │   ├── agenda/          # Composants calendrier
│   │   ├── clients/         # Composants clients
│   │   └── layout/          # Sidebar, TopBar, etc.
│   ├── lib/                 # Utils, hooks, API clients
│   │   ├── supabase/        # Client Supabase, types générés
│   │   ├── stripe/          # Helpers Stripe
│   │   └── telnyx/          # Helpers Telnyx
│   └── public/              # Assets statiques
├── supabase/                # Config Supabase
│   ├── migrations/          # Migrations SQL
│   ├── functions/           # Edge Functions (webhooks, etc.)
│   └── seed.sql             # Données de test
├── n8n/                     # Workflows n8n exportés (JSON)
├── docs/                    # Documentation technique
└── CLAUDE.md                # Ce fichier
```

## Conventions de code
- TypeScript strict partout (pas de `any`)
- Composants React : fonctions fléchées + export default
- Nommage : camelCase pour variables/fonctions, PascalCase pour composants, snake_case pour colonnes BDD
- Fichiers : kebab-case (ex : `client-card.tsx`, `tip-history.tsx`)
- Imports : absolus avec alias `@/` (ex : `@/components/ui/button`)
- CSS : Tailwind uniquement, pas de CSS custom sauf cas exceptionnel
- Tests : Vitest + React Testing Library

## Base de données (Supabase)
Tables principales :
- `merchants` — Commerçants (salons)
- `practitioners` — Praticiens (employés d'un salon)
- `services` — Catalogue de services (coupe, coloration, etc.)
- `clients` — Clients du salon
- `bookings` — Réservations
- `tips` — Pourboires nominatifs (liés au praticien)
- `packages` — Forfaits/packs créés par le commerçant
- `client_packages` — Forfaits achetés par les clients
- `conversations` — Historique des conversations IA
- `notifications` — Rappels et notifications envoyés

Toutes les tables utilisent RLS (Row Level Security) pour isoler les données par commerçant.

## Fonctionnalités clés
1. **Agenda** : Vue jour/semaine/mois, multi-praticiens, couleurs par praticien
2. **IA conversationnelle** : Gère les RDV via WhatsApp/SMS/Tél, personnalité configurable
3. **Répondeur Tél. IA** : Option payante, Telnyx Voice, transcription automatique
4. **Pourboires nominatifs** : Le client envoie un pourboire au praticien nommément, cumul visible dans le dashboard
5. **Forfaits & Packs** : Prépayés, créés par le commerçant, décomptés à chaque visite
6. **Abonnements clients** : Via Stripe Subscriptions (ex : "barbe illimitée 49€/mois")
7. **Fidélité** : Points par visite/euro, paliers Bronze/Silver/Gold
8. **Avis Google** : Demande automatique post-prestation
9. **Site de réservation** : URL dédiée, personnalisable, QR code

## Tarification AurA
- Base : 16,90€/mois (1 siège), dégressif jusqu'à 54,90€ (7 sièges)
- Option Tél. IA : +7€ à +52€/mois selon nb de sièges
- Early Adopter : -30% à vie (50 premiers)
- Pas de commission sur les réservations

## Commandes utiles
```bash
# Frontend
cd frontend && npm run dev          # Dev server
npm run build                        # Build prod
npm run lint                         # ESLint
npm run test                         # Tests Vitest

# Supabase
npx supabase start                   # Supabase local
npx supabase db push                 # Appliquer migrations
npx supabase gen types typescript    # Générer types TS

# n8n
docker compose up -d                 # Démarrer n8n
```

## Règles importantes
- NE JAMAIS exposer de clés API dans le code frontend
- Toujours utiliser les variables d'environnement (.env.local)
- Toujours activer RLS sur les nouvelles tables Supabase
- Les webhooks Stripe/Telnyx passent par des Edge Functions Supabase
- L'IA (Gemini) est appelée depuis n8n, jamais directement depuis le frontend
