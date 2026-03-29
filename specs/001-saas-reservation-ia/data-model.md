# Data Model: Plan — SaaS de Réservation par IA

**Branch**: `001-saas-reservation-ia` | **Date**: 2026-03-28

## Conventions

- Toutes les tables : `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`
- Multi-tenant : chaque table a `merchant_id UUID REFERENCES merchants(id)` avec RLS policy
- Colonnes en `snake_case`
- Indexes sur les FK et colonnes de recherche

---

## Entités

### merchants

Propriétaire du salon. Point d'ancrage multi-tenant.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | Identifiant unique |
| user_id | UUID | FK auth.users, UNIQUE | Lien Supabase Auth |
| name | TEXT | NOT NULL | Nom du salon |
| slug | TEXT | UNIQUE, NOT NULL | URL du site de réservation |
| email | TEXT | NOT NULL | Email de contact |
| phone | TEXT | | Téléphone du salon |
| address | TEXT | | Adresse physique |
| timezone | TEXT | NOT NULL, DEFAULT 'Europe/Paris' | Fuseau horaire |
| opening_hours | JSONB | NOT NULL | Horaires d'ouverture par jour |
| stripe_account_id | TEXT | | ID compte Stripe Connect |
| stripe_subscription_id | TEXT | | ID abonnement Plan |
| seat_count | INTEGER | NOT NULL, DEFAULT 1 | Nombre de sièges facturés |
| ai_name | TEXT | DEFAULT 'AurA' | Nom de l'IA pour les clients |
| ai_tone | TEXT | DEFAULT 'friendly' | Ton de l'IA (friendly, formal, casual) |
| ai_languages | TEXT[] | DEFAULT '{fr}' | Langues supportées par l'IA |
| cancellation_delay_minutes | INTEGER | DEFAULT 120 | Délai minimum d'annulation (minutes) |
| voice_enabled | BOOLEAN | DEFAULT false | Option répondeur IA activée |
| telnyx_phone_number | TEXT | | Numéro Telnyx attribué |
| google_place_id | TEXT | | ID Google pour les avis |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

### practitioners

Employés du salon. Reçoivent les RDV et les pourboires.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| merchant_id | UUID | FK merchants, NOT NULL | Multi-tenant |
| name | TEXT | NOT NULL | Nom du praticien |
| email | TEXT | | Email (optionnel) |
| color | TEXT | NOT NULL | Couleur dans l'agenda (#hex) |
| specialties | TEXT[] | DEFAULT '{}' | Spécialités |
| is_active | BOOLEAN | DEFAULT true | Actif ou désactivé |
| sort_order | INTEGER | DEFAULT 0 | Ordre d'affichage |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

### practitioner_availability

Disponibilités récurrentes et exceptions (congés, pauses).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| merchant_id | UUID | FK merchants, NOT NULL | Multi-tenant |
| practitioner_id | UUID | FK practitioners, NOT NULL | |
| day_of_week | SMALLINT | 0-6 (lun-dim), NULL pour exceptions | Jour de la semaine |
| start_time | TIME | NOT NULL | Début du créneau |
| end_time | TIME | NOT NULL | Fin du créneau |
| is_available | BOOLEAN | DEFAULT true | Disponible ou bloqué |
| exception_date | DATE | | Date spécifique (congé, jour férié) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### services

Catalogue de prestations du salon.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| merchant_id | UUID | FK merchants, NOT NULL | Multi-tenant |
| name | TEXT | NOT NULL | Nom du service |
| description | TEXT | | Description optionnelle |
| duration_minutes | INTEGER | NOT NULL | Durée en minutes |
| price_cents | INTEGER | NOT NULL | Prix en centimes d'euros |
| is_active | BOOLEAN | DEFAULT true | Actif ou masqué |
| sort_order | INTEGER | DEFAULT 0 | Ordre d'affichage |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

### practitioner_services

Relation N:N entre praticiens et services (quels praticiens peuvent réaliser quel service).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| practitioner_id | UUID | FK practitioners, PK composite | |
| service_id | UUID | FK services, PK composite | |
| merchant_id | UUID | FK merchants, NOT NULL | Multi-tenant (dénormalisé pour RLS) |

