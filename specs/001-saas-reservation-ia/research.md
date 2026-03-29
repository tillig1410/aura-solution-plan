# Research: Plan — SaaS de Réservation par IA

**Branch**: `001-saas-reservation-ia` | **Date**: 2026-03-28

## R1 — Orchestration IA : n8n + Gemini 2.5 Flash Lite

**Decision** : Gemini 2.5 Flash Lite appelé exclusivement via n8n (HTTP Request node). Prompts système stockés dans n8n, contexte client injecté dynamiquement depuis Supabase.

**Rationale** : Constitution Principe II (IA orchestrée via n8n, jamais depuis le frontend). Gemini Flash Lite offre latence < 2s et coût bas. n8n permet de modifier les flows IA sans redéployer le frontend.

**Alternatives considered** :
- Appel direct depuis Edge Functions Supabase → Rejeté : viole la constitution, rend le debugging difficile.
- LangChain/LlamaIndex → Rejeté : surcouche inutile, n8n couvre le routing et la mémoire conversationnelle.
- OpenAI GPT-4o-mini → Rejeté : coût plus élevé, moins de contrôle sur la latence, pas de pricing avantageux pour le volume visé.

## R2 — Multi-canal unifié : WhatsApp, Messenger, Telegram, SMS, Téléphone

**Decision** : Chaque canal a son webhook dédié (`/api/v1/webhooks/{channel}`) qui normalise le message en format interne unifié, puis envoie à n8n via webhook trigger. La réponse suit le chemin inverse.

**Rationale** : Format unifié permet à n8n de traiter tous les canaux avec le même workflow. Ajout d'un nouveau canal = nouveau webhook + adaptateur, sans toucher au flow IA.

**Alternatives considered** :
- Middleware unifié côté n8n → Rejeté : n8n ne gère pas nativement l'authentification webhook de chaque provider.
- Service de messagerie unifiée (MessageBird/Vonage) → Rejeté : coût, vendor lock, perte de contrôle sur les canaux individuels.

**Format message unifié** :
```
{
  channel: "whatsapp" | "messenger" | "telegram" | "sms" | "voice",
  sender_id: string,        // Identifiant canal du client
  merchant_id: string,      // UUID du commerçant
  client_id?: string,       // UUID client si déjà identifié
  content: string,          // Texte du message (ou transcription pour voice)
  timestamp: string,        // ISO 8601
  metadata: object          // Données spécifiques au canal
}
```

## R3 — Concurrence de créneaux : verrouillage optimiste

**Decision** : Verrouillage optimiste sur les créneaux via colonne `version` sur la table `bookings`. Le créneau est vérifié disponible, puis l'INSERT utilise une clause WHERE qui vérifie qu'aucune réservation n'existe déjà pour ce créneau+praticien. En cas de conflit, l'IA repropose.

**Rationale** : Constitution Principe VI (anti-race condition). Le verrouillage optimiste est le meilleur compromis performance/sécurité pour le volume visé (500 commerçants, créneaux rarement en concurrence).

**Alternatives considered** :
- Verrouillage pessimiste (SELECT FOR UPDATE) → Rejeté : surcharge BDD, risque de deadlock.
- Queue Redis avec lock → Rejeté : complexité inutile pour le volume.
- Advisory locks PostgreSQL → Considéré comme fallback si le volume augmente fortement.

## R4 — Authentification : Magic Link via Supabase Auth

**Decision** : Supabase Auth avec Magic Link uniquement. Le commerçant saisit son email, reçoit un lien de connexion, clique et accède au dashboard. Session JWT gérée par Supabase.

**Rationale** : Clarification Q2 : Magic Link uniquement. Simplifie l'UX pour les commerçants TPE. Supabase Auth gère nativement le flow Magic Link.

**Alternatives considered** :
- Email + mot de passe → Rejet�� par la clarification utilisateur.
- OAuth Google/Apple → Rejeté par la clarification utilisateur.

## R5 — Paiements : Stripe Connect Standard

**Decision** : Stripe Connect Standard. Chaque commerçant crée son compte Stripe via le flow OAuth Connect. Les paiements clients passent par Payment Links. Les pourboires sont des line items séparés dans le PaymentIntent, taggés avec le `practitioner_id`.

**Rationale** : Connect Standard minimise la responsabilité réglementaire (KYC/AML gérée par Stripe). Payment Links évitent de gérer un formulaire de paiement custom.

**Alternatives considered** :
- Connect Express → Plus de contrôle sur l'UX mais plus de charge KYC côté Plan.
- Connect Custom → Rejeté : complexité réglementaire disproportionnée.
- PaymentIntent direct → Rejeté : nécessite un formulaire custom, viole le principe Zéro Friction.

## R6 — Téléphonie IA : Telnyx Voice + Gemini STT

**Decision** : Telnyx Voice API pour recevoir les appels. Audio streamé vers Gemini pour STT (speech-to-text) en temps réel. La transcription est traitée comme un message texte par le même workflow n8n. Réponse vocale via Telnyx TTS.

**Rationale** : Telnyx est 20× moins cher que Twilio. Gemini gère nativement le STT. Le même workflow de réservation est réutilisé quel que soit le canal.

**Alternatives considered** :
- Twilio → Rejeté : coût prohibitif au volume visé.
- Deepgram STT → Considéré comme fallback si la qualité Gemini STT est insuffisante.
- Whisper (OpenAI) → Rejeté : latence trop élevée pour du temps réel.

## R7 — Cache et queues : Redis + Bull

**Decision** : Redis pour le cache de sessions et la queue Bull. n8n utilise Redis comme queue backend. Bull gère les jobs asynchrones (rappels, demandes d'avis, notifications no-show) avec backoff exponentiel.

**Rationale** : Constitution Principe VI (Bull queue avec backoff). Redis est déjà requis par n8n en mode queue, mutualiser pour le cache réduit l'infra.

**Alternatives considered** :
- RabbitMQ → Rejeté : service supplémentaire, Bull/Redis suffit.
- Supabase pg_cron → Limité pour les jobs complexes avec retry.

## R8 — Multilingue IA

**Decision** : Le commerçant configure les langues supportées dans Paramètres. Le prompt système Gemini inclut la liste des langues autorisées. L'IA détecte la langue du client et répond dans cette langue si elle est dans la liste, sinon répond dans la langue par défaut du salon.

**Rationale** : Clarification Q4 : multilingue configurable. Gemini gère nativement le multilingue sans surcoût.

**Alternatives considered** :
- Détection de langue pré-IA (ex : lingua-rs) → Rejeté : Gemini détecte nativement, inutile d'ajouter un service.
- Traduction post-IA → Rejeté : perte de naturel dans la conversation.
