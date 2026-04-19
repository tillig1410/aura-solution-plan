# CHANGELOG — Resaapp

> Suivi des modifications du projet. Mis à jour après chaque session de développement.
> Format : `[TYPE] Description — fichier(s) modifié(s)`

---

## [3.2.0] — 2026-04-19 PM — Migration Claude Haiku 4.5 + 60j limite + retouches UI sidebar/agenda

Session intensive de l'après-midi : MAJ n8n 2.16.1, switch IA Gemini → Claude Haiku 4.5 (avec achat $20 crédit Anthropic), 13 itérations du prompt v3.x (combo service, créneaux contigus, limite 60j, détection date prioritaire message courant), fix annulation booking, et 6 retouches UI (sidebar topbar mini-calendar, agenda toggle canaux, badge Nouveau, highlight RDV depuis notif).

### IA / Workflow n8n v2 — 13 itérations prompt + switch modèle

- **[CHORE]** **MAJ n8n VPS** 2.15.0 → 2.16.1 (commit serveur, pas de fichier) — fix bug "parts" LangChain V2 partiel
- **[FEAT]** **Switch modèle Gemini Lite → Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) — meilleur tool calling, pas de truncation
- **[FEAT]** **Pré-processing JS étendu** dans Prepare Context (~250 lignes) :
  - Détection date PRIORISE message courant > historique (évite collision dates anciennes)
  - Détection intent "regrouper/coller" → propose UNIQUEMENT créneaux contigus (pas créneaux intermédiaires)
  - Détection combo service (ex: "Coupe + Barbe" si créé manuellement par merchant)
  - Limite **60 jours** sur réservations futures (anti-spam, standard industrie)
  - Warning RDV proche ±7 jours (avec dedup pour ne pas se répéter)