### clients

Clients du salon, identifiés par canal de messagerie.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| merchant_id | UUID | FK merchants, NOT NULL | Multi-tenant |
| name | TEXT | | Nom (peut être découvert par l'IA) |
| phone | TEXT | | Numéro de téléphone |
| email | TEXT | | Email |
| whatsapp_id | TEXT | | Identifiant WhatsApp |
| messenger_id | TEXT | | Identifiant Messenger |
| telegram_id | TEXT | | Identifiant Telegram |
| preferred_practitioner_id | UUID | FK practitioners | Praticien habituel |
| preferred_service_id | UUID | FK services | Service habituel |
| preferred_language | TEXT | DEFAULT 'fr' | Langue préférée |
| loyalty_points | INTEGER | DEFAULT 0 | Points de fidélité cumulés |
| loyalty_tier | TEXT | DEFAULT 'bronze' | Palier : bronze, silver, gold |
| no_show_count | INTEGER | DEFAULT 0 | Compteur de no-shows |
| is_blocked | BOOLEAN | DEFAULT false | Bloqué IA après 3 no-shows |
| notes | TEXT | | Notes du commerçant |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Index unique** : `(merchant_id, phone)`, `(merchant_id, whatsapp_id)`, `(merchant_id, messenger_id)`, `(merchant_id, telegram_id)`

### bookings

Réservations. Cycle de vie à 6 états.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| merchant_id | UUID | FK merchants, NOT NULL | Multi-tenant |
| client_id | UUID | FK clients, NOT NULL | |
| practitioner_id | UUID | FK practitioners, NOT NULL | |
| service_id | UUID | FK services, NOT NULL | |
| starts_at | TIMESTAMPTZ | NOT NULL | Début du RDV |
| ends_at | TIMESTAMPTZ | NOT NULL | Fin du RDV (calculé : starts_at + duration) |
| status | TEXT | NOT NULL, DEFAULT 'pending' | pending, confirmed, in_progress, completed, cancelled, no_show |
| source_channel | TEXT | NOT NULL | Canal d'origine : whatsapp, messenger, telegram, sms, voice, dashboard, booking_page |
| cancelled_at | TIMESTAMPTZ | | Date d'annulation |
| cancelled_by | TEXT | | 'client' ou 'merchant' |
| version | INTEGER | DEFAULT 1 | Verrouillage optimiste |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Index** : `(merchant_id, practitioner_id, starts_at)` UNIQUE pour empêcher les doublons de créneau.

**Transitions d'état** :
```
pending → confirmed (IA ou commerçant confirme)
pending → cancelled (client ou commerçant annule)
confirmed → in_progress (commerçant démarre la prestation)
confirmed → cancelled (annulation avant le RDV)
confirmed → no_show (commerçant marque le no-show)
in_progress → completed (prestation terminée)
```

### conversations

Historique des échanges IA, tous canaux confondus.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| merchant_id | UUID | FK merchants, NOT NULL | Multi-tenant |
| client_id | UUID | FK clients, NOT NULL | |
| channel | TEXT | NOT NULL | whatsapp, messenger, telegram, sms, voice |
| is_active | BOOLEAN | DEFAULT true | Conversation en cours |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

### messages

Messages individuels dans une conversation.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| merchant_id | UUID | FK merchants, NOT NULL | Multi-tenant |
| conversation_id | UUID | FK conversations, NOT NULL | |
| sender | TEXT | NOT NULL | 'client' ou 'ai' |
| content | TEXT | NOT NULL | Contenu du message |
| is_voice_transcription | BOOLEAN | DEFAULT false | Transcription d'appel |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### tips

Pourboires nominatifs par praticien.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| merchant_id | UUID | FK merchants, NOT NULL | Multi-tenant |
| booking_id | UUID | FK bookings | RDV associé (optionnel) |
| client_id | UUID | FK clients, NOT NULL | |
| practitioner_id | UUID | FK practitioners, NOT NULL | Praticien nommé |
| amount_cents | INTEGER | NOT NULL | Montant en centimes |
| stripe_payment_intent_id | TEXT | | Référence Stripe |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### packages

Forfaits prépayés créés par le commerçant.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| merchant_id | UUID | FK merchants, NOT NULL | Multi-tenant |
| name | TEXT | NOT NULL | Nom (ex : "5 coupes") |
| service_id | UUID | FK services, NOT NULL | Service concerné |
| total_uses | INTEGER | NOT NULL | Nombre d'utilisations incluses |
| price_cents | INTEGER | NOT NULL | Prix du forfait |
| validity_days | INTEGER | | Durée de validité (NULL = illimité) |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

### client_packages

Forfaits achetés par les clients.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| merchant_id | UUID | FK merchants, NOT NULL | Multi-tenant |
| client_id | UUID | FK clients, NOT NULL | |
| package_id | UUID | FK packages, NOT NULL | |
| remaining_uses | INTEGER | NOT NULL | Utilisations restantes |
| purchased_at | TIMESTAMPTZ | DEFAULT NOW() | |
| expires_at | TIMESTAMPTZ | | Date d'expiration (calculée) |
| stripe_payment_intent_id | TEXT | | Référence paiement |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### client_subscriptions

Abonnements clients récurrents.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| merchant_id | UUID | FK merchants, NOT NULL | Multi-tenant |
| client_id | UUID | FK clients, NOT NULL | |
| service_id | UUID | FK services, NOT NULL | Service inclus |
| name | TEXT | NOT NULL | Nom (ex : "barbe illimitée") |
| price_cents | INTEGER | NOT NULL | Prix mensuel |
| stripe_subscription_id | TEXT | NOT NULL | ID Stripe Subscription |
| status | TEXT | NOT NULL, DEFAULT 'active' | active, cancelled, past_due |
| current_period_uses | INTEGER | DEFAULT 0 | Utilisations ce mois |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

### loyalty_programs

Programme de fidélité configurable par commerçant.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| merchant_id | UUID | FK merchants, UNIQUE, NOT NULL | Un programme par salon |
| points_per_visit | INTEGER | DEFAULT 1 | Points gagnés par visite |
| points_per_euro | NUMERIC(5,2) | DEFAULT 0 | Points par euro dépensé |
| silver_threshold | INTEGER | DEFAULT 50 | Seuil palier Silver |
| gold_threshold | INTEGER | DEFAULT 100 | Seuil palier Gold |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

### notifications

Rappels et notifications envoyés.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| merchant_id | UUID | FK merchants, NOT NULL | Multi-tenant |
| client_id | UUID | FK clients, NOT NULL | |
| booking_id | UUID | FK bookings | |
| type | TEXT | NOT NULL | reminder_24h, reminder_1h, confirmation, cancellation, no_show, review_request, loyalty_upgrade, package_expiring |
| channel | TEXT | NOT NULL | Canal d'envoi |
| status | TEXT | NOT NULL, DEFAULT 'pending' | pending, sent, failed |
| scheduled_at | TIMESTAMPTZ | NOT NULL | Heure d'envoi prévue |
| sent_at | TIMESTAMPTZ | | Heure d'envoi effective |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

---

## Vues

### tips_by_practitioner

Agrégation des pourboires par praticien (mois en cours).

```sql
SELECT practitioner_id, merchant_id, SUM(amount_cents) as total_cents, COUNT(*) as tip_count
FROM tips
WHERE created_at >= date_trunc('month', NOW())
GROUP BY practitioner_id, merchant_id
```

### booking_stats

Statistiques de réservation par commerçant (mois en cours).

```sql
SELECT merchant_id,
  COUNT(*) as total_bookings,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'no_show') as no_shows,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
  SUM(s.price_cents) FILTER (WHERE b.status = 'completed') as revenue_cents
FROM bookings b JOIN services s ON b.service_id = s.id
WHERE b.created_at >= date_trunc('month', NOW())
GROUP BY b.merchant_id
```

---

## RLS Policies (pattern)

Chaque table suit le même pattern :

```sql
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{table}_tenant_isolation" ON {table}
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));
```
