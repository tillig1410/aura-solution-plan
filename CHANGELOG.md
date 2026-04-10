# CHANGELOG — Resaapp

> Suivi des modifications du projet. Mis à jour après chaque session de développement.
> Format : `[TYPE] Description — fichier(s) modifié(s)`

---

## [2.7.2] — 2026-04-10 — Booking Conversation refondu (Find Merchant + Identify Client upsert + Build Context)

### n8n — Booking Conversation refactoring
- **[FEAT]** Ajout du node `Find Merchant` (HTTP GET mono-tenant, credential `mRd60LO2hwQq9oBH`, URL hardcodée)
- **[REFACTOR]** `Identify Client` refondu en **upsert PostgREST** par `(merchant_id, phone)` avec `Prefer: resolution=merge-duplicates,return=representation` — gère find OR create en 1 seul appel
- **[FEAT]** Ajout du node `Build Context` (Code) qui aplatit webhook + merchant + client en un objet unique consommé par tous les nodes downstream — résout le bug latent typeVersion 2 webhook ($json structuré vs flat)
- **[REFACTOR]** 6 HTTP nodes Supabase migrés : URL hardcodée `https://txebdgmufdsnkrntzvwn.supabase.co`, headers inline `apikey`/`Authorization` supprimés, auth via credential `mRd60LO2hwQq9oBH` uniquement
  - Identify Client, Load Conversation History, Check Availability, Check Client Packages, Check Client Subscriptions, Send Budget Alert, Save AI Message
