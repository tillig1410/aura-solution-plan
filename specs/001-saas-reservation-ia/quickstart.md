# Quickstart: Plan — SaaS de Réservation par IA

**Branch**: `001-saas-reservation-ia` | **Date**: 2026-03-28

## Prérequis

- Node.js 20+
- Docker & Docker Compose (pour n8n, Redis, Supabase local)
- Comptes : Supabase, Stripe, Telnyx, Meta Developer (WhatsApp/Messenger), Telegram Bot

## 1. Cloner et installer

```bash
git clone <repo-url> plan-app
cd plan-app
npm install
```

## 2. Variables d'environnement

Copier `.env.example` → `.env.local` et remplir :

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Telnyx
TELNYX_API_KEY=KEY_xxx
TELNYX_WEBHOOK_SECRET=xxx

# WhatsApp
WHATSAPP_VERIFY_TOKEN=xxx
WHATSAPP_APP_SECRET=xxx
WHATSAPP_ACCESS_TOKEN=xxx

# Messenger
MESSENGER_VERIFY_TOKEN=xxx
MESSENGER_APP_SECRET=xxx
MESSENGER_PAGE_ACCESS_TOKEN=xxx

# Telegram
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_WEBHOOK_SECRET=xxx

# n8n
N8N_WEBHOOK_URL=http://localhost:5678/webhook/booking-conversation

# Redis
REDIS_URL=redis://localhost:6379
```

## 3. Démarrer Supabase local

```bash
npx supabase start
npx supabase db push        # Appliquer les migrations
npx supabase gen types typescript --local > src/types/supabase.ts
```

## 4. Démarrer n8n + Redis

```bash
docker compose up -d         # Lance n8n + Redis
```

Importer les workflows depuis `n8n/workflows/` dans l'interface n8n (`http://localhost:5678`).

## 5. Démarrer le frontend

```bash
npm run dev                  # http://localhost:3000
```

## 6. Seed de test

```bash
npx supabase db seed         # Charge les données de test
```

Cela crée :
- 1 commerçant de test ("Salon Démo") avec Magic Link `demo@plan-app.com`
- 2 praticiens (Marc, Sophie) avec couleurs et horaires
- 5 services (Coupe homme, Coupe femme, Barbe, Coloration, Brushing)
- 10 clients avec historique de visites
- 20 réservations à différents statuts

## 7. Vérification

| Vérification | Commande / Action |
|---|---|
| Frontend OK | Ouvrir `http://localhost:3000`, se connecter avec `demo@plan-app.com` |
| Agenda visible | Page Agenda affiche les RDV du jour par praticien |
| API fonctionne | `curl http://localhost:3000/api/v1/bookings` (avec auth header) |
| n8n actif | `http://localhost:5678` — workflows importés et actifs |
| Redis connecté | `docker exec -it redis redis-cli PING` → PONG |
| Tests passent | `npm run test` |

## 8. Tunneling pour webhooks (dev)

Pour tester les webhooks en local :

```bash
npx ngrok http 3000
```

Configurer l'URL ngrok dans :
- WhatsApp Business → Webhook URL
- Stripe → Webhook endpoint
- Telnyx → Messaging profile webhook
- Telegram → `setWebhook`
- Messenger → Webhook URL
