# API Contracts: /api/v1/

**Branch**: `001-saas-reservation-ia` | **Date**: 2026-03-28

Toutes les routes sont protégées par authentification Supabase Auth (JWT) sauf mention contraire. Les données sont filtrées par `merchant_id` via RLS.

---

## Bookings

### GET /api/v1/bookings
Liste les réservations du commerçant.

**Query params** :
- `date` (string, ISO date) — Filtrer par jour
- `week` (string, ISO date) — Filtrer par semaine (lundi de la semaine)
- `month` (string, YYYY-MM) — Filtrer par mois
- `practitioner_id` (UUID) — Filtrer par praticien
- `status` (string) — Filtrer par statut

**Response 200** :
```json
{
  "data": [
    {
      "id": "uuid",
      "client": { "id": "uuid", "name": "string" },
      "practitioner": { "id": "uuid", "name": "string", "color": "#hex" },
      "service": { "id": "uuid", "name": "string", "duration_minutes": 30 },
      "starts_at": "ISO8601",
      "ends_at": "ISO8601",
      "status": "confirmed",
      "source_channel": "whatsapp"
    }
  ]
}
```

### POST /api/v1/bookings
Crée une réservation (depuis le dashboard).

**Body** :
```json
{
  "client_id": "uuid",
  "practitioner_id": "uuid",
  "service_id": "uuid",
  "starts_at": "ISO8601"
}
```

**Response 201** : Booking créé.
**Response 409** : Conflit de créneau.

### PATCH /api/v1/bookings/:id
Modifie une réservation (statut, heure, praticien).

**Body** :
```json
{
  "status": "confirmed | in_progress | completed | cancelled | no_show",
  "starts_at": "ISO8601",
  "practitioner_id": "uuid",
  "version": 1
}
```

**Response 200** : Booking mis à jour.
**Response 409** : Version mismatch (verrouillage optimiste).

---

## Clients

### GET /api/v1/clients
Liste les clients du commerçant.

**Query params** :
- `search` (string) — Recherche par nom/téléphone
- `page` (integer) — Pagination
- `limit` (integer, default 50)

### GET /api/v1/clients/:id
Fiche client détaillée avec historique, fidélité, forfaits.

### POST /api/v1/clients
Crée un client manuellement.

### PATCH /api/v1/clients/:id
Met à jour un client (nom, téléphone, notes, déblocage no-show).

---

## Services

### GET /api/v1/services
Liste des services du salon.

### POST /api/v1/services
Crée un service.

**Body** :
```json
{
  "name": "Coupe homme",
  "duration_minutes": 30,
  "price_cents": 2500,
  "description": "optional"
}
```

### PATCH /api/v1/services/:id
Modifie un service.

### DELETE /api/v1/services/:id
Désactive un service (soft delete via `is_active = false`).

---

## Practitioners

### GET /api/v1/practitioners
Liste des praticiens du salon.

### POST /api/v1/practitioners
Ajoute un praticien.

### PATCH /api/v1/practitioners/:id
Modifie un praticien.

### GET /api/v1/practitioners/:id/availability
Disponibilités d'un praticien (récurrentes + exceptions).

### PUT /api/v1/practitioners/:id/availability
Met à jour les disponibilités.

---

## Tips

### GET /api/v1/tips
Liste des pourboires (filtrable par praticien, période).

### GET /api/v1/tips/summary
Résumé agrégé par praticien.

---

## Stats

### GET /api/v1/stats
Statistiques du commerçant.

**Query params** :
- `period` (string) — `day`, `week`, `month`, `year`
- `date` (string, ISO date)

**Response 200** :
```json
{
  "total_bookings": 150,
  "completed": 130,
  "cancelled": 10,
  "no_shows": 5,
  "fill_rate": 0.87,
  "revenue_cents": 325000,
  "tips_cents": 15000,
  "by_practitioner": [
    {
      "practitioner_id": "uuid",
      "name": "Marc",
      "bookings": 45,
      "revenue_cents": 112500,
      "tips_cents": 8000
    }
  ]
}
```

---

## Auth (non protégé)

### POST /api/v1/auth/magic-link
Envoie un Magic Link.

**Body** : `{ "email": "string" }`
**Response 200** : `{ "message": "Magic link sent" }`

### GET /api/v1/auth/callback
Callback Supabase Auth après clic Magic Link. Redirige vers le dashboard.

---

## Site de réservation (public, non protégé)

### GET /api/v1/booking/:slug
Infos publiques du salon (nom, services, praticiens, créneaux disponibles).

### POST /api/v1/booking/:slug/reserve
Crée une réservation depuis le site public.