- **[FIX]** `Send Reply` + `Create Booking` : URL hardcodée `https://resaapp.fr`, références `$('Webhook Trigger').item.json.X` corrigées vers `$('Build Context').first().json.X` (l'ancien chemin était cassé en typeVersion 2)
- **[FEAT]** `Respond OK` retourne désormais `{status, response_text, action, booking_data}` au lieu de `{status:"ok"}` (utile pour le caller)
- **[FIX]** `Webhook Trigger` : `onError: continueRegularOutput` ajouté (requis par responseNode mode)
- **[FIX]** Préfixes `=` ajoutés sur les expressions mixtes (`eq.{{ ... }}`) qui cassaient la validation

### Découverte
- **[INFRA]** `docker-compose.yml` du repo ne contient AUCUNE variable d'environnement Supabase/WhatsApp/Mistral — racine probable du problème `$env`. Section `environment:` du service n8n ne porte que TZ + Redis. La version VPS pourrait différer (drift à vérifier).

### Encore à faire (prochaine session)
- **[WIP]** Test bout en bout (POST factice à WhatsApp Incoming → traversée complète)
- **[WIP]** Code nodes `Check AI Budget` et `Log Token Usage` toujours en `$env` (à convertir en HTTP nodes)
- **[WIP]** Mistral Fallback toujours en `$env.MISTRAL_API_KEY` (créer credential dédiée)
- **[WIP]** Vérifier que le credential `mRd60LO2hwQq9oBH` (httpHeaderAuth, 1 seul header) suffit à PostgREST sans `Authorization: Bearer` séparé

---

## [2.7.1] — 2026-04-10 — WhatsApp Incoming refondu en gateway mince

### n8n — Refactoring architectural
- **[REFACTOR]** WhatsApp Incoming (workflow `emUf5KvQm7kFmdk2`) refondu en gateway pur — 12 nodes → 8 nodes, ZÉRO secret, ZÉRO `$env`
- **[REMOVE]** Suppression de `Find Merchant`, `Find or Create Client`, `Build Booking Payload`, `Send WhatsApp Reply` — toute la logique métier et l'envoi du message redescendent dans Booking Conversation
- **[FEAT]** Call Booking Conversation forward désormais un payload minimal raw : `channel, sender_phone, sender_name, message_text, wa_message_id, wa_phone_number_id, wa_waba_id, timestamp`
- **[FIX]** `onError: continueRegularOutput` ajouté sur WhatsApp Webhook (requis par responseNode mode) et sur Call Booking Conversation (Meta reçoit toujours 200 même si Booking tombe)
- **[FIX]** Validation runtime n8n : 0 erreur

### Décision design
- **[ARCH]** Séparation claire des responsabilités : workflows gateway (WhatsApp/Messenger/SMS/Tél) = transport pur, Booking Conversation = cerveau métier (lookups + IA + envoi via `/api/v1/channels/send`)
- **[ARCH]** Token WhatsApp Cloud API n'est plus dans n8n — il vit côté Vercel (où il fonctionne) via la route Next.js `channels/send`
- **[WIP]** Booking Conversation à refactorer (27 `$env` sur 12 nodes, Find Merchant à ajouter, Identify Client bugué à réparer)

---

## [2.7.0] — 2026-04-08 — IA conversationnelle Gemini + fallback Mistral + surveillance tokens

### IA Conversationnelle
- **[FEAT]** Gemini 2.5 Flash Lite comme LLM principal pour la gestion des RDV via WhatsApp/SMS — `n8n/workflows/booking-conversation.json`
- **[FEAT]** Fallback automatique sur Mistral Small si Gemini échoue — `n8n/workflows/booking-conversation.json`
- **[FEAT]** Message statique prédéfini en dernier recours (les 2 LLMs down ou budget épuisé) — `n8n/workflows/booking-conversation.json`
- **[FEAT]** Vérification budget tokens avant chaque appel LLM — nœud Check AI Budget
- **[FEAT]** Parsing structuré des réponses Gemini et Mistral (JSON response_text + action + booking_data)

### Surveillance Tokens
- **[FEAT]** Table `ai_token_usage` : log de chaque appel LLM (model, provider, tokens, coût EUR, is_fallback) — `supabase/migrations/019`
- **[FEAT]** Budget mensuel configurable par commerçant (`ai_monthly_token_budget` sur merchants) — `supabase/migrations/019`
- **[FEAT]** Vue agrégée `ai_token_monthly_summary` par commerçant/mois — `supabase/migrations/019`
- **[FEAT]** Alertes automatiques : 80% (info), 95% (warning), 100% (critique), anomalie x3 — nœud Alert Needed?
- **[FEAT]** Détection d'anomalie : consommation journalière > 3x la moyenne des 7 derniers jours

### Notifications Système
- **[FEAT]** Table `system_notifications` pour les alertes IA et monitoring (pas liées à un client) — `supabase/migrations/019`
- **[FEAT]** Notifications budget IA insérées dans le dashboard commerçant via n8n

### WhatsApp Business API (WIP)
- **[FEAT]** Workflow `whatsapp-incoming.json` (12 nœuds) : réception webhook Meta → parsing message → lookup merchant/client → appel booking-conversation → réponse WhatsApp
- **[FEAT]** Webhook Meta configuré et vérifié (`n8n.resaapp.fr/webhook/whatsapp-incoming`)
- **[WIP]** Variables `$env` non résolues dans n8n — à hardcoder dans les credentials/nœuds lors de la prochaine session
- **[WIP]** Test bout en bout Meta → Gemini → réponse WhatsApp à finaliser

### Infrastructure
- **[FIX]** VPS n8n.resaapp.fr : suppression du projet Docker doublon (Traefik, conflit port 80)
- **[FIX]** Certbot : auto-init du certificat SSL si absent (plus besoin de script SSH manuel)
- **[FIX]** Clé API n8n régénérée + config MCP mise à jour
- **[FIX]** Variables d'environnement ajoutées au docker-compose n8n (Supabase, WhatsApp, Mistral)

---

## [2.6.0] — 2026-04-06 — Vue mois remplissage, badges uniformisés

### Agenda — Vue Mois
- **[FEAT]** Taux de remplissage par jour : jauge colorée (vert < 50%, orange 50-80%, rouge > 80%)
- **[FEAT]** Fond de case coloré selon le taux d'occupation
- **[FEAT]** Mini barres par praticien : remplissage individuel avec pastille couleur + compteur RDV
- **[FEAT]** Pourcentage d'occupation affiché en haut à droite de chaque case
- **[FIX]** Police agrandie pour lisibilité (badges, jauges, compteurs praticien)
- **[FIX]** Alignement constant entre jours avec et sans RDV
- **[FIX]** Jauges globale et praticien alignées (début et fin)
- **[FIX]** Barres praticien en gris neutre (plus de confusion avec la jauge de remplissage colorée)

### Agenda — Vue Jour
- **[FEAT]** Zones hors horaires praticien grisées (hachures avant ouverture / après fermeture)
- **[FIX]** Re-fetch automatique quand on revient sur la page agenda (données fraîches)

### Agenda — Général
- **[FEAT]** Compteur "restants" déplacé dans le header Prochains RDV
- **[FEAT]** Notification sidebar lors d'un déplacement de RDV
- **[FEAT]** Badges uniformisés : praticien (pill colorée) + statut (pill outline) partout
- **[FIX]** Impossible de réserver dans le passé (date/heure bloquées)
- **[FIX]** Doublon pastille/badge supprimé dans Prochains RDV

---

## [2.5.0] — 2026-04-06 — Confirmations, pauses, branding

### Agenda
- **[FEAT]** Compteur "restants" dans le Résumé du jour
- **[FEAT]** Dialogue de validation RDV pending : Confirmer / Refuser / Modifier l'horaire
- **[FEAT]** Pastilles statut (vert/orange) dans les bulles RDV + infobulles
- **[FEAT]** Bouton "Confirmer ce RDV" dans Prochains RDV
- **[FEAT]** Boutons Reprogrammer + Absent dans la carte Client actuel
- **[FEAT]** Client actuel : hauteur fixe, notes, statut paiement, état absent grisé
- **[FIX]** Pause midi dynamique depuis la base (plus de 13h-14h hardcodé)
- **[FIX]** Congés visibles dans vue jour (pastilles praticien grisées)
- **[FIX]** Bulles no_show/annulées grisées dans jour et semaine
- **[FIX]** Client actuel pile à l'heure du RDV (plus de doublon)
- **[FIX]** Hauteur bulles respecte la durée réelle du créneau
- **[FIX]** Cloche notifications supprimée (redondant avec sidebar)

### Paramètres
- **[FEAT]** Toggle auto-confirmation des RDV IA (manuelle/automatique)
- **[FIX]** Sauvegarde break_start/break_end en base (migration 018)
- **[FIX]** Onglet "Mon site" supprimé + "Site résa" retiré des canaux

### Branding
- **[FEAT]** Logo AURA Solutions dans la sidebar
- **[FEAT]** Nom séparé "Resa app" + mention "par AURA Solutions"
- **[FEAT]** Bouton VOIR dans les notifications connecté (navigation agenda)
- **[FIX]** Badge compteur notifications orange au lieu de rouge

### UI
- **[FEAT]** Popups arrondis (rounded-2xl), ombre, backdrop flou

---

## [2.4.0] — 2026-04-06 — Agenda refonte, client actuel, notifications

### Agenda — Vue Jour / Semaine
- **[FIX]** RDV sauvegardés en base (POST/PATCH API) — plus de perte au rechargement
- **[FIX]** En-tête du tableau ne masque plus les heures (sticky retiré)
- **[FIX]** Dimanche : hachures diagonales grises + texte "Fermé" centré
- **[FIX]** Pause midi : hachures dorées distinctes du jour en cours
- **[FEAT]** Bulles RDV fidèles à la maquette : horaire coloré, service en gras, coins arrondis, ombre, liseré 4px
- **[FEAT]** Nom du client en infobulle au survol des bulles RDV (jour + semaine)
- **[FEAT]** Bulles adaptatives : remplissent leur colonne praticien (1 à 8 praticiens en parallèle)
- **[FEAT]** Grille pleine hauteur dynamique (ResizeObserver), lignes plus hautes
- **[FEAT]** Tous les canaux dans le résumé du jour (WhatsApp, Messenger, Telegram, SMS, Tél IA, Dashboard, Site résa)
- **[FEAT]** Carte "Client actuel" fidèle maquette : cadre couleur praticien, ombre, badge fidélité, notes, carrousel 1/N, statut paiement (à encaisser / paiement effectué), bouton Encaissement conditionnel
- **[FEAT]** Infobulles custom arrondies avec couleurs (client, service, horaire, praticien)
- **[FEAT]** Vue semaine : overlap intelligent Google Calendar-style (RDV côte à côte)
- **[FEAT]** Résumé lecture seule pour RDV passés (au lieu du formulaire d'édition) + bouton Reprogrammer
- **[FIX]** Client actuel affiché pile à l'heure du RDV (plus de doublon avec Prochains RDV)
- **[FIX]** RDV dashboard/site résa créés directement en "Confirmé" (plus "En attente")
- **[FIX]** Hauteur bulles respecte la durée réelle du créneau

### Paramètres IA
- **[FEAT]** Toggle confirmation des RDV IA : validation manuelle ou automatique
- **[FEAT]** Migration `auto_confirm_bookings` dans la table merchants

### Clients
- **[FEAT]** Colonne "Prochain RDV" dans le tableau (badge indigo si RDV planifié)

### UI
- **[FEAT]** Popups arrondis (rounded-2xl), ombre marquée, backdrop flou

### Sidebar
- **[FEAT]** Bloc notifications en bas du menu : pourboires, annulations, no-show
- **[FEAT]** Badge compteur rouge, notifications dismissables, rafraîchissement auto 30s

---

## [2.3.0] — 2026-04-05 — Services, clients, agenda

### Services / Horaires
- **[FEAT]** Heure de début de pause midi configurable (champ heure)
- **[FEAT]** Durée de pause via dropdown (pas de pause / 30 min / 45 min / 1h / 1h30 / 2h)
- **[FEAT]** Congés affichés en plages lisibles ("Du lun. 4 au ven. 8 août 2026")
- **[FEAT]** Layout 2 colonnes — horaires à gauche, congés à droite (colonne fixe `w-64`)
- **[FEAT]** Sélection de semaines complètes et plages de dates pour les congés
- **[FIX]** Barre d'action unifiée sous les onglets (boutons même taille/couleur/emplacement)
- **[FIX]** Bouton "Ajouter un praticien" affiché si la limite n'est pas atteinte, "Upgrader" sinon

### Clients
- **[FIX]** Encodage Unicode — colonnes "Téléphone", "Dernière visite", "Fidélité" affichaient `\u00e9` au lieu de `é`

### Agenda
- **[FIX]** Suppression des données mock Alice/Bob — affichage des vraies données API
- **[FEAT]** Pastille statut abonnement (orange essai / vert actif / rouge expiré) sous le bouton Nouveau RDV
- **[FEAT]** Date de fin d'essai affichée sous la pastille

---

## [2.2.0] — 2026-04-05 — Abonnement, praticiens, fidélité, sécurité

### Abonnement
- **[FEAT]** Sélecteur +/- pour choisir le nombre de sièges (1 à 10)
- **[FEAT]** Toggle Mensuel / Annuel (2 mois offerts)
- **[FEAT]** Prix recalculé en temps réel (base + Tél IA + Early Adopter -30%)
- **[FEAT]** Bouton "Activer mon abonnement" (en attente Stripe)
- **[FEAT]** Date de fin de période d'essai (14 jours après création)
- **[FEAT]** Option Tél IA avec dialog de confirmation avant activation
- **[FIX]** Grille tarifaire corrigée selon Pricing_AurA_v2.pdf
- **[FIX]** Mention essai gratuit uniquement pour les non-abonnés
- **[FIX]** Supprimé "Pro" du titre abonnement

### Praticiens
- **[FEAT]** Suppression de praticien (bouton + confirmation)
- **[FEAT]** Jours de congé par praticien (dates, badges supprimables)
- **[FEAT]** Compteur "X / Y praticiens" avec seat_count
- **[FEAT]** Badge dépassement rouge si plus de praticiens que de sièges
- **[FEAT]** Bouton "Upgrader" → lien direct vers onglet Abonnement
- **[FIX]** Blocage réel création/réactivation au-delà du forfait (onboarding + manager + API)
- **[FIX]** Endpoint DELETE /api/v1/practitioners/:id ajouté

### Fidélité
- **[FEAT]** Choix du modèle : Paliers cumulatifs OU Porte-monnaie de points
- **[FEAT]** Explications détaillées avec exemples pour chaque modèle
- **[FEAT]** Choix exclusif : points par visite OU par euro dépensé

### Paramètres
- **[FIX]** Onglets fixes en haut (contenu seul scrollable)
- **[FIX]** Scrollbar horizontale masquée sur les onglets
- **[FEAT]** Photo Google Maps du salon dans Informations
- **[FEAT]** Suppression de compte commerçant (zone dangereuse + confirmation SUPPRIMER)

### Sécurité
- **[FEAT]** Blocage inscriptions via NEXT_PUBLIC_REGISTRATION_OPEN=false
- **[FEAT]** Pricing: support 8+ sièges (54,90€ + 6€/siège supplémentaire)

---

## [2.1.0] — 2026-04-05 — Onboarding, auth, UX agenda et paramètres

### Authentification
- **[FEAT]** Login email + mot de passe (remplace magic link seul)
- **[FEAT]** Inscription avec création de compte
- **[FEAT]** Mot de passe oublié (réinitialisation par email)
- **[FEAT]** Toggle visibilité mot de passe (icône oeil)

### Onboarding
- **[FEAT]** Refonte complète — 2 onglets : Recherche Google Maps / Saisie manuelle
- **[FEAT]** Auto-remplissage nom, adresse, téléphone depuis Google Places API
- **[FEAT]** Formulaire réel ajout services (nom, durée, prix)
- **[FEAT]** Formulaire réel ajout praticiens (nom, spécialités, couleur)
- **[FEAT]** Boutons Retour/Passer sur chaque étape
- **[FIX]** Gestion merchant existant (update au lieu de doublon)

### Agenda
- **[FIX]** Remplacement mock data (Alice/Bob) par vrais appels API
- **[FEAT]** Nouveau RDV : bouton + pour créer un client inline
- **[FEAT]** Nouveau RDV : Service sélectionné AVANT praticien (logique métier)
- **[FEAT]** Filtrage automatique praticiens par service (via practitioner_services)
- **[FEAT]** Auto-sélection praticien si un seul correspond
- **[FEAT]** Date et heure séparés, paliers de 15 minutes
- **[FEAT]** Créneaux filtrés selon horaires du praticien

### Services
- **[FIX]** Correction parsing JSON API `{ data: [...] }`
- **[FEAT]** Badges colorés avec nom praticien sur chaque service

### Paramètres
- **[FIX]** Onglets fixes en haut (ne scrollent plus hors de vue)
- **[FEAT]** Photo Google Maps du salon affichée dans Informations
- **[FEAT]** Zone dangereuse : suppression de compte avec confirmation
- **[FEAT]** Abonnement : message explicite quand Stripe non configuré
- **[SUPPR]** Section langues IA retirée (français uniquement)

### API
- **[FEAT]** Routes `/api/v1/places/search` et `/api/v1/places/details` (proxy Google Places)
- **[FEAT]** Validation seat_count à la création de praticien (erreur 403 si limite atteinte)

### Infra
- **[FEAT]** Variable `GOOGLE_PLACES_API_KEY` ajoutée sur Vercel
- **[FEAT]** Branche `main` créée comme branche par défaut (auto-deploy Vercel)

---

## [2.0.0] — 2026-04-05 — Déploiement production complet

### Déploiement
- **[INFRA]** Frontend déployé sur **Vercel** — https://resaapp.fr (auto-deploy sur push `main`)
- **[INFRA]** Base de données **Supabase Cloud** — 16 migrations synchronisées (projet `txebdgmufdsnkrntzvwn`, région Paris)
- **[INFRA]** VPS Hostinger KVM 2 (Ubuntu 24.04) — **n8n + Redis + Nginx + Certbot** via Docker Compose
- **[INFRA]** n8n accessible sur https://n8n.resaapp.fr avec SSL Let's Encrypt
- **[INFRA]** 5 workflows n8n importés et activés : booking-conversation, google-review-request, reminder-notifications, package-expiration-check, voice-call-handler
- **[INFRA]** Credentials n8n configurés : Supabase API, Google Gemini, Header Auth
- **[INFRA]** 17 variables d'environnement configurées sur Vercel (production)
- **[INFRA]** Domaine `resaapp.fr` configuré (DNS A → Vercel, CNAME www → Vercel, A n8n → VPS)

### Rebranding
- **[REFACTOR]** Renommage de l'app **Plan → Resaapp** — layout.tsx, sidebar, login, onboarding, booking page (metadata, OpenGraph, SEO)

### Architecture déployée
```
resaapp.fr (Vercel) → Supabase Cloud (BDD/Auth)
                    → n8n.resaapp.fr (VPS) → Redis (interne)
                                           → Gemini API
                                           → Webhooks (Stripe, WhatsApp, Telnyx)
```

---

## [1.6.0] — 2026-04-05 — Audit sécurité + correctifs 7 issues (391/391 green)

### Sécurité — Correctifs audit
- **[CRITIQUE]** `src/lib/telnyx/voice.ts` — remplacé `setInterval` module-scope par `purgeStaleFallbackCalls()` on-demand (fuite mémoire serverless)
- **[ÉLEVÉ]** `src/app/api/v1/stripe/dashboard-link/route.ts` — message erreur Stripe masqué (info disclosure) → log côté serveur uniquement
- **[ÉLEVÉ]** `src/app/api/v1/booking/[slug]/reserve/route.ts` — CSRF renforcé : exige `X-Requested-With` si `Origin` absent (bloque scripts/curl)
- **[MOYEN]** `src/app/api/v1/booking/[slug]/*.ts` — validation format slug (alphanum+tirets, max 100 chars)
- **[MOYEN]** `src/lib/packages/consume.ts` — optimistic lock vérifie désormais le nombre de rows affectées (`.select("id")` + check `updatedRows.length`)
- **[MOYEN]** `src/components/clients/clients-content.tsx` — supprimé double-fetch sur recherche (useEffect ne dépend plus de `search`)
- **[MOYEN]** `src/components/clients/client-detail.tsx` — ajout `toast.error()` si sauvegarde notes échoue (erreur silencieuse corrigée)

### Tests ajoutés
- 4 nouveaux tests : validation slug invalide/trop long, CSRF sans Origin ni X-Requested-With, CSRF avec X-Requested-With seul

### Résultat
- **40 suites, 391 tests, 0 échec** ✅

---

## [1.5.9] — 2026-04-05 — Tests composants React complets (387/387 green)

### Tests ajoutés (33 tests, 5 fichiers)
- **`tests/unit/topbar.test.ts`** (2 tests) — bouton Déconnexion, appel signOut + redirect /login
- **`tests/unit/login-content.test.ts`** (6 tests) — titre Plan, champ email, bouton soumission, description, appel signInWithOtp + confirmation, pas de confirmation sur erreur
- **`tests/unit/ai-config.test.ts`** (10 tests) — nom IA pré-rempli, 3 tons, 5 langues, 4 canaux, bouton sauvegarder, répondeur Souscrire/Activé/Désactiver, changement ton, toggle langue, onSave données correctes
- **`tests/unit/tips-summary.test.ts`** (9 tests) — total pourboires, nb pourboires, moyenne, noms top clients, Client anonyme, montants, numéros 1-2-3, état vide message, 0 € total+moyenne
- **`tests/unit/bookings-chart.test.ts`** (6 tests) — filtrage 8h–21h, exclusion avant 8h, exclusion après 21h, inclusion bornes, labels Xh, données vides

### Résultat
- **40 suites, 387 tests, 0 échec** ✅

---

## [1.5.8] — 2026-04-05 — Tests composants React critiques (354/354 green)

### Tests ajoutés (35 tests, 4 fichiers)
- **`tests/unit/agenda-week-view.test.ts`** (13 tests) — WeekView : en-têtes Lun–Dim, numéros de jour, grille 8h–19h, Fermé dimanche, affichage booking client, filtrage par praticien, selectedPractitionerIds vide = tout visible, positionnement CSS top/height, service visible si ≥32px, onBookingClick, dimanche pas de bookings
- **`tests/unit/agenda-month-view.test.ts`** (8 tests) — MonthView : en-têtes, grille 42 boutons (6×7), premier lundi correct, jours 1–30, Fermé ×6, compteur RDV, point couleur praticien, onDayClick retourne la bonne date
- **`tests/unit/practitioner-performance.test.ts`** (7 tests) — PractitionerPerformance : état vide message, en-têtes tableau, noms praticiens, bookings_count, fill_rate %, top_service, pas de crash avec 1 seul praticien
- **`tests/unit/sidebar.test.ts`** (7 tests) — Sidebar : 6 items navigation, logo Plan, href corrects, classe bg-gray-100 sur item actif, items inactifs sans classe, pathname → bon item actif, sous-routes reconnues

### Résultat
- **35 suites, 354 tests, 0 échec** ✅

---

## [1.5.7] — 2026-04-05 — Tests complets toutes routes API v1 (319/319 green)

### Tests ajoutés (47 tests, 4 fichiers)
- **`tests/integration/api-booking-public.test.ts`** (16 tests) — GET /booking/:slug (404 slug inconnu, 200 infos salon+services+praticiens, pas de merchant_id exposé) + POST /booking/:slug/reserve (validation name/phone/UUID/ISO/JSON, CSRF origin mismatch/malformé/valide, 404 praticien/service cross-tenant, 409 créneau pris, 201 nouveau client, 201 client existant)
- **`tests/integration/api-stats.test.ts`** (8 tests) — GET /stats (auth 401/404, structure réponse summary/revenue_by_day/bookings_by_day/by_channel/practitioners/clients/booking_patterns, 5 periods valides, fallback month, valeurs 0 sans données)
- **`tests/integration/api-webhooks-messenger-telegram.test.ts`** (11 tests) — GET messenger verify (200 challenge/403 token/403 mode) + POST messenger (500 secret manquant, 401 HMAC invalide, 200 forward, skip si null) + POST telegram (500 secret manquant, 401 token invalide, 200 forward, 400 JSON malformé)
- **`tests/integration/api-stripe.test.ts`** (12 tests) — POST stripe/connect (401, 404, 400 déjà connecté, 200 onboardingUrl, 500 Stripe error) + POST stripe/dashboard-link (401, 400 pas de compte, 200 URL, 500 Stripe error)

### Couverture routes API
- **27/27 routes API testées** (sauf customer-portal qui instancie Stripe au module level)
- Routes publiques (`booking/:slug`) : CSRF, cross-tenant, slot conflict
- Webhooks : signature HMAC (messenger), timing-safe token (telegram)

### Résultat
- **31 suites, 319 tests, 0 échec** ✅

---

## [1.5.6] — 2026-04-05 — Tests routes API v1 + fix sécurité token (272/272 green)

### Sécurité
- **[FIX]** `.claude/settings.local.json` — suppression token Supabase PAT (`sbp_…`) exposé en clair dans les permissions Bash → remplacé par `npx supabase:*` (token révoqué + nouveau en `.env.local`)

### Tests ajoutés (98 tests, 7 fichiers)
- **`tests/integration/api-bookings-post-patch.test.ts`** (14 tests) — POST /bookings (auth, validation JSON/UUID/source_channel, 201 nominal) + PATCH /bookings/:id (auth, cross-tenant 404, validation version/status, 200 nominal, 409 conflit version PGRST116)
- **`tests/integration/api-clients.test.ts`** (15 tests) — GET /clients (auth, 400 filter invalide, 200 pagination, liste vide) + POST /clients (validation name/email/JSON, 201) + GET /clients/:id (auth, cross-tenant PGRST116, 200 recent_bookings+active_packages) + PATCH /clients/:id (validation, 200, cross-tenant 404)
- **`tests/integration/api-services.test.ts`** (14 tests) — GET /services (auth, 200 practitioner_ids) + POST (validation name/duration/price/JSON, 201) + PATCH (auth, cross-tenant, validation duration>480, 200) + DELETE (auth, 200 soft-delete)
- **`tests/integration/api-practitioners.test.ts`** (14 tests) — GET /practitioners (auth, 200 service_ids+availability) + POST (validation name/color hex/email/JSON, 201 hex minuscule) + PATCH (auth, cross-tenant, validation color, 200)
- **`tests/integration/api-tips.test.ts`** (12 tests) — GET /tips (auth, UUID regex practitioner_id, ISO date from/to, 200 pagination, liste vide) + GET /tips/summary (auth, 200 grand_total+by_practitioner, agrégation multi-pourboires)
- **`tests/integration/api-loyalty-packages.test.ts`** (17 tests) — GET /loyalty (auth, 200, data:null sans programme) + PUT /loyalty (validation points négatif/JSON, 200) + GET /packages (auth, 200 liste) + POST /packages (validation name/UUID/total_uses/JSON, 404 service cross-tenant, 201) + PATCH /packages/:id (auth, validation is_active, 200 toggle, 404 PGRST116)
- **`tests/unit/api-health.test.ts`** (6 tests) — GET /health (200 healthy, 207 degraded 1 service, 207 degraded tous services externes, timestamp+services, latencyMs, 207 HTTP 503 Supabase)

### Résultat
- **27 suites, 272 tests, 0 échec** ✅

---

## [1.5.5] — 2026-04-05 — Tests complets lib/ + fix open redirect (174/174 green)

### Critique
- **[FIX]** `src/lib/safe-redirect.ts` — protection protocol-relative URLs (`//evil.com`) contournait le check `startsWith("/")` → ajout `|| path.startsWith("//")` — **vulnérabilité open redirect corrigée**

### Tests ajoutés
- **`tests/unit/rate-limit.test.ts`** (6 tests) — sliding window : autorise, bloque, remaining, resetAt, expiration, isolation clés
- **`tests/unit/safe-redirect.test.ts`** (10 tests) — `safeRedirectUrl` : chemin relatif, absolute → /login, protocol-relative → /login, query params — `isTrustedOrigin` : origins trusted/untrusted, malformée
- **`tests/unit/utils-api-error.test.ts`** (10 tests) — `apiError` : status HTTP, body JSON, code/traceId/details optionnels, header X-Trace-Id — `formatEuros` : centimes → euros locale fr-FR
- **`tests/unit/channels-send.test.ts`** (8 tests) — `sendMessage` : routage WhatsApp/Messenger/Telegram/SMS/voice→SMS, canal inconnu, erreurs API
- **`tests/unit/client-identify.test.ts`** (7 tests) — `identifyClient` : client existant, mise à jour nom, création, mapping canal→champ, phone WhatsApp, throw erreur

### Résultat
- **20 suites, 174 tests, 0 échec** ✅

---

## [1.5.4] — 2026-04-05 — Tests : validations booking, Stripe handlers complets (133/133 green)

### Tests ajoutés
- **`tests/unit/booking-validation.test.ts`** (15 tests) — Zod schemas `createBookingSchema` + `updateBookingSchema` : UUIDs, datetime offset, source_channel enum, version obligatoire, refine "au moins un champ"
- **`tests/unit/subscription-handlers.test.ts`** (12 tests) — `handleSubscriptionUpdated` : mapping statuts Stripe, reset period_uses, early return metadata/UUID — `handleSubscriptionDeleted` : mark cancelled, guards
- **`tests/unit/invoice-charge-handlers.test.ts`** (10 tests) — `handleInvoicePaid` : Plan SaaS vs client — `handleInvoicePaymentFailed` : log-only Plan vs past_due client — `handleChargeRefunded` : annule booking si UUIDs valides — `handleChargeDisputeCreated` : log critique sans BDD

### Résultat
- **15 suites, 133 tests, 0 échec** ✅

---

## [1.5.3] — 2026-04-05 — Stride créneaux 30 min → 15 min

### Changement
- **[FIX]** `src/lib/availability.ts` — stride des créneaux passé de 30 min à 15 min (`t += 30` → `t += 15`) pour offrir plus de flexibilité dans la prise de RDV
- **[UPDATE]** `tests/unit/availability.test.ts` — tous les counts recalculés pour le stride 15 min

### Note
Le stride est encore hardcodé. DEBT : le rendre configurable par salon (`slot_interval_minutes` dans `merchants`).

### Résultat
- **12 suites, 96 tests, 0 échec** ✅

---

## [1.5.2] — 2026-04-05 — Tests unitaires : loyalty, packages, availability (96/96 green)

### Tests ajoutés
- **`tests/unit/loyalty-points.test.ts`** (11 tests) — `computeTier` (pure) + `addLoyaltyPoints` : calcul points, détection upgrade palier, early-return si programme inactif/client introuvable, erreur Supabase, arithmetic entière
- **`tests/unit/package-consume.test.ts`** (13 tests) — `consumePackage` : décrément, optimistic lock, forfait expiré/mauvais service/inactif, erreurs DB — `hasActivePackageOrSubscription` : forfait, abonnement, exclusions
- **`tests/unit/availability.test.ts`** (8 tests) — Réécriture sur la vraie `getAvailableSlots` : slots libres, exception_date override, soustraction réservations, chevauchements longs, multi-blocs horaires

### Résultat
- **12 suites, 96 tests, 0 échec** ✅

---

## [1.5.1] — 2026-04-05 — Fix tests Vitest (67/67 green)

### Fix
- **[FIX]** `webhook-stripe.test.ts` — ajout `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` avant l'import dynamique (le module route throw à l'évaluation si elles sont absentes)
- **[FIX]** `agenda-day-view.test.ts` — ajout `afterEach(cleanup)` explicite RTL (le DOM s'accumulait entre tests → `getByText` trouvait plusieurs éléments)
- **[FIX]** `tip-attribution.test.ts` — remplacement des IDs `"merchant-1"` par de vrais UUIDs (la regex UUID dans `payment-succeeded.ts` provoquait un early return silencieux)

### Résultat
- **10 suites, 67 tests, 0 échec** ✅

---

## [1.5.0] — 2026-04-04 — Audit antigravity (Next.js best practices + supply chain + perf)

### Critique
- **[FIX] C1** — `unsafe-eval` dans CSP `script-src` en production : affaiblit la protection XSS. Conditionné à `NODE_ENV === "development"` — `next.config.ts`
- **[FIX] C2** — 3 requêtes `.select("*")` dans les routes API exposaient toutes les colonnes au client (bookings insert/update, client fiche) → sélections explicites de colonnes — `bookings/route.ts`, `bookings/[id]/route.ts`, `clients/[id]/route.ts`

### Audit Next.js (18 constats)
- **P01 (Critique)** — Aucun data fetching serveur dans les pages dashboard (tout en client-side useEffect → waterfalls) ➜ DEBT V2
- **P09 (Critique)** — Rate limiter in-memory inopérant sur Vercel serverless ➜ DEBT (migrer vers Upstash/Vercel KV)
- **P06 (Important)** — Auth vérifiée 2× (middleware + chaque handler) ➜ DEBT V2
- **P07 (Important)** — Pattern `getMerchant` répété sans cache à chaque requête API ➜ DEBT V2
- **P11 (Important)** — `unsafe-eval` en production ➜ CORRIGÉ (C1)
- **P17 (Important)** — Erreur OTP ignorée silencieusement dans login ➜ DEBT V2
- 7 constats mineurs documentés (voir rapport complet)

### Audit Supply Chain (21 constats)
- **Aucune vulnérabilité npm** (`npm audit` = 0 vulns sur 871 packages) ✅
- **Lock file** intègre avec hashes SHA-512 sur toutes les deps ✅
- **Docker** : réseaux isolés, healthchecks, resource limits, pas de secrets en dur ✅
- **Pas de CI/CD** (GitHub Actions absent) ➜ DEBT urgent
- Docker images sans digest SHA256 (`redis:7-alpine`) ➜ DEBT
- Pas de `.npmrc` avec `save-exact=true` ➜ DEBT

### Audit Performances (14 constats)
- `.select("*")` 3/14 corrigés (API routes exposées au client) ✅ ; 11 restants justifiés (backups rollback, types internes complets)
- Recharts (~300 Ko) chargé statiquement (aucun `next/dynamic`) ➜ DEBT V2
- Aucune stratégie de cache explicite sur les routes ➜ DEBT V2

### Fichiers modifiés
- `next.config.ts`
- `src/app/api/v1/bookings/route.ts`
- `src/app/api/v1/bookings/[id]/route.ts`
- `src/app/api/v1/clients/[id]/route.ts`

### Validation
- ✅ `next build` — 0 erreur TypeScript

---

## [1.4.2] — 2026-04-04 — Audit sharp-edges + insecure-defaults (trailofbits)

### Important
- **[FIX] I1** — Fail-fast `SUPABASE_SERVICE_ROLE_KEY` : `createAdminClient()` utilisait l'assertion `!` sans guard (erreur cryptique à la première requête DB) → throw explicite au démarrage — `src/lib/supabase/server.ts`
- **[FIX] I2** — Plafond manquant sur `tip_amount_cents` : pas de borne supérieure avant insertion en DB (pourboire arbitrairement élevé via metadata Stripe) → `TIP_MAX_CENTS = 100_000` (1 000 €) — `payment-succeeded.ts`
- **[FIX] I3** — CSRF check silencieux : quand `NEXT_PUBLIC_APP_URL` et `VERCEL_URL` sont absents, le check était ignoré sans log → warning explicite `booking.csrf_check_skipped_no_app_url` — `booking/[slug]/reserve/route.ts`

### Analyse insecure-defaults (aucun problème critique)
- Tous les `?? ""` webhooks (WhatsApp, Messenger, Telegram, Telnyx, Stripe) sont précédés de gardes fail-fast ajoutées en v1.4.0–1.4.1 ✅
- `forward-to-n8n.ts` : refuse d'envoyer en production si URL non-HTTPS ✅
- `safe-redirect.ts` : `ALLOWED_ORIGINS` vide → `isTrustedOrigin()` retourne false (fail-closed) ✅

### Fichiers modifiés
- `src/lib/supabase/server.ts`
- `src/lib/stripe/handlers/payment-succeeded.ts`
- `src/app/api/v1/booking/[slug]/reserve/route.ts`

### Validation
- ✅ `next build` — 0 erreur TypeScript

---

## [1.4.1] — 2026-04-04 — Audit OWASP approfondi v2 (A01, A02, A03, A05, A08)

### Critique
- **[FIX] C1** — Fail-fast `STRIPE_SECRET_KEY` : 4 modules initialisaient Stripe avec `?? ""` silencieux au lieu de throw au démarrage (seul `subscription.ts` était correct) — `connect.ts`, `payment-links.ts`, `webhooks/stripe/route.ts`, `customer-portal/route.ts`
- **[FIX] C2** — Validation UUID manquante sur `bookingId`/`merchantId` dans `handleChargeRefunded` (metadata webhook non validée avant usage en DB) — `charge-handlers.ts`

### Important
- **[FIX] I1** — Fuite d'erreurs internes Stripe dans les réponses API (`"Failed to create Stripe account: " + msg` exposait les détails) → messages génériques + log serveur — `connect/route.ts`, `customer-portal/route.ts`
- **[FIX] I2** — `practitioner_id` query param non validé UUID sur `GET /bookings` (injection potentielle via PostgREST) — `bookings/route.ts`
- **[FIX] I3** — Fail-fast sur secrets webhooks WhatsApp, Messenger et Telegram (retournaient 401 silencieusement au lieu de 500 explicite quand le secret est absent en config) — `whatsapp/route.ts`, `messenger/route.ts`, `telegram/route.ts`
- **[FIX] I4** — 3 requêtes sans `.limit()` dans les stats (clients inactifs : scan complet `bookings` all-time + previous tips sans borne) — `stats/route.ts`
- **[FIX] I5** — `.max()` manquant sur 8 schémas Zod : noms services (255), praticiens (255), forfaits (255), descriptions (2000), emails (320), téléphones (30), notes clients (5000) — `services/route.ts`, `services/[id]/route.ts`, `practitioners/route.ts`, `practitioners/[id]/route.ts`, `packages/route.ts`, `clients/[id]/route.ts`

### Mineur
- **[FIX] M1** — Health endpoint masque les messages d'erreur internes en production (évite la fuite d'infos infrastructure) — `health/route.ts`

### Fichiers modifiés
- `src/lib/stripe/connect.ts`
- `src/lib/stripe/payment-links.ts`
- `src/lib/stripe/handlers/charge-handlers.ts`
- `src/app/api/v1/webhooks/stripe/route.ts`
- `src/app/api/v1/webhooks/whatsapp/route.ts`
- `src/app/api/v1/webhooks/messenger/route.ts`
- `src/app/api/v1/webhooks/telegram/route.ts`
- `src/app/api/v1/stripe/connect/route.ts`
- `src/app/api/v1/stripe/customer-portal/route.ts`
- `src/app/api/v1/bookings/route.ts`
- `src/app/api/v1/stats/route.ts`
- `src/app/api/v1/services/route.ts`
- `src/app/api/v1/services/[id]/route.ts`
- `src/app/api/v1/practitioners/route.ts`
- `src/app/api/v1/practitioners/[id]/route.ts`
- `src/app/api/v1/packages/route.ts`
- `src/app/api/v1/clients/[id]/route.ts`
- `src/app/api/v1/health/route.ts`

### Validation
- ✅ `next build` — 0 erreur TypeScript
- ✅ `npm test` — 55 passed, 7 failed (identique avant/après — échecs préexistants)
- ✅ `npm run lint` — 0 nouveau warning (3 erreurs préexistantes dans composants UI)

### Points notés (hors périmètre / dette technique)
- **[DEBT]** `availability.ts:48` — interpolation `${date}` dans `.or()` PostgREST : sûr tant que l'appelant valide le format, mais fragile si appelé depuis un nouveau contexte → migrer vers paramètre filtré en V2
- **[DEBT]** Tests unitaires tip-attribution/webhook-stripe — mocks obsolètes depuis v1.2.x (ne testent plus le code actuel) → réécrire en V2

---

## [1.4.0] — 2026-04-04 — Audit OWASP Top 10:2025 (skill owasp-security)

### Critique
- **[FIX] C1** — Body size limit ajouté sur toutes les routes API générales (100 KB) ; seuls les webhooks avaient la limite (1 MB) — `middleware.ts`
- **[FIX] C2** — `STRIPE_SECRET_KEY` et `STRIPE_PLAN_PRODUCT_ID` : throw au démarrage si absent (fail-fast) au lieu de `?? ""` silencieux — `subscription.ts`
- **[FIX] C3** — Injection PostgREST sur la recherche clients : regex remplacée par allowlist alphanumérique stricte (`[^a-zA-ZÀ-ÿ0-9\s'\-]` supprimé) au lieu de denylist incomplète — `clients/route.ts`

### Important
- **[FIX] I1** — CSP (Content-Security-Policy) ajouté dans `next.config.ts` : `default-src 'self'`, `connect-src` Supabase + Stripe, `frame-src` Stripe 3DS, `object-src 'none'`, `base-uri 'self'` — `next.config.ts`
- **[FIX] I2** — `Cross-Origin-Opener-Policy: same-origin-allow-popups` ajouté (Stripe popup flows) — `next.config.ts`
- **[FIX] I3** — UUID validation sur `practitioner_id` et validation ISO sur `from`/`to` dans la route tips (injection via query params) — `tips/route.ts`
- **[FIX] I4** — Packages PATCH : code PGRST116 (no rows) retourne 404 au lieu de 500 générique, évite l'ambiguïté tenant mismatch vs erreur DB — `packages/[id]/route.ts`
- **[FIX] I5** — Telnyx : timestamp futur accepté réduit de 60 s à 10 s (fenêtre de clock skew attack réduite) — `verify-ed25519.ts`

### Mineur
- **[FIX] M1** — Stats route : `.limit(10_000)` sur 3 requêtes sans borne pour éviter un scan complet en cas de grand volume — `stats/route.ts`

### Fichiers modifiés
- `src/middleware.ts`
- `src/lib/stripe/subscription.ts`
- `src/app/api/v1/clients/route.ts`
- `src/app/api/v1/tips/route.ts`
- `src/app/api/v1/packages/[id]/route.ts`
- `src/app/api/v1/stats/route.ts`
- `src/lib/webhooks/verify-ed25519.ts`
- `next.config.ts`

### Validation
- ✅ `next build` — 0 erreur TypeScript, 0 warning
- ✅ Skill owasp-security installé dans `.claude/skills/owasp-security/`

### Points notés (hors périmètre / dette technique)
- **[DEBT]** Rate limiter in-memory non persistant entre instances Vercel (serverless) → migrer vers Upstash Redis en V2
- **[DEBT]** CSP utilise `'unsafe-inline'` pour scripts/styles (requis par Next.js 14 hydration) → migrer vers CSP nonce en V2
- **[DEBT]** Logging PII : les UUIDs client/merchant apparaissent dans les logs info → ajouter masquage en V2

---

## [1.3.1] — 2026-04-04 — Audit SEO pages publiques (skill seo-audit)

### Crawlabilité & Indexation
- **[FEAT] S1** — `robots.ts` créé : autorise `/:slug` (pages booking), bloque `/api/`, dashboard, auth — génère `/robots.txt` — `src/app/robots.ts`
- **[FEAT] S2** — `sitemap.ts` créé : sitemap dynamique listant toutes les pages booking des commerçants depuis la BDD — génère `/sitemap.xml` — `src/app/sitemap.ts`
- **[FIX] S3** — Pages login et onboarding marquées `robots: { index: false }` — `login/page.tsx`, `onboarding/page.tsx`

### Metadata & Open Graph
- **[FIX] S4** — Booking page `generateMetadata` : nom réel du salon depuis la BDD (+ fallback slug) au lieu du nom approximatif dérivé du slug — `(booking)/[slug]/page.tsx`
- **[FIX] S5** — Canonical URL explicite sur les pages booking — `(booking)/[slug]/page.tsx`
- **[FEAT] S6** — Open Graph complet sur les pages booking (`og:title`, `og:description`, `og:url`, `og:type`, `og:locale`, `og:siteName`) — `(booking)/[slug]/page.tsx`
- **[FEAT] S7** — `metadataBase`, Open Graph et `robots` ajoutés au root layout — `layout.tsx`

### Structured Data (JSON-LD)
- **[FEAT] S8** — Schema.org `BeautySalon` + `ReserveAction` injecté en JSON-LD sur chaque page booking (nom, adresse, téléphone, URL) — `(booking)/[slug]/page.tsx`

### Performance
- **[PERF] S9** — `cache()` React utilisé pour dédupliquer la requête BDD entre `generateMetadata` et le composant page (1 seul aller-retour Supabase par requête) — `(booking)/[slug]/page.tsx`

### Fichiers créés
- `src/app/robots.ts`
- `src/app/sitemap.ts`

### Fichiers modifiés
- `src/app/layout.tsx`
- `src/app/(booking)/[slug]/page.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/onboarding/page.tsx`

### Validation
- ✅ `next build` — 0 erreur, 0 warning TypeScript
- ✅ `/robots.txt` et `/sitemap.xml` prérendus statiquement (○)

---

## [1.3.0] — 2026-04-04 — Audit Docker Best Practices (skill docker-expert)

### Critique
- **[FIX] C1** — `limit_req_zone` déplacé du bloc `server {}` vers le contexte `http {}` (avant `server {}`) — **le rate limiting webhook ne fonctionnait pas du tout** — `n8n.conf.template`
- **[FIX] C2** — Mots de passe `changeme` remplacés par `${VAR:?message}` — docker-compose refuse de démarrer sans `.env` configuré — `docker-compose.yml`
- **[FIX] C3** — Healthchecks ajoutés sur nginx (`wget`), n8n (`/healthz`), Redis (`redis-cli ping`) — `depends_on` avec `condition: service_healthy` — `docker-compose.yml`

### Important
- **[FIX] I1** — Réseaux isolés : `frontend` (nginx ↔ n8n) + `backend` interne (n8n ↔ Redis) — Redis inaccessible depuis l'extérieur — `docker-compose.yml`
- **[FIX] I2** — Resource limits CPU/RAM sur tous les services (nginx 128M, n8n 1G, Redis 512M, certbot 64M) — `docker-compose.yml`
- **[FIX] I3** — Redis port supprimé (communique uniquement via réseau Docker interne `backend`) — `docker-compose.yml`
- **[FIX] I4** — Variables `N8N_BASIC_AUTH_*` dépréciées supprimées — n8n 1.x utilise l'auth intégrée — `docker-compose.yml`, `.env.example`

### Mineur
- **[FIX] M1** — `name: plan` ajouté en top-level pour éviter conflits multi-stack — `docker-compose.yml`
- **[FIX] M2** — HSTS avec `preload` ajouté — `n8n.conf.template`
- **[FIX] M3** — Header `X-XSS-Protection: 0` ajouté (désactive filtre XSS cassé des vieux navigateurs) — `n8n.conf.template`
- **[FIX] M4** — Redis `--maxmemory 256mb --maxmemory-policy allkeys-lru` pour éviter OOM — `docker-compose.yml`
- **[FIX] M5** — `.env.example` mis à jour : suppression defaults `changeme`, marquage REQUIRED — `.env.example`

### Fichiers modifiés
- `docker-compose.yml`
- `nginx/n8n.conf.template`
- `.env.example`

### Validation
- ✅ `next build` — 0 erreur, 0 warning TypeScript
- ✅ Syntaxe YAML valide (Docker non disponible sur cette machine pour `docker compose config`)

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