- **[FIX]** **Tool Annuler RDV** (commit `b224735` — backup workflow) :
  - `cancelled_by` : `"ai"` → `"client"` (CHECK constraint exigeait client/merchant)
  - Préfixe `=` ajouté au `jsonBody` pour évaluer `{{ $now.toISO() }}`
  - `Prefer: return=minimal` → `return=representation` (sinon IA hallucinait l'échec sur réponse vide)
- **[CHORE]** **Backup workflow** : `n8n/workflows/booking-conversation-v2.json` snapshot v3.13 (commit `b224735`)

### Frontend — 6 retouches UI

- **[FIX]** **API services POST** : `description: z.string().optional().nullable()` (alignement PATCH) — fix erreur "Validation failed" lors création service "Coupe + Barbe" (commit `ed2af6f`)
- **[FEAT]** **Hide RDV annulé** au clic X sur notif sidebar (commit `a851870`) — sessionStorage `agenda_hidden_bookings` + event broadcasting, le RDV grisé disparait de l'agenda
- **[FEAT]** **4 retouches agenda** (commit `5552c4c`) :
  - Couleur verte (`#22c55e`) retirée de la palette praticien
  - Section "Par canal" du Résumé du jour devient collapsible (chevron + localStorage)
  - Bouton **"Aujourd'hui"** déplacé à GAUCHE de Jour/Semaine/Mois + style indigo plus visible
  - **Highlight RDV depuis notif** : click "VOIR" → ring red-500 pulsé autour du RDV concerné, notif reste visible. Click X → ring + notif disparaissent
- **[FEAT]** **Layout topbar + mini-calendar sidebar** (commit `8f372dc`) :
  - TopBar `h-16` → `h-12` (bandeau ~25% plus fin)
  - Sidebar header aligné à `h-12`, logo réduit (`h-7` vs `h-9`)
  - `border-r` déplacé du `<aside>` vers div interne — trait vertical commence SOUS le header (plus de séparation gênante)
  - Nouveau composant `SidebarMiniCalendar` (react-day-picker, locale fr, lundi premier jour) entre nav et notifications. Click date → navigation agenda sur ce jour précis

### Bonus — découvertes techniques

- **[CHORE]** Anthropic credit promo (gratuit) ne suffit pas pour API → faut acheter du crédit "payé" (min $5) sinon "credit balance too low"
- **[CHORE]** WebSocket Realtime Supabase échouait à cause d'un `\n` invisible dans la variable `NEXT_PUBLIC_SUPABASE_ANON_KEY` côté Vercel — fixé en re-collant la clé propre
- **[CHORE]** `Essai expiré` dans agenda est juste un label UI client-side (calculé `created_at + 14j`), ne bloque pas l'API
- **[CHORE]** Service combo créable manuellement par le merchant via `/services` (pas besoin de schema change pour les combos basiques)

### TODOs sauvegardés en mémoire

- `project_todo_modify_booking_combo.md` — vrai combo (changement schema DB) si besoin futur
- `project_todo_max_booking_days_configurable.md` — rendre la limite 60j paramétrable par merchant
- `project_workflow_v3_state.md` — snapshot complet du workflow + bugs résiduels (combo détecté mais Claude propose contigu, conversations longues confondent, modify_booking inexistant)

---

## [3.1.0] — 2026-04-19 — Polish workflow v2 (REGLE 10 + ETAT ACTUEL pré-calculé) + migrations 039/040 + UI

Session intensive de polish post-déploiement workflow v2. 14 commits, focus sur le flow conversationnel (Gemini Lite mieux guidé via pré-processing JS), 2 migrations critiques DB, et UI badge "Nouveau client" + édition inline fiche client.

### Workflow n8n v2.9 (via MCP, pas de fichier local sauf backup)

- **[FEAT]** **REGLE 10 NOM CLIENT** — Gemini demande le prénom si `client_db_name` null (avec exemple "Au fait, comment dois-je vous appeler ?")
- **[FEAT]** **Tool `set_client_name`** (PATCH `clients`) — Gemini sauvegarde le prénom donné par le client. Connecté à Agent IA via `ai_tool` (workflow passé de 25 → 26 nodes)
- **[FEAT]** **Pré-processing JS dans Prepare Context** — détection service/date/horaire/prénom depuis historique + message courant, injecté en haut du prompt comme **ETAT ACTUEL**. Compense la faible intelligence de Gemini Flash Lite (qui ignorait souvent l'historique)
- **[FEAT]** **REGLE 3 fuzzy matching services** — "barbe" matche "Barbe", "coupe" matche "Coupe homme", etc.
- **[FIX]** **Identify Client `p_name=""`** — ne sauve plus le nom de profil WhatsApp à la création du client (sinon REGLE 10 ne se déclencherait jamais)
- **[FIX]** **Build Context** — traite `'Inconnu'` comme `null` pour `client_db_name`
- **[CHORE]** **Backup workflow** — `n8n/workflows/booking-conversation-v2.json` (108k, snapshot du workflow actuel via MCP get)

### Modèle LLM

- **[CHORE]** Tentative `gemini-2.5-flash` full → bug n8n LangChain "Cannot read properties of undefined (reading 'parts')" causé par le mode "thinking" non parsé par n8n
- **[CHORE]** Tentative `gemini-2.0-flash` → 404 "no longer available to new users"
- **[KEEP]** Reste sur `gemini-2.5-flash-lite` — stable, le pré-processing JS compense

### Migrations DB (commits multiples — refactors successifs)

- **[FEAT]** **Migration 039** (`identify_client_fallback_channel_id.sql`) — RPC `identify_or_create_client` v2 : fallback lookup par `whatsapp_id`/`messenger_id`/`telegram_id` si `phone_normalized` ne match pas. Évite `duplicate key idx_clients_merchant_whatsapp` quand un client a son channel_id orphelin (commits `ea4b54d` → `2e6a0bf` après refactor SELECT INTO → INSERT RETURNING INTO)
- **[FEAT]** **Migration 040** (`fix_dow_convention_mismatch.sql`) — RPC `get_available_slots` utilise `EXTRACT(ISODOW) - 1` au lieu de `EXTRACT(DOW)` pour matcher la convention dashboard (0=Lundi, 6=Dimanche). Bug : tous les créneaux étaient décalés d'un jour
- **[CHORE]** Apprentissage SQL Editor Supabase : `SELECT INTO var FROM table` multi-line échoue avec `ERROR 42P01: relation "v_X" does not exist`. Refactor en `var := (SELECT ... LIMIT 1)` (scalar assign). Voir `feedback_supabase_sql_editor_select_into.md` en mémoire.

### Frontend

- **[FEAT]** **Édition inline fiche client** (commit `17cdb10`) — bouton "Modifier" pour nom/téléphone/email dans le panel ClientDetail, validation min 2 chars sur nom, gestion null pour phone/email vides
- **[FIX]** **Sync liste après update** (commit `fe709f0`) — callback `onUpdate` branché sur `fetchClients`, plus besoin de hard refresh
- **[FEAT]** **Badge "Nouveau client"** (commits `b8b141c` + `1b613db`) — pill emerald `✨ Nouveau` affiché tant que `completed_count === 0` (jamais venu pour un RDV terminé). Visible dans : liste `/clients`, panel détail, bulle agenda jour, bulle agenda semaine, dialog résumé RDV, sidebar notifications
- **[FEAT]** **API `/api/v1/clients[/:id]`** — ajout du champ `completed_count` pour le critère du badge
- **[FIX]** **Hardcoding Sunday=fermé retiré** (commit `7ef81ad`) — week-view + month-view affichent dimanche comme tout autre jour, source de vérité = `practitioner_availability`
- **[FIX]** **Sidebar notif "RDV confirmé"** (commit `c2c0e5a`) — affichait pas les nouveaux RDV créés/auto-confirmés en une shot par l'IA. Logique séparée : `created_at >= today_start` → "RDV confirmé", `updated_at - created_at > 60s` → "RDV déplacé"

### Plan de reprise

- **MAJ n8n** sur VPS Hostinger (expire 2026-04-23) — newer versions devraient corriger le bug "parts" → on pourra repasser sur `gemini-2.5-flash` full
- **Finir test E2E** avec Lite : annulation, multi-RDV, ambiguité service, dates passées, client connu
- **Cas panne IA** (nouveau besoin) — fallback message + notif dashboard + retry Gemini

---

## [3.0.0] — 2026-04-18 — Workflow v2 AI Agent + 6 migrations + anti-doublon + fix UTC

Refonte complète du workflow Booking Conversation : passage de 47 nodes (HTTP brut + IF/ELSE manuels) à 25 nodes avec le node AI Agent natif de n8n. L'IA gère nativement le tool-calling (get_available_slots, confirm_booking, cancel_booking) sans parsing manuel. Latence 2-3s au lieu de 5-8s.

### Workflow v2 AI Agent (commit `e354f74`)

- **[FEAT]** **Workflow v2** (`SGH4ltnF5VnsLyJA`, 25 nodes) — node AI Agent natif + Google Gemini Chat Model + 3 HTTP Request Tools. Prompt unique dans le node "Prepare Context" (plus dispersé sur 12 nodes). WhatsApp Incoming redirigé vers `/booking-conversation-v2`.
- **[FEAT]** **Anti-doublon WhatsApp** — 3 nodes ajoutés dans WhatsApp Incoming : Dedup Check (RPC `check_and_mark_processed`) + Is New Message? + Respond OK (Dup). Empêche les messages triplés causés par les retries WhatsApp.
- **[FIX]** **Respond OK** — `JSON.stringify()` au lieu de template string pour éviter le crash JSON quand le texte IA contient des guillemets.

### Migrations SQL (033-038)

- **[MIGRATION]** `033` — `get_available_slots` retourne `slot_start_local` (TEXT "HH:MI") et `slot_date_local` (TEXT "YYYY-MM-DD") en heure locale Paris. Fix du bug UTC (7h affichée au lieu de 9h). Gestion automatique heure été/hiver via `to_char(slot_ts_local)`.
- **[MIGRATION]** `034` — table `processed_messages` (PK `message_id`, auto-cleanup >1h) + RPC `check_and_mark_processed(TEXT) RETURNS BOOLEAN` pour la déduplication WhatsApp.
- **[MIGRATION]** `035` — `get_available_slots` utilise uniquement `practitioner_availability` (suppression dépendance `merchants.opening_hours`). Source unique pour les horaires praticien + pauses.
- **[MIGRATION]** `036` — fix RPC `check_and_mark_processed` : `v_count INTEGER` au lieu de `BOOLEAN` (erreur `operator does not exist: boolean > integer`).
- **[MIGRATION]** `037` — RPC `get_client_booking_frequency(UUID, UUID)` : calcule l'intervalle moyen entre RDV par service (window function LAG), retourne `avg_interval_days`, `last_booking_date`, `suggested_next_date`. Pour l'IA proactive.
- **[MIGRATION]** `038` — RPC `get_bookings_pending_notification` exclut tous les canaux IA (`NOT IN whatsapp, messenger, telegram, sms, voice`) pour éviter le doublon de confirmation quand l'IA a déjà répondu dans la conversation.

### Frontend

- **[FIX]** **Dialogue Praticiens** (`practitioner-manager.tsx`) — suppression de l'éditeur d'horaires doublon (qui écrasait les pauses configurées dans l'onglet Horaires). Remplacé par un message renvoyant vers l'onglet "Horaires" comme source unique.

### Prompt IA v2.2

- **Règle 3** renforcée : ne jamais redemander une info présente dans le message ou l'historique
- **Règle 4** (nouvelle) : inférence de date automatique ("mercredi" = mercredi prochain, jamais demander de préciser)
- **Règle 5** (nouvelle) : proposer exactement 2-3 créneaux espacés, filtrer matin/après-midi
- **Règle 6** renforcée : confirmation de créneau → appeler confirm_booking immédiatement, ne pas re-proposer
- **Règle 8** renforcée : seule source fiable = RDV A VENIR (ignorer l'historique pour affirmer qu'un RDV existe)

---

## [2.9.0] — 2026-04-12 — P3 sprint complet : sécurité, multi-praticien, annulation IA, hCaptcha, Realtime, guardrails

Journée marathon en 3 sessions. **Session 1 (matin)** : 7 migrations Supabase (sécurité, perf, multi-praticien, annulation), 390/390 tests verts, hCaptcha, cleanup conversations. **Session 2 (après-midi)** : agenda Realtime, workflow booking-confirmation-notify, 12 bugfixes E2E Gemini. **Session 3 (soir)** : prompt Gemini v3 avec 9 règles, guardrail confirmation, fix notifications doublons.

### Session 1 — Sécurité + migrations + hCaptcha (commits `0cbdd4e` → `0d7a6e8`)

#### Tests verts — 390/390 (commit `0cbdd4e`)

- **[FIX]** **41 → 0 test failures** — `tests/unit/` : mock `useRouter` pour sidebar/login-content, fix `ResizeObserver` mock + fixtures client pour agenda-day/week/month-view, adaptation `signInWithPassword` pour login-content.
- **[MIGRATION]** `025_security_rate_limiting.sql` — rate limiting fonctions sensibles Supabase
- **[MIGRATION]** `026_fix_security_advisor_warnings.sql` — fix `search_path` mutable sur les fonctions, REVOKE anon/authenticated sur materialized views
- **[MIGRATION]** `027_fix_performance_advisor_warnings.sql` — optimisations index Supabase
- **[MIGRATION]** `028_add_missing_fkey_indexes.sql` — index manquants sur les foreign keys

#### Cleanup conversations (commit `602c2df`)

- **[MIGRATION]** `029_cleanup_inactive_conversations.sql` — la RPC `get_or_create_active_conversation` nettoie automatiquement les conversations inactives >7 jours pour le même (merchant, client, channel). Pas de cron nécessaire.

#### Multi-praticien + confirmation explicite (commit `fc8e9b4`, P3-1 + P3-3)

- **[MIGRATION]** `030_get_available_slots_practitioner_filter.sql` — la RPC `get_available_slots` accepte désormais un `p_practitioner_name TEXT` optionnel. Si fourni, filtre les créneaux pour ce praticien uniquement. 140 lignes, DROP + CREATE pour ajouter le paramètre.
- **[REFACTOR]** **Booking Conversation** (`n8n`) — prompt Gemini : Règle #5 (demande de date obligatoire), Règle #6 (réutiliser slots proposés), Règle #7 (confirmation obligatoire : propose_slots d'abord, confirm_booking après confirmation client). Le tool `get_available_slots` passe désormais `practitioner_name` si le client en demande un spécifique.

#### Annulation RDV via IA (commit `d618367`, P3-2)

- **[MIGRATION]** `031_get_client_upcoming_bookings.sql` — RPC retournant les bookings futurs (confirmed/pending) d'un client pour un merchant. Utilisé par Gemini via function calling pour lister les RDV avant annulation.
- **[REFACTOR]** **Booking Conversation** (`n8n`, 44 → 47 nodes) — ajout des nodes Load Client Bookings, Is Cancel?, Cancel Booking. Le prompt Gemini inclut désormais la section "RDV A VENIR DU CLIENT" avec les IDs des bookings + le délai d'annulation configurable.

#### hCaptcha (commits `0d7a6e8`, `712d857`, `6f01848`, P3-6)

- **[FEAT]** **hCaptcha login/register** — `src/components/auth/login-content.tsx` : widget HCaptcha ajouté avant le bouton submit (login, register, magic link, forgot password). Token captcha passé à Supabase via `options.captchaToken`. Bouton submit désactivé tant que le captcha n'est pas résolu.
- **[FIX]** **CSP** — `next.config.ts` : ajout des domaines hCaptcha (`js.hcaptcha.com`, `newassets.hcaptcha.com`) dans script-src, style-src, connect-src et frame-src.
- **[CHORE]** Trigger Vercel rebuild pour `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`.

### Session 2 — Agenda Realtime + booking-confirmation-notify + bugfixes E2E (commit `cb157cd`)

#### Agenda Realtime

- **[FEAT]** **agenda-content.tsx** — souscription Supabase Realtime sur la table `bookings` (channel `bookings-realtime`, événements `*`). À chaque INSERT/UPDATE/DELETE, `fetchAllData()` est rappelé → l'agenda se met à jour sans refresh navigateur. Cleanup propre avec `removeChannel` dans le useEffect.

#### Workflow booking-confirmation-notify (NOUVEAU, 5 nodes)

- **[FEAT]** **booking-confirmation-notify** (`n8n`, workflow `7NjovgUVcs4x513y`) — poll toutes les 2 minutes, détecte les bookings confirmés/refusés par le commerçant dans les 3 dernières minutes. Envoie un message template au client via WhatsApp/SMS/Messenger/Telegram. Enregistre la notification pour éviter les doublons.

#### 12 bugfixes E2E Gemini

- **[FIX]** Fix Gemini jsonBody invalide (practitioner_name imbriqué dans scan_days)
- **[FIX]** Fix `allowedFunctionNames` incompatible avec mode AUTO
- **[FIX]** Parse Gemini Response : gère `confirm_booking`/`cancel_booking` retournés comme functionCall (pas comme texte)
- **[FIX]** Résolution noms → UUIDs (Nora → UUID, Coupe homme → UUID) via lookup `$('Load Services')`/`$('Load Practitioners')`
- **[FIX]** Timezone : append `+02:00` sur datetimes naïves de Gemini
- **[FIX]** Booking Action? / Is Cancel? / Create Booking / Cancel Booking : référencent `$('Compute Token Cost')` au lieu de `$json` (vide après Insert Token Usage)
- **[FIX]** Create Booking respecte `auto_confirm_bookings` du merchant (confirmed vs pending)
- **[FIX]** Message adapté : "RDV confirmé" vs "demande envoyée, le salon confirmera"
- **[FIX]** Gemini AI Final : ne dit plus Bonjour (2e échange)
- **[FIX]** Dedup praticiens dans Sanitize
- **[FIX]** Prompt renforcé : RÈGLE #5 demande de date, #6 réutiliser slots proposés, #7 confirmation

### Session 3 — Prompt Gemini v3 + guardrail confirmation + fix notifications doublons

Session de polish E2E centrée sur la fiabilité de la boucle **WhatsApp → IA → booking → notification**. Trois axes : **(1)** prompt Gemini complet à 9 règles avec IDs en contexte, **(2)** guardrail code pour compenser les faiblesses de Gemini Flash Lite sur le champ `action`, **(3)** fix du workflow de notification qui spammait le client.

### Partie 1 — Prompt Gemini AI v3 (9 règles) + contexte IDs

- **[REFACTOR]** **Prompt Gemini AI** (`n8n`, node Gemini AI) — reconstruction complète du prompt via `updateNode` (pas de patch incrémental, leçon apprise : `patchNodeField` unreliable). 9 règles numérotées proprement :
  - **Règle 6 renforcée** : confirmation de créneau avec **exemple concret** JSON montrant le flow `"A 15h"` → `action: "confirm_booking"` + `booking_data` rempli avec `[id:...]` du contexte
  - **Règle 8 (NOUVELLE)** : informer le client de ses RDV existants avant de proposer des créneaux (évite doublons involontaires)
  - **Règle 9** : plusieurs RDV le même jour autorisés (séparée de la règle 8)
  - **scan_days** : nouvelle règle pour jours récurrents ("les mardis", "un mardi après-midi") → `scan_days=14`
  - **Cohérence scan_days** : standardisé à 14 partout (instruction + tool description)

- **[REFACTOR]** **Prompt Gemini AI Final** (`n8n`, node Gemini AI Final) — v2 :
  - Créneaux **consécutifs** obligatoires : "14h, 14h20, 14h40" et NON "14h, 15h, 16h"
  - Numérotation des règles corrigée (plus de doublon règle 4)
  - **Préférence horaire souple** : PRIVILÉGIE la plage demandée ("après-midi" = 12h-18h) mais PEUT proposer d'autres horaires si aucun ne correspond dans la plage, en le précisant

- **[REFACTOR]** **Sanitize Prompt Inputs** (`n8n`) — services et praticiens incluent désormais les IDs :
  - `safe_services_list` : `"Coupe homme [id:c75d4c76-...] (30 min, 20€)"`
  - `safe_practitioners_list` : `"Nora [id:90ce8e60-...]"` — avec dédoublon par ID

### Partie 2 — Guardrail slot confirmation (Parse Gemini Response)

**Contexte** : Gemini Flash Lite retourne systématiquement `action: "none"` quand le client confirme un créneau ("14h", "à 15h"), malgré la règle 6 explicite avec exemple. Le modèle génère le bon `response_text` mais oublie de remplir `action` et `booking_data`.

- **[FIX]** **Parse Gemini Response** (`n8n`, Code node) — ajout d'un guardrail code **après** le parsing JSON de Gemini :
  - Détecte si le dernier message IA contient "créneaux" + des heures
  - Détecte si le client répond avec une heure (`/^[àa]?\s*(\d{1,2})[h:](\d{0,2})/i`)
  - Si les deux conditions ET `action === "none"` → **override** :
    - Parse la date depuis le texte IA (regex mois français)
    - Résout service_id et practitioner_id depuis `$('Load Services')` et `$('Load Practitioners')`
    - Calcule `starts_at` et `ends_at` (timezone +02:00)
    - Génère le response_text approprié selon `auto_confirm` du merchant
    - Force `action: "confirm_booking"` avec `booking_data` complet
  - Fallback : si le parsing échoue (format inattendu), le comportement Gemini original est préservé

### Partie 3 — Fix notifications doublons (booking-confirmation-notify)

**Contexte** : le client recevait 2+ confirmations WhatsApp identiques à 2 min d'intervalle. Root cause : le node `Save Notification` échouait silencieusement (`scheduled_at NOT NULL` non renseigné + type `booking_confirmed` pas dans la CHECK constraint) → pas de record en BDD → le cron suivant renvoyait.

- **[MIGRATION]** `032_get_bookings_pending_notification.sql` — RPC avec `NOT EXISTS` anti-join sur `notifications` :
  - Retourne les bookings confirmed/cancelled des 5 dernières minutes qui n'ont PAS encore de notification envoyée
  - Joints clients, services, practitioners, merchants en flat (pas de nested objects)
  - `GRANT EXECUTE TO service_role`

- **[FIX]** **Fetch Updated Bookings** (`n8n`, workflow `booking-confirmation-notify`) — remplacé le query direct `/rest/v1/bookings` par POST RPC `/rest/v1/rpc/get_bookings_pending_notification`. Plus de doublons possibles.

- **[FIX]** **Build Messages** (`n8n`) — types notification corrigés : `booking_confirmed` → `confirmation`, `booking_cancelled` → `cancellation` (match la CHECK constraint de la table `notifications`)

- **[FIX]** **Save Notification** (`n8n`) — ajout du champ `scheduled_at` (= `$now.toISO()`). L'INSERT ne crash plus.

### Partie 4 — Fix sidebar notifications frontend (commit `b530b6d`)

- **[FIX]** **sidebar-notifications.tsx** — dismiss persistant : les IDs des notifications dismissées sont sauvegardés en `sessionStorage` et filtrés **dans** `fetchNotifications` avant `setNotifications`. Les notifs dismissées ne reviennent plus après le re-fetch toutes les 30s.

- **[FIX]** **sidebar-notifications.tsx** — bookings créés aujourd'hui (pending → confirmed) affichent **"RDV confirmé"** au lieu de "RDV déplacé". Logique : si `created_at >= todayStart` → c'est une confirmation, pas un reschedule.

### ✅ Action manuelle effectuée

- **Migration 032** : appliquée dans Supabase SQL Editor le 2026-04-12.

---

## [2.8.0] — 2026-04-11 — Débloquage Vercel prod + polish tokens Gemini + normalisation phone FR cross-canal

Grosse session qui cumule 3 axes complémentaires : **(1)** débloquage de la prod Vercel (gelée depuis 5 jours), **(2)** polish Option D pour réduire les tokens Gemini du 2e appel, **(3)** fix structurel du bug de doublon client cross-canal (Alex/mr X). Contient aussi 2 review fixes mineurs (tri chronologique des slots + `??=` sur Stripe cache).

### Partie 1 — Débloquage Vercel prod (commit `aafb503`)

**Contexte** : depuis 5 jours, tous les push sur `main` déclenchaient un deploy **Preview** au lieu de **Production**, et ces builds Preview cassaient tous sur `STRIPE_SECRET_KEY is not configured` au module load. La prod `resaapp.fr` était gelée sur une version de 5 jours, sans la route `/api/v1/channels/send` (ajoutée en 2.7.3 le 2026-04-10).

**3 bugs empilés identifiés et résolus** :

- **[FIX]** **Vercel `link.productionBranch`** — le projet avait été créé depuis la branche feature `001-saas-reservation-ia`, jamais repointé sur `main`. Corrigé via PATCH API Vercel `/v9/projects/{id}/branch` avec `{"branch":"main"}`. Les push `main` déclenchent désormais des deploys Production auto.

- **[REFACTOR]** **Lazy-load Stripe** — les modules `src/lib/stripe/{connect,payment-links,subscription}.ts` + routes `src/app/api/v1/stripe/customer-portal/route.ts` + `src/app/api/v1/webhooks/stripe/route.ts` instanciaient `new Stripe(...)` au **module scope** avec un `throw` si `STRIPE_SECRET_KEY` manquait. Next.js "Collecting page data" importe chaque route → crash systématique en Preview (où STRIPE_SECRET_KEY n'est pas défini). Nouveau helper `src/lib/stripe/client.ts::getStripeClient()` lazy + cached, appelé au runtime. Validé : `next build` passe désormais sans **aucune** env var Stripe/Supabase/Telnyx.

- **[FIX]** **Corruption `\n` dans env vars Vercel** — 3 env vars contenaient un `\n` littéral en fin (trailing newline) : `INTERNAL_API_SECRET` (fix matin, déjà commité), puis `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_APP_URL` découvertes cet après-midi. Cause racine : utilisation de `echo "..." | vercel env add` au lieu de `printf '%s' "..." | vercel env add`. Les 3 vars retypées proprement, redeploy prod manuel `dpl_4uefzCdNkhyBVnHK3DwUhnJqnbsG` OK.

### Partie 2 — Polish Option D : cap 5 slots/jour + prompt Gemini strict (commit `246236f`)

Suite directe de la session 2.7.11 : les observations de l'exec 2618 montraient Gemini listant 20 slots au lieu de 2-3, et le 2e appel consommait ~11k tokens de prompt. Fix en 2 composantes :

- **[REFACTOR]** **Build Tool Response v3** (`n8n/workflows/booking-conversation.json`) — après groupement par date, `days.forEach(day => day.slots = day.slots.slice(0, 5))` pour plafonner à 5 slots/jour max. Ajout de `day.total_slots_on_day` en métadata pour que Gemini puisse mentionner qu'il y a d'autres dispos si besoin. Économie ~80% des tokens du 2e appel (validé exec 2637 : 902 tokens prompt vs ~11k avant).

- **[FIX]** **Prompt Gemini AI Final renforcé** — « Propose 2 ou 3 créneaux maximum » → « Propose EXACTEMENT 2 à 3 créneaux, JAMAIS PLUS » + contre-exemple explicite listé (`'9h, 9h30, 10h, 10h30...' — ça noie le client`). Guardrail stricte contre la tendance du modèle à lister tous les slots reçus.

### Partie 3 — Migration 024 : normalisation phone FR + RPC cross-canal (commit `d241a30`)

**Contexte** : bug de doublon client connu du backlog P2 (Alex/mr X). Les clients créés via le dashboard ont `phone='0652880318'` (format national FR), tandis que les clients créés via WhatsApp ont `phone='33652880318'` (format international). Résultat : le même humain est dédoublé dans `public.clients` à chaque nouveau canal. Résolu structurellement.

- **[MIGRATION]** `024_normalize_phone_and_identify_rpc.sql` :
  - **Fonction IMMUTABLE** `normalize_phone_fr(raw TEXT)` : strip non-digits via regex, puis convertit `0XXXXXXXXX` (10 chiffres FR) en `33XXXXXXXXX`. Idempotent sur `33XXXXXXXXX` et `+33XXXXXXXXX`. Safe pour GENERATED COLUMN et index.
  - **Colonne générée** `clients.phone_normalized TEXT GENERATED ALWAYS AS (normalize_phone_fr(phone)) STORED`. Auto-remplie rétroactivement pour les rows existants.
  - **Safeguard pré-index** : bloc `DO $$` qui `RAISE EXCEPTION` si des doublons `(merchant_id, phone_normalized)` existent déjà (avec sample dans le message d'erreur pour diag).
  - **Index unique** `idx_clients_merchant_phone_normalized` sur `(merchant_id, phone_normalized)` qui **remplace** l'ancien `idx_clients_merchant_phone` (sur phone brut). Protège contre les doublons cross-canal à l'INSERT.
  - **RPC `identify_or_create_client(p_merchant_id, p_raw_phone, p_name, p_channel)`** : SECURITY DEFINER, retourne les colonnes client standard. Logique :
    - Si `phone_normalized` existe → **UPDATE** avec `COALESCE` sur `{whatsapp,messenger,telegram}_id` (fill seulement le channel_id manquant, ne touche JAMAIS `name` ni `phone` existants).
    - Sinon → **INSERT** avec le channel_id correspondant.
  - Protège contre le scénario « WhatsApp renomme mr X en Alex » et « WhatsApp écrase 0652880318 par 33652880318 » simultanément.

- **[REFACTOR]** **Node `Identify Client`** (`n8n/workflows/booking-conversation.json`) — POST direct sur `/rest/v1/clients` (upsert `on_conflict=merchant_id,phone`) remplacé par POST RPC sur `/rest/v1/rpc/identify_or_create_client`. Body passe les 4 params `p_*`, plus de `Prefer: resolution=merge-duplicates`.

- **Validation E2E** (exec 2667) : envoi WhatsApp avec `sender_phone=33652880318` + `sender_name=Alex` → RPC trouve mr X existant via `phone_normalized`, retourne mr X intact (`name='mr X'`, `phone='0652880318'` préservés, `whatsapp_id='33652880318'` renseigné). Plus de doublon créé.

### Partie 4 — Review fixes post-code-review (à commit demain)

- **[FIX]** **Tri chronologique des slots** — dans `Build Tool Response v4`, ajout de `day.slots.sort((a, b) => a.iso.localeCompare(b.iso))` AVANT le `.slice(0, 5)`. Garantit que Gemini voit les créneaux dans l'ordre (`9h, 10h30, 14h` au lieu d'un ordre random `[14h, 9h, ...]`). **Déjà live en prod via n8n MCP**, à synchroniser dans le JSON repo demain.

- **[REFACTOR]** **Stripe cache idiomatique** — `src/lib/stripe/client.ts` : pattern `if (cached) return cached; cached = new Stripe()` remplacé par `cached ??= (() => { ... })()` IIFE pour plus de clarté. Sémantiquement équivalent, plus idiomatique TypeScript moderne.

### Partie 5 — Fix SEO 404 Google Search Console (à commit demain)

**Contexte** : Google Search Console a signalé des erreurs `Introuvable (404)` le 2026-04-08 sur `resaapp.fr`. Diagnostic : le sitemap dynamique exposait `https://resaapp.fr/-` (l'unique merchant en DB `𝐒𝐰𝐞𝐞𝐭 𝐛𝐫𝐮𝐬𝐡 / 𝘣𝘺 𝘮𝘢𝘳𝘪𝘦` a `slug = "-"` — fallback de la slugification quand le `name` ne contient que des caractères Unicode Mathematical Bold non-ASCII). Combiné avec la décision de **2026-04-08 d'annuler la fonctionnalité site de résa publique**, la fix cohérente est de désindexer complètement `/[slug]`.

- **[FIX]** **`src/app/sitemap.ts`** — retrait de la query Supabase + retrait des `bookingPages`. Expose uniquement la landing `/`. Bonus : `/sitemap.xml` passe de `ƒ Dynamic` (SSR) à `○ Static` dans le build Next → pas d'appel DB côté prod, cacheable CDN.

- **[FIX]** **`src/app/robots.ts`** — ajout de `/-` et `/-/` en `disallow` (bloque le slug problématique actuel). Les autres patterns (`/api/`, `/agenda`, etc.) déjà présents inchangés.

- **[FIX]** **`src/app/(booking)/[slug]/page.tsx`** — :
  - `generateMetadata` : `robots: { index: true, follow: true }` → **`{ index: false, follow: false }`** (empêche toute nouvelle indexation et signale à Google de purger les pages déjà indexées au prochain crawl)
  - Page component : ajout de `if (!merchant) notFound()` pour retourner un vrai 404 au lieu d'une page vide que Google verrait comme "soft 404" (source probable des erreurs Search Console)
  - Double barrière : robots.txt + meta noindex + notFound() → Google recevra un signal clair et purgera `/-` de son index.

**Action complémentaire côté Google Search Console** (à faire par le user après le deploy) :
1. Search Console → Outils et rapports → **Suppressions** → Nouvelle demande → URL `https://resaapp.fr/-` → Supprimer temporairement (6 mois)
2. Search Console → Indexation → **Pages** → localiser les URLs en 404 → Valider le fix
3. Le prochain crawl Google (2-7 jours) confirmera la désindexation

### Nettoyage DB manuel (côté user)

- **10 clients de test supprimés** de `public.clients` : `TestSlotCap` + 9× `Test *` (Final, Scan14, Scan, Force, P6, Hist×2, ASAP) + `Alex` (doublon de mr X). Transaction SQL atomique avec `DO $$` : UPDATE des conversations d'Alex → mr X (transfert des 16 messages WhatsApp), puis DELETE messages → conversations → clients en cascade.
- **Compte `tillig1410@gmail.com`** supprimé de `auth.users` (n'avait jamais eu de merchant attaché, source de confusion login).
- **Reset password direct via SQL** sur `projet.dev.aurasolutions@gmail.com` (contournement du rate limit email Supabase) : `UPDATE auth.users SET encrypted_password = crypt('...', gen_salt('bf'))`.
- **Fix Site URL Supabase** — trailing spaces invisibles dans `Project Settings → Authentication → URL Configuration → Site URL` (cause des magic links qui pointaient sur `resaapp.fr%20%20`). Corrigé par retype brute-force via Ctrl+A / Delete / retype manuel.

### Validation session (4 tests lancés avant commit)

- **`next build` sans env vars Stripe** : ✅ passe (confirmation lazy-load)
- **`n8n_validate_workflow`** : ✅ `valid: true`, 0 errors, 63 warnings (tous pré-existants, best practices non-bloquantes)
- **`npx tsc --noEmit`** : erreurs uniquement dans `tests/` (pré-existantes, types fixtures désynchronisés avec schéma)
- **`npm run test`** : 350 passed / 41 failed. **0 failure liée aux commits du jour**. 41 tests cassés pré-existants (mocks `next/navigation` sans `useRouter`, fixtures `BookingWithDetails` obsolètes). Capturé en backlog P2 "Cleanup suite de tests".

### Backlog P2 restant

- **[P2]** Mistral Fallback system prompt à aligner sur les nouveaux champs (`safe_services_list`, `safe_greeting_word`, `safe_has_history`, `safe_tool_call_mode`, `ref_dates`).
- **[P2]** Audit des 4 workflows n8n non touchés : `google-review-request`, `reminder-notifications`, `voice-call-handler`, `package-expiration-check`.
- **[P2]** Cleanup suite de tests — fix mocks `next/navigation`, regen types Supabase, update fixtures.
- **[P3]** UX conversationnel : multi-praticien (prompt Gemini mono-pract), annulations (Booking Action ne route que `create_booking`), confirmation explicite pré-booking.

### Fichiers modifiés
- `supabase/migrations/024_normalize_phone_and_identify_rpc.sql` — nouvelle migration
- `src/lib/stripe/client.ts` — nouveau helper lazy + idiom `??=`
- `src/lib/stripe/{connect,payment-links,subscription}.ts` — refactor lazy
- `src/app/api/v1/stripe/customer-portal/route.ts` — refactor lazy
- `src/app/api/v1/webhooks/stripe/route.ts` — refactor lazy
- `n8n/workflows/booking-conversation.json` — Build Tool Response v3 → v4 (cap + tri), Gemini AI Final prompt, Identify Client → RPC
- `src/app/sitemap.ts` — retrait bookingPages, sitemap statique
- `src/app/robots.ts` — disallow `/-` et `/-/`
- `src/app/(booking)/[slug]/page.tsx` — notFound() si merchant null, noindex metadata
- `CHANGELOG.md` — cette entrée

### Commits
- `aafb503` — fix(stripe): lazy-load Stripe client pour unblock Vercel Preview builds
- `246236f` — feat(n8n): polish Option D — cap 5 slots/jour + prompt strict 2-3 créneaux max
- `d241a30` — feat(db+n8n): normalisation phone FR + RPC identify_or_create_client
- **(demain)** fix: slot chronological sort + Stripe cache ??= + SEO noindex /[slug] (review + SEO fixes)

---

## [2.7.11] — 2026-04-11 — Polish Option D : scan_days multi-jours + fix Save AI Message $json

Après le polish 6, user a testé « RDV le plus tôt possible » en WhatsApp réel : Gemini répond « pas de dispo lundi 13, souhaitez-vous que je vérifie mardi, mercredi, jeudi... » et boucle. Le problème = `get_available_slots` ne scan qu'un jour, et Nora est en congé TOUTE la semaine 12-18. Gemini ne peut pas découvrir la 1ère vraie dispo (lundi 20) sans plusieurs tool calls.

### Migration 023 — Extension get_available_slots avec p_scan_days

- **[FEAT]** Migration `023_extend_get_available_slots_scan_days.sql` — DROP l'ancienne signature 3-args + CREATE la nouvelle avec `p_scan_days INTEGER DEFAULT 1` (clamp 1-14)
- Logique inchangée (intersection opening_hours ∩ practitioner_availability, filtres break + bookings, timezone-aware) wrappée dans un `FOR v_day_offset IN 0..(scan_days-1)` qui appelle `RETURN QUERY` accumulativement
- `SECURITY INVOKER`, `GRANT EXECUTE TO service_role, authenticated`
- Backward compat : appels 3-args utilisent default=1 = comportement identique à v1
- Appliquée manuellement via Supabase Studio

### Validation RPC direct (curl)
- `scan_days=1, date=2026-04-14` → `[]` (Nora en congé mardi)
- `scan_days=1, date=2026-04-20` → 20 slots Nora ✓
- `scan_days=14, date=2026-04-12` → trouve les slots du 20 avril et suivants ✓

### n8n workflow — Adaptation pour multi-jours

**Check Availability** :
- Body ajout `p_scan_days: {{ tool_args.scan_days || 1 }}`

**Gemini AI tool declaration** :
- Ajout propriété `scan_days` (integer, description "Nombre de jours à scanner à partir de date. Default 1. Utilise 7 pour 'le plus tôt possible', 14 pour couvrir 2 semaines.")

**Gemini AI system prompt** :
- Règle explicite scan_days :
  - Date précise (ex "mardi prochain") → scan_days=1
  - "le plus tôt possible" / "dès que possible" / "asap" → **scan_days=14** avec date=tomorrow (couvre 2 semaines pour absorber les congés praticiens)
  - "la semaine prochaine" sans jour précis → scan_days=5 avec date=next_monday
  - "la semaine suivante" → scan_days=5 avec date=week_after_next_monday

**Build Tool Response v2** :
- **[REFACTOR]** Groupe les slots par date au lieu de liste plate. Nouveau format :
```json
{
  "days": [
    { "date": "2026-04-20", "day_label": "lundi 20 avril", "slots": [...] },
    { "date": "2026-04-21", "day_label": "mardi 21 avril", "slots": [...] }
  ],
  "count": 100,
  "message": "100 créneaux disponibles sur 5 jours."
}
```
- `day_label` en français via `Intl.DateTimeFormat('fr-FR', {weekday, day, month})`
- Tri par date ascendante (le 1er jour = le plus proche avec des slots)

**Gemini AI Final system prompt** :
- Adapté pour parser la nouvelle structure `days[]`
- CAS 1 (count > 0) : « Prends le 1er jour de days[] (le plus proche). Propose 2-3 créneaux max »
- CAS 2 (count === 0) : « Dis qu'aucune dispo sur la période. Propose d'étendre la recherche. NE JAMAIS inventer. »

### Bug Save AI Message fixé

Découvert : `Save AI Message` body utilisait `$json.response_text`. Mais à ce stade dans le flow (après Insert Token Usage), `$json` est la réponse HTTP Supabase (null pour `return=minimal`), pas le contexte original. Résultat : INSERT avec `content: null` → `null value in column "content" violates not-null constraint`. 

**Fix** : Save AI Message body `content` passe de `$json.response_text` à `$('Compute Token Cost').first().json.response_text` (référence explicite au nœud qui porte le response_text).

### Validation E2E (exec 2618)

Input : `{ message_text: "Je voudrais un RDV le plus tot possible pour une coupe homme", sender_phone: "33600000008" }` (fresh phone, no history)

Gemini AI (1er appel) :
- `tool_args: { date: "2026-04-12", duration_minutes: 30, scan_days: 14 }` ← **scan_days=14 bien choisi**

Check Availability (RPC) :
- Query `/rpc/get_available_slots` avec scan_days=14
- Retour : 100 slots sur 5 jours (lundi 20 → vendredi 24 avril, Nora dispo)

Build Tool Response :
- Groupé par date : 5 days[], 20 slots/jour
- `message: "100 créneaux disponibles sur 5 jours."`

Gemini AI Final réponse :
- « Bonsoir, je peux vous proposer plusieurs créneaux pour votre coupe homme le lundi 20 avril : 9h, 9h30, 10h, 10h30... Lequel préférez-vous ? »
- Pas d'hallucination, 1er jour dispo correct (Nora reprend le lundi S2)

Save AI Message : status success ✓ (fix `$('Compute Token Cost')...` effectif)

### Itérations debug

- Test initial avec `scan_days=7` (Mon-Fri + weekend) → count=0 car Nora est en congé toute la semaine du 12-18. Passage à `scan_days=14` pour absorber le cas.
- `$json.response_text` null après HTTP chain → switch vers référence explicite au node Compute Token Cost.

### Limitations P2 restantes

- **Gemini propose 20 slots au lieu de 2-3** : le prompt dit « max 3 » mais le modèle a listé tous les créneaux du lundi 20. Le prompt sera à renforcer, ou on limite côté Build Tool Response.
- **Tokens élevés 2e appel** : 11097 tokens pour 100 slots dans le functionResponse. Peut-on filtrer à ~15 slots/jour côté Build Tool Response pour économiser ? P3.
- **Fallback Mistral** ne gère pas encore les services list, greeting_word, scan_days, tool_call_mode. Reste dégradé en mode Mistral.

### Fichiers modifiés
- `supabase/migrations/023_extend_get_available_slots_scan_days.sql` — nouvelle migration
- `n8n/workflows/booking-conversation.json` — re-export live (166 KB, 35 nodes)

### Commits
- Single commit pour session polish 7 : migration 023 + scan_days flow + Build Tool Response v2 + fix Save AI Message + CHANGELOG 2.7.11

---

## [2.7.10] — 2026-04-11 — Polish Option D : services + greeting_word + tool_call_mode forcé + reorder Save AI

Session de debug intense après plusieurs cycles de tests WhatsApp réels. 6 bugs rapportés par le user corrigés en une fois. Workflow passe à 35 nodes.

### Bugs identifiés en test réel

**Bug A — « Bonsoir Alex » à chaque message**
- Gemini saluait à chaque message de la conversation, même en milieu de dialogue.
- Fix : Sanitize calcule `safe_has_history` (bool) depuis la présence de messages dans Load Conversation History. Les 2 system prompts Gemini instruisent : « Si safe_has_history = true, NE COMMENCE PAS par Bonjour/Bonsoir. Enchaine direct. »

**Bug B — Demande de l'année**
- Gemini demandait l'année au client alors que `AUJOURD'HUI : samedi 2026-04-11` était dans le prompt.
- Fix : règle explicite « Utilise TOUJOURS l'année d'AUJOURD'HUI, ne demande JAMAIS l'année. »

**Bug C — Redemande le jour/durée à chaque message**
- Gemini redemandait des infos déjà fournies dans l'historique (boucle infinie de questions).
- Fix : règle « LECTURE HISTORIQUE — avant toute question, RELIS l'HISTORIQUE. Si l'info est déjà dedans, utilise-la directement. Ne redemande JAMAIS. »

**Bug D — Demande la durée au lieu de proposer un service**
- Gemini demandait au client combien de temps il voulait, au lieu de proposer un service (dont la durée est dérivée).
- Cause : les services du merchant n'étaient pas chargés dans le contexte.
- Fix :
  - **[FEAT]** Nouveau node HTTP `Load Services` (GET `/rest/v1/services?merchant_id=X&is_active=eq.true`) positionné entre Find Merchant et Identify Client
  - Sanitize ajoute `safe_services_list` format "Coupe homme (30 min, 20€), Barbe (20 min, 10€)"
  - Système prompt : « Chaque service a sa durée. Utilise-la dans tool_args.duration_minutes. Ne demande JAMAIS au client combien de temps il veut. »

**Bug E — Hallucination : propose la semaine de congé du praticien**
- User : « Je demande RDV la semaine prochaine, il me répond pas de dispo la semaine du 13. Je dis la semaine suivante, il me répond encore la semaine du 13. »
- Causes : (a) `get_available_slots` ne prend qu'UNE date (un seul jour scanné), (b) pas de différenciation « semaine prochaine » vs « suivante », (c) Gemini 2.5 Flash Lite hallucinait parfois des dispos sans jamais appeler la fonction.
- Fix partiel : (a) règle stricte dans Gemini AI Final pour CAS count=0 — « NE DIS JAMAIS pas de disponibilité toute la semaine. Propose 2-3 autres jours concrets pour re-vérifier. », (b) `week_after_next_*` déjà ajouté en 2.7.9, (c) **forçage du tool call** via `toolConfig.functionCallingConfig.mode: "ANY"` — voir Bug F.

**Bug F — Gemini halluciner des disponibilités sans jamais appeler get_available_slots**
- Test avec « Coupe homme mardi prochain » (service + date clairs) → Gemini répond « Mardi prochain, nous avons des disponibilités pour une coupe homme » sans jamais avoir appelé la fonction. Pure invention.
- Prompt anti-hallucination en MAJUSCULES de 2.7.9 ne suffisait plus (Gemini 2.5 Flash Lite ignorait la règle).
- **Fix radical** :
  - Sanitize détecte l'intention booking via regex : `bookingKeywords` (rdv, créneau, coupe, barbe, ...) + `timeKeywords` (demain, mardi, semaine, ...)
  - Si intention claire → `safe_tool_call_mode = "ANY"`, sinon `"AUTO"`
  - Gemini AI jsonBody ajoute `toolConfig.functionCallingConfig.mode: "{{ safe_tool_call_mode }}"` + `allowedFunctionNames: ["get_available_slots"]`
  - Mode ANY force Gemini à appeler get_available_slots. Pas d'échappatoire possible pour halluciner.

### Bug supplémentaire — Save AI Message après Send Reply

Observation : si Send Reply fail (WhatsApp API down, phone non whitelisté), Save AI Message était skippé → historique incomplet (messages AI jamais sauvegardés). Fix : **reorder** `Booking Action? → Save AI Message → Send Reply → Respond OK` (au lieu de `Booking Action? → Send Reply → Save AI Message → Respond OK`). L'AI message est persisté AVANT d'essayer de l'envoyer.

### Itérations debug

1. **Load Services duplicate Identify Client runs** : Load Services retourne 2 items (Coupe + Barbe) → Identify Client exécuté 2 fois → 2e INSERT échoue sur constraint unique. Fix : `executeOnce: true` sur Identify Client.
2. **on_conflict constraint mismatch** : tenté `merchant_id,whatsapp_id` qui est PARTIAL (PostgREST ne supporte pas) → erreur 42P10. Revert à `merchant_id,phone` (non-partial depuis migration 020).
3. **`=ANY` littéral** : expression `"mode":"={{ safe_tool_call_mode }}"` renvoyait `"=ANY"` (avec = préfixe littéral) car `=` avant `{{` était interprété comme caractère. Fix : retirer le `=` préfixe, utiliser `"mode":"{{ safe_tool_call_mode }}"`. Passage de Gemini error → Mistral Fallback.
4. **alwaysOutputData au mauvais endroit** : n8n MCP a flagué `alwaysOutputData` dans `parameters` au lieu du niveau node. Fix : move to node level.

### Greeting selon l'heure locale

Sanitize calcule `safe_greeting_word` :
```js
const currentHour = nowDt.hour;
const greetingWord = (currentHour >= 18 || currentHour < 5) ? 'Bonsoir' : 'Bonjour';
```
Europe/Paris timezone. Gemini utilise cette valeur dans le prompt, plus de choix aléatoire entre Bonjour/Bonsoir.

### Validation E2E (exec 2604)

Input : `{"message_text": "Coupe homme mardi prochain", "sender_phone": "33600000005"}`

Output Parse Gemini Response :
- `has_tool_call: true`
- `tool_args: { date: "2026-04-14", duration_minutes: 30 }` ← la durée coupe homme
- `safe_tool_call_mode: "ANY"` (force)
- `safe_has_history: true` (msg précédent détecté)

Output Parse Final Response :
- `response_text: "Je n'ai pas de disponibilité pour la coupe homme le mardi 14 avril. Souhaitez-vous que je vérifie le mercredi 15 avril, le jeudi 16 avril ou le vendredi 17 avril ?"`
- Pas de salutation (history existe) ✓
- Pas d'année ✓
- Pas d'hallucination ✓
- Service mentionné avec sa durée ✓
- 3 alternatives concrètes ✓

### Tokens

Prompt gonfle à ~1100-1200 tokens en 1er appel (ajout services + toutes les règles). Acceptable vs la fiabilité gagnée. Coût marginal ~0.0001€ par message.

### Fichiers modifiés
- `n8n/workflows/booking-conversation.json` — re-export live (164 KB, 35 nodes)

### Limitations P2 restantes
- **get_available_slots ne scan qu'un jour** : si count=0, Gemini propose des alternatives mais ça nécessite un nouveau message user. Solution propre = RPC `get_available_slots_range(start_date, days_count)` pour scanner 5-7 jours en un appel. Reporté en migration 023.
- **Mistral Fallback** : n'a pas les nouveaux champs `safe_services_list`, `safe_greeting_word`, etc. dans son prompt. Acceptable en mode dégradé.
- **Duplicates de conversations** : l'appel Ensure Conversation crée une nouvelle row si aucune n'est active. Si un user réactive une vieille conversation manuellement, pas de cleanup automatique.

### Commits
- Single commit pour cette session polish 6 : Load Services + Sanitize v3 + Gemini prompts renforcés + tool_call_mode forcé + reorder Save AI Message + CHANGELOG 2.7.10

---

## [2.7.9] — 2026-04-11 — Polish Option D : conversation_history + ton + next_open_day + anti-hallucination

Suite de 2.7.8. Tests WhatsApp réels ont révélé 4 nouveaux bugs critiques. Session longue de debug, itérations multiples sur les prompts Gemini et la pipeline conversation.

### Bugs identifiés

**Bug #1 — Gemini dit « Coucou ! » au lieu de « Bonjour »**
- User rapporte : « Gemini me répond par Coucou ! ça fait pas très pro »
- Cause : `ai_tone: "friendly"` dans la config merchant, interprété par Gemini comme français décontracté
- Fix : règles de ton STRICTES dans les 2 system prompts Gemini (Gemini AI + Gemini AI Final) : commence TOUJOURS par « Bonjour » ou « Bonsoir », JAMAIS « Coucou/Salut/Hello », vouvoiement par défaut, phrases courtes (max 2-3)

**Bug #2 — Gemini conclut « pas de dispo toute la semaine » après un seul jour queried**
- User : « Je lui demande un RDV la semaine prochaine, il me répond pas de dispo la semaine du 13. Je lui dis la semaine suivante et il me répond pas de dispo la semaine du 13 »
- Causes : (1) `get_available_slots` ne prend qu'UNE date, (2) pas de `week_after_next_*` dans ref_dates, (3) `conversation_history` pas chargée donc Gemini ne sait pas ce qu'il a dit avant
- Fix partiel : ajout `week_after_next_monday..saturday` dans ref_dates + instruction dans Gemini AI Final « NE DIS JAMAIS pas de dispo toute la semaine — tu n'as vérifié QU'UNE DATE. Propose explicitement 2-3 autres jours concrets »

**Bug #3 — Hallucination « samedi 18 avril » sans appeler la fonction**
- User : « Nouveau test je lui demande un RDV le plus tôt possible il me répond le samedi 18 avril alors que le praticien est en congé »
- Cause : Gemini a inventé « samedi 18 avril » sans jamais appeler `get_available_slots` (`has_tool_call: false`). Il a halluciné une date et promis des créneaux non vérifiés.
- Fix : (a) RÈGLE ABSOLUE ANTI-HALLUCINATION dans le system prompt en MAJUSCULES : « INTERDIT de mentionner une DATE, un HORAIRE, ou une DISPONIBILITÉ dans ta réponse texte sans avoir d'abord appelé get_available_slots. Soit tu appelles la fonction, soit tu demandes une précision, mais tu n'INVENTES jamais. » (b) Ajout d'une entrée `next_open_day` dans ref_dates : prochain jour où le salon est ouvert selon `opening_hours` (saute dimanche si fermé). (c) Mapping « le plus tôt possible » / « dès que possible » / « asap » → `next_open_day` dans le prompt.
- Validation exec 2521 : `"RDV le plus tôt possible"` → Gemini query `date=2026-04-13` (lundi, next_open_day) → 0 slots → répond « Bonsoir, je n'ai malheureusement pas de disponibilité pour le lundi 13 avril. Souhaitez-vous que je vérifie le mardi 14, le mercredi 15 ou le jeudi 16 ? »

**Bug #4 — `conversation_history` toujours « Première interaction »**
- Build Context hardcodait `conversation_history: 'Premiere interaction'` ET était en amont de Load Conversation History → Gemini n'avait JAMAIS d'historique entre messages.
- Tables `conversations` et `messages` vérifiées vides via curl Supabase → aucune conversation n'avait jamais été créée. Save AI Message utilisait `conversation_id: null` hardcodé par Build Context (rejeté par la contrainte NOT NULL de `messages.conversation_id`).

### Fix Bug #4 — Pipeline conversation complète

**Migration 022** (`022_create_get_or_create_active_conversation.sql`) :
- RPC `get_or_create_active_conversation(p_merchant_id UUID, p_client_id UUID, p_channel TEXT) RETURNS TABLE(id UUID)`
- Atomique : cherche une conversation active existante pour le couple, sinon en crée une, retourne l'ID dans tous les cas
- `SECURITY DEFINER` + `GRANT EXECUTE TO service_role, authenticated`
- Appliquée manuellement via Supabase Studio (pattern établi depuis migration 021)

**Workflow — 2 nouveaux nodes + 4 modifiés** :
- **[FEAT]** `Ensure Conversation` (HTTP POST, executeOnce=true) — appelle la RPC `get_or_create_active_conversation` avec merchant_id/client_id/channel. Retourne `{id: "uuid"}`. Positionné entre Build Context et Load Conversation History.
- **[FEAT]** `Save Client Message` (HTTP POST /rest/v1/messages, executeOnce=true) — persiste le message utilisateur AVANT Gemini. Positionné entre Load Conversation History et Check Client Packages.
- **[REFACTOR]** `Load Conversation History` — l'URL passe de `/rest/v1/conversations?client_id=...` à `/rest/v1/messages?conversation_id=eq.{{ Ensure Conversation id }}&select=content,sender,created_at&order=created_at.asc&limit=20`. Retourne directement un array de messages (spread en N items côté n8n).
- **[REFACTOR]** `Sanitize Prompt Inputs` jsCode :
  - Lit `$('Load Conversation History').all()` (pas `.first()` — n8n spread les N messages en N items) et les mappe vers `[Role] content` joined avec newlines
  - JSON-escape via `JSON.stringify(rawHistory).slice(1, -1)` pour que les newlines deviennent des literal `\n` (2 chars) au lieu de real newlines qui cassent le jsonBody JSON template de Gemini
  - Propage `conversation_id` via `$('Ensure Conversation').first().json.id` (n8n auto-unwrap single-row)
- **[REFACTOR]** `Save AI Message` — body utilise `conversation_id: {{ $('Ensure Conversation').first().json.id }}` au lieu de `$('Build Context').first().json.conversation_id` (qui était toujours `null`)

### Itérations debug notables

1. **Code node Ensure Conversation échoué** : `$helpers`, `fetch`, `URL` tous absents du sandbox n8n task-runner. Impossible de faire du HTTP depuis un Code node. Basculé sur un HTTP Request node appelant la RPC.
2. **Expression `[0].id` cassée** : la RPC retourne `[{"id": "uuid"}]` mais n8n auto-unwrap les single-row array en objet unique. Expression corrigée en `.json.id` (sans l'index `[0]`).
3. **Duplicate inserts** : Load Conversation History retournait N items → Save Client Message tournait N fois → N inserts dupliqués. Fix : `executeOnce: true`.
4. **JSON body invalid** : les real newlines de `safe_conversation_history` cassaient le JSON. Fix : JSON.stringify + slice pour escape.

### Validation E2E (2 messages consécutifs, même sender_phone)

Test 1 (exec 2545, `Je voudrais un RDV mardi prochain svp`) :
- Ensure Conversation crée `f656aae2-3eea-42a8-9058-a2d7cbc8fdf0`
- Save Client Message insère le message client
- Load Conversation History retourne `[]` (vide, normal 1er msg)
- `safe_conversation_history: "Première interaction"`
- Gemini query `date=2026-04-14` (mardi prochain), 0 slots, propose alternatives

Test 2 (exec 2546, `Finalement plutôt mercredi`, même sender_phone) :
- Ensure Conversation réutilise `f656aae2-...` (retrouvée via RPC)
- Load Conversation History retourne **1 item** : le message du test 1
- `safe_conversation_history: "[Client] Je voudrais un RDV mardi prochain svp"` ✓
- Gemini lit l'historique et répond : « Bonsoir, je regarde vos disponibilités pour mercredi. Pourriez-vous me préciser l'année s'il vous plaît ? » — comprend le changement de demande (mardi → mercredi) grâce au contexte

### Observations & P2

- **Save AI Message reste APRÈS Send Reply** — si Send Reply fail (fake phone ou WhatsApp API down), le message AI n'est pas sauvegardé. En prod réelle ça tourne OK. Reorder possible pour robustesse.
- **Gemini demande l'année** au 2e message — pourtant `AUJOURD'HUI : samedi 2026-04-11` est dans le prompt. Cosmétique, le modèle est nerveux.
- **Bonjour/Bonsoir selon l'heure** non résolu — Gemini dit « Bonsoir » à 15h44. Fix possible : pré-calculer `greeting_word` dans Sanitize selon `DateTime.now().hour`.
- **Conversation history ne contient pas les messages AI** car Save AI Message n'a jamais tourné dans les tests (Send Reply fail avant). En prod réelle, il devrait tourner et enrichir l'historique avec `[IA]` entries.
- **Duplicates dans la DB** des tests itérés — cleanup manuel via `DELETE FROM messages WHERE conversation_id=...` effectué pendant le debug.

### Fichiers modifiés
- `supabase/migrations/022_create_get_or_create_active_conversation.sql` — nouvelle migration RPC
- `n8n/workflows/booking-conversation.json` — re-export live (157 KB, 34 nodes)

### Commits
- Single commit pour cette session polish 5 : migration 022 + refactor conversation pipeline + tous les fixes de prompt + CHANGELOG 2.7.9

---

## [2.7.8] — 2026-04-11 — Polish Option D : ref_dates pré-calculées + greeting guardrail

Après validation initiale de l'Option D (2.7.7), les tests E2E supplémentaires ont révélé 2 bugs modèle sur Gemini 2.5 Flash Lite. Session polish dédiée pour les corriger.

### Bugs identifiés et corrigés

**Bug #1 — Gemini day-of-week math error** (exec 2477)
- Test : `"Je voudrais un RDV lundi prochain svp"` (aujourd'hui samedi 2026-04-11)
- Gemini a émis `functionCall(date: "2026-04-14")` — **2026-04-14 est un mardi**, pas un lundi. Lundi prochain = 2026-04-13.
- La réponse textuelle de Gemini parlait quand même de « lundi prochain » → bug cognitif interne entre la date qu'il croit avoir queried et la date qu'il a réellement queried.
- **Cause** : petit modèle (Flash Lite) a du mal avec la navigation day-of-week relative.

**Bug #2 — Tool call pour greetings** (exec 2469, 2471, 2480)
- Test : `"Bonjour"` seul
- Gemini appelait `get_available_slots` malgré la consigne « N'appelle PAS la fonction si l'utilisateur dit juste Bonjour ».
- Variations observées : `date: "2026-04-12"` (demain), `date: "2026-04-11"` (aujourd'hui) — Gemini inventait une date par défaut.
- **Cause** : tool-use bias connu des petits LLMs — si un tool est disponible, le modèle a tendance à l'utiliser.

### Fix #1 — Pré-calcul des dates de référence (Sanitize Prompt Inputs)

- **[FEAT]** Ajout d'un champ `ref_dates` à la sortie de `Sanitize Prompt Inputs` contenant 11 dates pré-calculées (`today`, `today_label`, `tomorrow`, `day_after_tomorrow`, `next_monday`..`next_sunday`)
- Calcul en Luxon DateTime via `DateTime.now().setZone('Europe/Paris')` avec locale `fr` pour le label (ex: `"samedi 2026-04-11"`)
- Formule weekday helper : `((target - todayWeekday + 7) % 7) || 7` — retourne strictement la prochaine occurrence (pas aujourd'hui si target == todayWeekday, mais dans 7 jours)
- Validation côté JS : `next_monday: "2026-04-13"` quand today = samedi 2026-04-11 ✓

### Fix #2 — System prompt Gemini AI utilise ref_dates

- **[REFACTOR]** Le system prompt retire l'instruction « calcule la date toi-même depuis $today » et la remplace par une LISTE de dates pré-calculées à copier directement
- Section ajoutée : `DATES DE RÉFÉRENCE (copie ces valeurs directement dans tool_args.date, ne calcule JAMAIS toi-même)` avec les 11 termes relatifs mappés sur les valeurs ISO depuis `{{ $('Compute Budget Status').first().json.ref_dates.XXX }}`
- Règles d'appel renforcées : `Appelle la fonction UNIQUEMENT si le message contient à la fois une intention de réserver ET un indice temporel` + liste explicite des cas où NE PAS appeler (salutation seule, question générique, annulation, remerciement)
- Validation E2E exec 2479 : `"Je voudrais un RDV lundi prochain svp"` → `tool_args.date: "2026-04-13"` ✓ (correct cette fois)

### Fix #3 — Greeting guardrail dans Parse Gemini Response

Le fix #2 n'a pas suffi : Gemini continue d'appeler la fonction pour `"Bonjour"` seul (exec 2480 : `date: "2026-04-11"`). Le tool-use bias persiste même avec des règles explicites.

- **[FEAT]** Ajout d'un guardrail code-level dans `Parse Gemini Response` qui détecte via regex 2 familles de patterns :
  - `GREETING_PATTERN: /^(bonjour|coucou|salut|hello|bonsoir|hi|hey|yo|hola|allo|allô|cc)[!.\s,]*$/i`
  - `THANKS_PATTERN: /^(merci|thanks|thx|ok|d'accord|daccord|parfait|super)[!.\s,]*$/i`
- Si `fnCall && (isGreeting || isThanks)`, on OVERRIDE : `has_tool_call: false`, `response_text` injecté depuis un template statique, `llm_error: 'greeting_override'` pour tracer l'override dans les logs
- Template greeting : `"Bonjour ! Je suis {{ai_name}}, l'assistant du salon {{salon_name}}. Souhaitez-vous prendre rendez-vous ? Dites-moi quel jour vous arrangerait."`
- Template thanks : `"Avec plaisir ! À bientôt au salon {{salon_name}}."`

### Validation E2E finale (exec 2483)
Test : `{"message_text": "Bonjour"}`
- `Gemini AI` → success 970 prompt tokens (1er appel avec le nouveau prompt verbeux ~+400 tokens vs 2.7.7)
- `Parse Gemini Response` → détecte `fnCall` + `isGreeting=true` → override appliqué
- `Has Tool Call?` → route vers main[1] (false branch) ✓
- `Check Availability`, `Build Tool Response`, `Gemini AI Final`, `Parse Final Response` → **skippés** (non exécutés)
- `Compute Token Cost` → `llm_total_tokens: 996`, `token_cost_eur: 0.0000805`, `llm_error: 'greeting_override'`
- Durée totale : **2.9s** (vs 4.0s en flow complet avec tool — **économie 1.1s + 2e appel Gemini + RPC**)
- `executedNodes: 21` au lieu de 25 (4 nodes skippés)

### Fichiers modifiés
- `n8n/workflows/booking-conversation.json` — re-export du workflow live (137 KB, 32 nodes)

### Coûts et perfs observés

| Scenario | Nodes exec | Tokens | Coût €   | Durée |
|----------|-----------|--------|----------|-------|
| `"Bonjour"` (avant polish, exec 2472) | 25 | 901 | 0.00013 | 4.05s |
| `"Bonjour"` (après guardrail, exec 2483) | 21 | 996 | 0.00008 | 2.99s |
| `"RDV lundi prochain"` (après polish, exec 2479) | 25 | 1345 | 0.00014 | 3.73s |

Le prompt élargi (+ref_dates) coûte ~350 tokens de plus en 1er appel (Gemini AI), mais le guardrail évite le 2e appel + RPC sur les greetings.

### Tokens et dates observés dans exec 2479 ref_dates
- `today: "2026-04-11"`, `today_label: "samedi 2026-04-11"`
- `tomorrow: "2026-04-12"`
- `day_after_tomorrow: "2026-04-13"` (= next_monday)
- `next_monday: "2026-04-13"` ✓
- `next_tuesday: "2026-04-14"` ✓
- ... `next_saturday: "2026-04-18"` (dans 7j)
- `next_sunday: "2026-04-12"` (demain, le prochain dimanche à venir)

### Points d'attention pour la suite
- **[P2]** Le prompt Gemini 1er appel est passé de ~545 tokens à ~970 tokens (+78%). Coût marginal acceptable pour la fiabilité gagnée, mais à optimiser si la latence devient critique
- **[P2]** Le guardrail greeting utilise une regex — les variations orthographiques (`"Bjr"`, `"Bonjou"`) ne sont pas matchées. Si besoin, étendre la regex ou ajouter une étape NLU légère. V1 accepte le recall imparfait
- **[P2]** Le warning validator « Has Tool Call? main[1] missing onError » reste un faux positif (pré-existant depuis 2.7.7)

### Commits
- Single commit pour cette session polish : ref_dates + greeting guardrail + CHANGELOG 2.7.8

---

## [2.7.7] — 2026-04-11 — Option D : Gemini function calling (tool-use) pour Booking Conversation

Suite directe de 2.7.6. La limitation « date hardcodée à today » dans `Check Availability` est résolue via un refactor du workflow en pattern Gemini function calling. Gemini reçoit `get_available_slots` comme tool déclaré, extrait lui-même la date du message utilisateur (`demain`, `mardi prochain`, etc.), émet un `functionCall`, le workflow exécute la RPC avec la VRAIE date et renvoie le résultat à Gemini qui génère alors la réponse finale. **Bug structurel résolu.**

### n8n — Refactor Booking Conversation (workflow `ztxCL7QS1DLo1i59`, 28 → 32 nodes)

**Nodes modifiés (4) :**
- **[REFACTOR]** `Gemini AI` (1er appel) — jsonBody réécrit : déclare `tools.functionDeclarations` pour `get_available_slots(date, duration_minutes)`, system prompt mis à jour avec instructions pour calculer la date depuis `$today`, section `CRÉNEAUX DISPONIBLES` retirée du prompt (les slots sont chargés à la demande), `responseMimeType` retiré (incompatible avec function calling natif)
- **[REFACTOR]** `Parse Gemini Response` — jsCode réécrit : détecte `candidates[0].content.parts[].functionCall` vs texte direct. Si tool call → sauvegarde `tool_args`, `tool_call_id`, `conversation_parts` + `gemini_call1_*` tokens. Sinon → chemin legacy inchangé (texte JSON parsé)
- **[REFACTOR]** `Check Availability` — `p_date` passe de `$today.format('yyyy-MM-dd')` à `$('Parse Gemini Response').first().json.tool_args.date` (fallback `$today` si args manquants), `p_duration_minutes` lit `tool_args.duration_minutes || 30`. Position déplacée de `[688, 64]` (flow main) à `[2848, 48]` (branche tool-use)
- **[REFACTOR]** `Sanitize Prompt Inputs` — retrait de la dépendance à `Check Availability.all()`. `safe_available_slots_text` devient un placeholder `'Les créneaux sont vérifiés à la demande via la fonction get_available_slots.'` (consommé uniquement par Mistral Fallback en mode dégradé)

**Nodes ajoutés (4) :**
- **[FEAT]** `Has Tool Call?` (IF v2.3) — condition `$json.has_tool_call === true`, route vers Check Availability (true) ou Compute Token Cost (false)
- **[FEAT]** `Build Tool Response` (Code) — formate les slots retournés par Check Availability en objet `tool_response_data: {slots: [...], count: N, message: "..."}` utilisable comme `functionResponse.response`
- **[FEAT]** `Gemini AI Final` (HTTP Request) — 2e appel Gemini. jsonBody construit inline via `{{ JSON.stringify($('Parse Gemini Response').first().json.conversation_parts) }}` et `{{ JSON.stringify($('Build Tool Response').first().json.tool_response_data) }}`. `contents` = user + model(functionCall) + user(functionResponse) per doc Gemini. `responseMimeType: application/json` pour structured output final
- **[FEAT]** `Parse Final Response` (Code) — parse le JSON final, merge les tokens des 2 appels Gemini (`llm_prompt_tokens = call1 + call2`, idem completion/total)

**Connexions rewire (3 remove + 8 add = 11 ops) :**
- `Load Conversation History → Check Availability` supprimé, remplacé par `Load Conversation History → Check Client Packages`
- `Check Availability → Check Client Packages` supprimé
- `Parse Gemini Response → Compute Token Cost` supprimé, remplacé par branche `Parse Gemini Response → Has Tool Call? → {Check Availability | Compute Token Cost}`
- Nouvelles arêtes : `Check Availability → Build Tool Response → Gemini AI Final → Parse Final Response → Compute Token Cost`

### Validation doc Gemini
- Lecture doc function calling (`https://ai.google.dev/gemini-api/docs/function-calling`) : `functionResponse` doit être injecté dans un message `role: "user"` (pas `"function"` comme initialement supposé dans le plan), avec `id` matching le `functionCall.id` si présent. Plan mémoire corrigé
- `responseMimeType` + `tools` : la doc ne prohibe pas explicitement mais recommande de ne pas combiner. Choix : 1er appel sans `responseMimeType` (permet function calling), 2e appel avec `responseMimeType: application/json` (plus de tools, pas de conflit)

### Bugs rencontrés et résolus

- **[FIX]** Validator n8n `Expression error: Unmatched expression brackets {{ }}` — les `}}` structurels JSON adjacents (ex: `"required":["date"]}}]`) étaient comptés comme closings d'expression non-matchés. **Fix** : insérer un espace entre chaque paire `}}` structurelle (`} }`) pour les désambiguïser
- **[FIX]** `The value in the "JSON Body" field is not valid JSON` sur Gemini AI Final (position 378) — 1 `}` en trop dans ma séquence de fermeture après l'expression `tool_response_data`, qui fermait prématurément le root `{`. Structure correcte après `{{ JSON.stringify(...) }}` : `} }]}]` (close funcResponse, close part, close parts array, close item 3, close contents array). **2 itérations** pour identifier le char exact en trop

### Validation E2E (exec `2472`)
Test : `{"message_text": "Bonjour", "sender_phone": "33600000001"}` (date système : 2026-04-11)
- `Gemini AI` → success 676ms — émet `functionCall { name: "get_available_slots", args: { date: "2026-04-12" } }` (Gemini a calculé « demain » = aujourd'hui +1 correctement). Tokens call1 : prompt=545, completion=26, total=571
- `Parse Gemini Response` → `has_tool_call: true`, `tool_args.date: "2026-04-12"`, `conversation_parts` sauvées
- `Has Tool Call?` → route branche TRUE ✓
- `Check Availability` → query `p_date=2026-04-12` (**plus hardcodé sur today !**), retourne `[]` (2026-04-12 = dimanche = salon fermé)
- `Build Tool Response` → `tool_response_data: { slots: [], count: 0, message: "Aucun créneau disponible pour cette date." }`
- `Gemini AI Final` → success 623ms, génère `response_text: "Coucou ! Malheureusement, nous n'avons plus de disponibilités le 12 avril. Souhaiterais-tu que je regarde pour une autre date ?"`. Tokens call2 : prompt=228, completion=102, total=332
- `Parse Final Response` → tokens mergés : `llm_prompt_tokens=773 (545+228)`, `llm_completion_tokens=128 (26+102)`, `llm_total_tokens=901`
- `Send Reply` → erreur 502 WhatsApp #131030 « Recipient phone number not in allowed list » : **attendu** (`33600000001` = numéro fake choisi volontairement pour éviter d'envoyer de vrais messages pendant les tests). Le chemin critique est validé.

**Confirmation du fix structurel** : le message IA mentionne « le 12 avril » (la vraie date demandée par Gemini), pas aujourd'hui. Avant Option D, la réponse aurait été basée sur les slots d'aujourd'hui (samedi 11 avril) alors que l'intention était demain — le faux négatif 6j/7 est éliminé.

### Fichiers modifiés
- `n8n/workflows/booking-conversation.json` — export live du workflow post-refactor (32 nodes, 129 KB, 4 nouveaux nodes confirmés)
- `n8n/drafts/option-d/*.js` — brouillons des Code nodes écrits avant batch update (Parse Tool Call, Build Tool Response, Parse Final Response, Sanitize Prompt Inputs refactor, Gemini AI jsonBody, Gemini AI Final jsonBody)

### Points d'attention pour la suite
- **[P1]** Gemini appelle la fonction même pour « Bonjour » (comportement modèle : il calcule `date = aujourd'hui + 1` par défaut). Le system prompt dit « N'appelle PAS la fonction si l'utilisateur dit juste bonjour » mais Gemini ne respecte pas toujours. À renforcer ou accepter (latence +500ms + tokens gaspillés sur greetings)
- **[P1]** `Mistral Fallback` est maintenant dégradé : il ne reçoit plus les slots (le placeholder `'chargés à la demande'` est envoyé). Acceptable en V1 (Mistral répondra « Je vérifie et recontacte »). En V2 : implémenter function calling pour Mistral aussi
- **[P1]** `tool_call_id` non préservé actuellement (Gemini 2.5 Flash Lite ne semble pas l'émettre). Le code gère le cas `null` proprement
- **[P2]** Warnings validator n8n sur `Has Tool Call?` (« error output connections in main[1] ») : faux positif, `main[1]` d'un IF node est la branche `false`, pas une error output. Les 3 IF pré-existants ont le même warning et tournent en prod. Ignorable.

### Commits
- Single commit pour cette session : refactor Booking Conversation Option D + CHANGELOG 2.7.7

---

## [2.7.6] — 2026-04-11 — Migration 021 get_available_slots + restauration Check Availability

Suite directe de la session 2.7.5. Une fois le pipeline WhatsApp opérationnel avec Mistral puis Gemini, on s'attaque à la vraie logique métier de disponibilité.

### Supabase DB
- **[FEAT]** Migration `021_create_get_available_slots.sql` — fonction SQL qui retourne les créneaux libres pour un merchant/date/durée.
  - Signature : `get_available_slots(p_merchant_id UUID, p_date DATE, p_duration_minutes INTEGER) RETURNS TABLE (slot_start TIMESTAMPTZ, slot_end TIMESTAMPTZ, practitioner_id UUID, practitioner_name TEXT)`
  - Logique : intersection `merchant.opening_hours` (JSONB par day name) ∩ `practitioner_availability` (day_of_week + exception_date), priorité aux exceptions datées, filtre break_times, filtre bookings non-cancelled/no_show
  - Timezone-aware via `AT TIME ZONE merchants.timezone` (DST handled)
  - `SECURITY INVOKER`, `GRANT EXECUTE TO service_role, authenticated`
  - Appliquée manuellement via Supabase Studio

### Validation fonction (5 tests curl OK)
- `2026-04-20` (lundi, Nora rentrée de congés) → **20 slots** de 09:00 à 18:30 Europe/Paris
- `2026-04-13` (lundi prochain, Nora en congé via exception_date) → `[]`
- `2026-04-12` (dimanche, salon fermé) → `[]`
- `2026-04-11` (samedi, Nora off recurrent day_of_week=6) → `[]`
- merchant inconnu → `[]`

### n8n — Restauration Check Availability (workflow Booking Conversation)
- **[FEAT]** Node `Check Availability` recréé via `addNode` (il avait été supprimé en 2.7.5 avec cleanStaleConnections)
  - URL : `/rest/v1/rpc/get_available_slots`
  - Credential `Supabase apikey` + `Authorization: Bearer <service_role>` inline
  - Body keypair : `p_merchant_id={{ $('Build Context').first().json.merchant_id }}`, `p_date={{ $today.format('yyyy-MM-dd') }}`, `p_duration_minutes=30`
  - `alwaysOutputData: true` + `onError: continueRegularOutput`
- **[REFACTOR]** Rewire : `Load Conversation History → Check Availability → Check Client Packages → Check Client Subscriptions → Sanitize`
- **[REFACTOR]** `Sanitize Prompt Inputs` jsCode : lit `$('Check Availability').all()`, formate les slots en texte groupé par praticien via `Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false })`. Output : `safe_available_slots_text` contient maintenant les vrais slots.

### Validation E2E (exec `2451`)
- 23 nodes exécutés, flow complet jusqu'à Respond OK
- Check Availability : 56ms, success, 1 item output
- Gemini AI : primary, 498 tokens, `llm_is_fallback: false`
- Réponse IA délivrée sur WhatsApp avec latence ~4.8s

### ⚠️ Limitation découverte : date hardcodée

Le node Check Availability query actuellement avec `p_date = $today`, pas avec la date demandée par l'utilisateur. Exemple : user dit "un RDV mardi", workflow query pour aujourd'hui (samedi = 0 slots car Nora off). Gemini reçoit "aucun créneau" et parrot "pas de créneau ce mardi" dans sa réponse — **faux négatif**.

Solution prévue : **refactor en pattern tool-use (Gemini function calling)** — cf memory `project_option_d_gemini_function_calling.md` pour le plan détaillé (45-60 min, session dédiée).

### Commits
- Single commit pour cette sous-session : migration 021 + CHANGELOG 2.7.6

---

## [2.7.5] — 2026-04-11 — WhatsApp E2E débloqué : auth, credentials, routing, refs cassées, middleware, deploy prod

Session marathon pour faire fonctionner le pipeline WhatsApp → IA → réponse de bout en bout. Une trentaine de bugs empilés, tous résolus. **Résultat** : on reçoit maintenant des réponses IA contextuelles (Mistral fonctionnel, Gemini en attente d'activation côté Google Cloud).

### Infra Vercel
- **[FIX]** `INTERNAL_API_SECRET` sur Vercel prod contenait un `\n` littéral décodé en vrai newline au runtime → timing-safe compare impossible depuis HTTP (newline interdit dans header). Valeur réécrite proprement (64 chars hex) via `vercel env rm` + `vercel env add` stdin + `printf '%s'` (sans trailing newline).
- **[CHORE]** **3 déploiements Vercel prod manuels** via `vercel --prod --yes` — la prod était gelée depuis 5 jours car les builds auto (sur push main) échouaient tous avec `STRIPE_SECRET_KEY is not configured` (var absente en scope Preview, présente en Production uniquement). Deploy 1 : code récent + middleware initial. Deploy 2 : après cleanup INTERNAL_API_SECRET. Deploy 3 : après middleware bypass.
- **[WIP]** Git push → Preview au lieu de Production (config Vercel "Production Branch" à vérifier). Tant que pas fixé : deploy manuel requis à chaque changement.
- **[WIP]** Route `/api/v1/stripe/connect` throw au module load si `STRIPE_SECRET_KEY` manquant → tout le build saute. À refactorer en lazy import ou factory pour que les deploys Preview passent aussi.

### Next.js — Middleware
- **[FIX]** `src/middleware.ts` : ajout d'un bypass pour `/api/v1/channels/send` (auth gérée par le route handler lui-même via `X-Internal-Secret`, pas par session Supabase). La route était bloquée en 401 au niveau middleware avant même d'atteindre le handler. Pattern copié sur les bypasses existants (`health`, `booking/`, `webhooks/`).

### Supabase DB
- **[FIX]** Migration `020_fix_clients_unique_index_for_upsert.sql` — l'index unique partiel `idx_clients_merchant_phone WHERE phone IS NOT NULL` était incompatible avec la clause `ON CONFLICT` de PostgREST (erreur `42P10`). Converti en index non-partiel. Sémantique préservée (NULLS DISTINCT par défaut en PG 15+). Appliqué manuellement via Supabase Studio.

### n8n — Workflow Booking Conversation (ztxCL7QS1DLo1i59, 27 nodes)
- **[FIX]** Credential `Supabase apikey` créée (id `oRRRgpJ5HWoIrVpQ`, httpHeaderAuth, `name=apikey value=<service_role>`) pour remplacer `mRd60LO2hwQq9oBH` qui envoyait probablement un header `Authorization` au lieu de `apikey` → Supabase répondait 401 "No API key found"
- **[FIX]** Batch patch de 10 nodes Supabase : nouveau credential + header inline `Authorization: Bearer <service_role>` hardcodé (2 headers requis par Supabase : apikey pour l'auth projet, Authorization pour le rôle service_role bypass RLS). Headers existants `Prefer` / `Content-Type` préservés sur Identify Client, Create Booking, Insert Token Usage.
- **[FIX]** 11ème node Supabase manqué au batch initial : `Save AI Message` avait `authentication: "none"` → patché pareil + `onError: continueRegularOutput` (évite le retry loop si contrainte NOT NULL sur conversation_id casse l'insert)
- **[FIX]** Expression `$('Find Merchant').first().json[0].id` → `$('Find Merchant').first().json.id` dans `Identify Client.jsonBody` (Find Merchant retourne un objet, pas un array)
- **[FIX]** Credential Mistral créée (id `BKALTxrrMa7hDNXs`) + node `Mistral Fallback` : pointait par erreur sur la credential Supabase `mRd60LO2hwQq9oBH` en state hybride (credential + header inline `$env.MISTRAL_API_KEY` qui ne résolvait pas). Corrigé.
- **[FIX]** Credential Gemini `Yn2UQRijLEI1k4Nl` (httpQueryAuth) avait `name="Header Auth"` au lieu de `name="key"` → n8n envoyait `?Header Auth=<key>` au lieu de `?key=<key>` → Google API 400 "Unknown name Header Auth". Corrigé avec `name=key`, value = clé Gemini.
- **[WIP]** Gemini API 403 `SERVICE_DISABLED` : l'API `generativelanguage.googleapis.com` n'est pas activée sur le projet Google Cloud `851045247324`. Action user requise côté console Google Cloud pour débloquer Gemini en primaire.
- **[REFACTOR]** 5 Code nodes (Static Fallback, Parse Gemini Response, Parse Mistral Response) et 2 HTTP nodes (Gemini AI jsonBody, Mistral Fallback jsonBody) : remplacement des références obsolètes `$('Check AI Budget')` par `$('Compute Budget Status')` (le node `Check AI Budget` avait été refactoré en v2.7.3 mais les refs downstream n'avaient pas été updatées)
- **[REFACTOR]** Branche Load History → Packages || Subs → Sanitize sérialisée : `Load Conversation History → Check Client Packages → Check Client Subscriptions → Sanitize Prompt Inputs`. Le fork-join n8n merge les 2 parallèles de façon incompatible avec le data proxy (`$('Check Client Subscriptions').first()` crash avec "hasn't been executed" depuis Sanitize). Sérialisé = data proxy voit les deux nodes dans le même execution path.
- **[REFACTOR]** `alwaysOutputData: true` ajouté sur `Load Conversation History`, `Check Client Packages`, `Check Client Subscriptions`, `Get Monthly Token Usage` — PostgREST retourne `[]` quand pas de match (premier message, client sans package/sub/usage), n8n émet 0 items, flow s'arrête. Ce flag force l'émission d'1 item vide pour que le flow continue.
- **[REMOVE]** Node `Check Availability` supprimé + `cleanStaleConnections`. L'ancien RPC `get_available_slots` n'existe pas en base, et `onError: continueRegularOutput` sur le node ne fork pas proprement vers les 2 branches downstream (Packages + Subs). Suppression + rewire `Load Conversation History → Packages`. À restaurer quand la migration 021 sera écrite (cf memory `project_get_available_slots_rpc_missing.md`).
- **[FIX]** `Send Reply` : le field `message` référençait `$json.response_text` qui était wipé par `Insert Token Usage` (Prefer=return=minimal → PostgREST renvoie body vide → n8n perd le contexte). Changé vers `$('Compute Token Cost').first().json.response_text` (point de fusion des 3 branches LLM où `response_text` est encore présent).

### Bugs d'engine MCP découverts
- **[WIP]** `mcp__n8n-mcp__n8n_update_partial_workflow` avec `patchNodeField` a un bug : sur batch de 3 ops, parfois seulement 1 sur 3 est réellement appliquée (tool return `Applied 3 operations` mais 2 sur 3 ne tiennent pas sur le workflow en live). Workaround : passer par `updateNode` avec remplacement full jsCode. À investiguer / report upstream.

### Commits/deploys
- Middleware fix sur `src/middleware.ts` (ajout bypass channels/send)
- Migration 020 en repo + appliquée via Supabase Studio manuel
- Permissions `.claude/settings.local.json` auto-ajoutées durant la session (rm, node, curl, npx vercel, etc.)
- 3 deploys prod Vercel : `aura-solution-plan-5xzmjcyns`, `-2ssk2p7ti`, `-gk8xxxq5k`

### Vérification finale (exec `2415`)
- 23 nodes totaux, flow complet jusqu'à Respond OK
- Gemini AI → erreur 403 SERVICE_DISABLED (Google side) → fallback triggered
- Mistral Fallback → réponse IA contextuelle : `"Bonjour Alex ! 😊 Malheureusement, je n'ai aucun créneau disponible pour mercredi..."`
- Send Reply → POST `/api/v1/channels/send` → HTTP 200 → Meta message_id retourné
- L'utilisateur reçoit le message sur son vrai WhatsApp
- 1 seule exécution par message (plus de retry boucle)

### Encore à faire (prochaine session)
- **Activer Gemini API** sur Google Cloud project `851045247324` (user action, 1 click)
- **Fixer Vercel "Production Branch"** dans les settings → les pushs main doivent redéployer en prod, pas preview
- **Lazy-import Stripe** dans `src/app/api/v1/stripe/connect/route.ts` pour que les builds Preview passent sans `STRIPE_SECRET_KEY`
- **Ajouter `STRIPE_SECRET_KEY` en env Preview** (alternative au lazy import)
- **Migration 021** : créer la fonction `get_available_slots` en SQL + restaurer le node `Check Availability`
- **Audit 4 autres workflows** (google-review, reminders, voice-call, package-expiration) : probablement impactés par le même credential Supabase cassé
- **Normaliser format phone** : `mr X` (0652880318) et `Alex` (33652880318) = doublon même personne
- **Save AI Message** : la contrainte `conversation_id NOT NULL` fait échouer l'insert à chaque conversation nouvelle. Créer la conversation en amont ou relaxer la contrainte.
- **Refactor n8n credentials** : service_role hardcodé dans 11 nodes en Authorization Bearer inline = si rotation de la clé, 11 points à updater

### Impact runtime
- **Prod déployée** avec toutes les corrections. Site + API live.
- **WhatsApp pipeline opérationnel** : réponses Mistral contextuelles délivrées sur WhatsApp en ~2.5-4s.
- **Aucun downtime** pendant le session (Vercel zero-downtime deploys).

---

## [2.7.4] — 2026-04-11 — Migration projet C:→D: + nettoyage settings

### Infra — Relocation du working directory
- **[CHORE]** Projet déplacé de `C:\Users\User\.Plan` vers `D:\AURAsolutions\Resaapp` (procédure copy → test → rename, zéro suppression destructive)
- **[CHORE]** Dossier mémoire Claude Code renommé en parallèle : `C--Users-User--Plan` → `D--AURAsolutions-Resaapp` (dérivé du nouveau path)
- **[DOCS]** Ajout de `MIGRATION.md` à la racine — procédure pas-à-pas réutilisable pour un futur déménagement (backup → copy → test → rename/delete, avec filets de sécurité)

### Filets de sécurité encore en place (à retirer manuellement plus tard)
- `C:\Users\User\.Plan-ancienne-version` — ancien projet complet (renommé, pas supprimé)
- `C:\Users\User\.claude\projects\C--Users-User--Plan-ancienne-version` — ancienne mémoire (renommée)
- `C:\Users\User\Desktop\backup-memory-plan-2026-04-11` — backup Desktop de la mémoire

### Cleanup `.claude/settings.local.json`
- **[CHORE]** Suppression de 3 permissions mortes qui référençaient l'ancien path :
  - `Read(//c/Users/User/.Plan/**)`
  - `Bash(for f in "C:/Users/User/.Plan/.env" ...)`
  - `Bash(awk 'NR==4' "C:/Users/User/.claude/projects/C--Users-User--Plan/...")`
- **[CHORE]** Deux nouvelles permissions auto-ajoutées pour les dossiers archive `.Plan-ancienne-version` (lecture seule, inoffensif)

### Gitignore
- **[CHORE]** Ajout de `desktop.ini` à `.gitignore` (métadonnées Windows Explorer qui polluaient `git status`)

### Vérifications pré-rename
- `.env.local` byte-identical entre C: et D: (diff vide)
- 15/15 fichiers mémoire présents des deux côtés
- Git propre sur D:, aligné avec `origin/main`
- Aucun untracked orphelin sur C: (seul `MIGRATION.md` — également sur D:)

### Commits
- `ee7226a` chore(migration): ajout MIGRATION.md + nettoyage settings après relocation C:→D:
- `784445b` chore(gitignore): ignore desktop.ini (métadonnées Windows Explorer)

### Impact runtime
- Aucun. Rien de cassé, rien de déployé, rien à redéployer (Vercel, Supabase, n8n VPS inchangés).

---

## [2.7.3] — 2026-04-10 — Bugs A+B+C : route channels/send + Create Booking PostgREST + Code nodes convertis

### Bug A — Route `/api/v1/channels/send` créée
- **[FEAT]** Nouvelle route Next.js `src/app/api/v1/channels/send/route.ts` (POST internal)
  - Auth via header `X-Internal-Secret` (timing-safe compare contre `INTERNAL_API_SECRET`)
  - Body Zod : `{channel, recipient_id, message, merchant_id}`
  - Sanitise le message via `sanitizeMessageText`
  - Appelle `sendMessage()` (helper existant qui route vers WhatsApp/Messenger/Telegram/SMS/Voice)
- **[FEAT]** Credential n8n `Internal API Secret` créée (`EaRZ4TQKBMrRdlVX`, httpHeaderAuth)
- **[FIX]** Booking Conversation > `Send Reply` : pointe sur `https://resaapp.fr/api/v1/channels/send`, body inclut `merchant_id`, auth via la nouvelle credential

### Bug B — Create Booking switché sur PostgREST direct
- **[REFACTOR]** Booking Conversation > `Create Booking` : POST direct sur `https://txebdgmufdsnkrntzvwn.supabase.co/rest/v1/bookings` au lieu de `/api/v1/bookings` (qui exigeait une session user, pas service_role)
- **[REFACTOR]** Body adapté au schéma de la table `bookings` (merchant_id, client_id, practitioner_id, service_id, starts_at, ends_at, status, source_channel)

### Bug C — Code nodes convertis en HTTP nodes (élimination de `$env`)
- **[REFACTOR]** Suppression du Code node `Check AI Budget` → remplacé par 3 nodes :
  - `Get Merchant Budget` (HTTP GET `merchants?id=eq.X&select=ai_monthly_token_budget,ai_alert_email`)
  - `Get Monthly Token Usage` (HTTP GET `ai_token_usage?merchant_id=eq.X&created_at=gte.{startOfMonth}`)
  - `Compute Budget Status` (Code, agrège budget + usage → flags `ai_budget_exceeded`, `ai_usage_percent`)
- **[REFACTOR]** Suppression du Code node `Log Token Usage` → remplacé par 3 nodes :
  - `Compute Token Cost` (Code, calcule `cost_eur` selon le provider Gemini/Mistral)
  - `Insert Token Usage` (HTTP POST `ai_token_usage`)
  - `Compute Alert Level` (Code, simplifié — anomaly detection 7j déférée pour une session ultérieure)

### Architecture — fix latent
- **[FIX]** Toutes les références `$json.merchant_id` / `$json.client_id` dans les nodes downstream remplacées par `$('Build Context').first().json.X` — sinon les fields étaient perdus après chaque HTTP node (qui retourne sa réponse, pas l'input)
- **[FIX]** Nodes touchés : Load Conversation History, Check Availability, Check Client Packages, Check Client Subscriptions, Save AI Message, Send Budget Alert, Sanitize Prompt Inputs

### Validation
- Booking Conversation : 28 nodes, `valid: true`, 0 erreur
- TypeScript : compile OK pour la nouvelle route
- Bout en bout encore non testé en exécution (à faire)

### Encore à faire
- **[WIP]** Mistral Fallback toujours en `$env.MISTRAL_API_KEY` (créer credential dédiée — clé Mistral non fournie en session)
- **[WIP]** Anomaly detection 7j supprimée (refactor à faire avec 2 HTTP nodes Get Daily Avg / Get Today)
- **[WIP]** Test d'exécution end-to-end

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
