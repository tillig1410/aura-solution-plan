# Feature Specification: Plan — SaaS de Réservation par IA

**Feature Branch**: `001-saas-reservation-ia`
**Created**: 2026-03-28
**Status**: Draft
**Input**: User description: "SaaS de réservation par IA pour commerçants de services (coiffeurs, barbiers, esthéticiennes). Le client réserve via WhatsApp/Messenger/Telegram/SMS/téléphone. L'IA comble les blancs grâce à l'historique. Dashboard commerçant avec 6 pages : Agenda, Clients, Messages, Services, Statistiques, Paramètres. Pourboires nominatifs par praticien. Option répondeur IA téléphonique. Paiements Stripe Connect. Fidélité, forfaits, abonnements. Pricing par siège dès 16,90€. Stack : Next.js + Supabase + n8n + Gemini + Telnyx + Stripe + Redis."

## Clarifications

### Session 2026-03-28

- Q: Quel cycle de vie pour une réservation (nombre et nature des états) ? → A: 6 états — en attente → confirmé → en cours → terminé, annulé, no-show.
- Q: Comment le commerçant s'authentifie-t-il au dashboard ? → A: Magic Link uniquement (lien par email, sans mot de passe).
- Q: Quelle politique de gestion des no-shows ? → A: Marquage manuel par le commerçant + notification au client + blocage automatique de la réservation IA après 3 no-shows.
- Q: Quelle gestion linguistique pour l'IA conversationnelle ? → A: Multilingue configurable par le commerçant (liste de langues supportées au choix).
- Q: Le client peut-il annuler son RDV via messagerie IA ? → A: Oui, avec un délai minimum configurable par le commerçant (ex : 2h avant le RDV). Au-delà du délai, l'IA refuse et invite à contacter le salon.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Réservation Conversationnelle par le Client (Priority: P1)

Un client envoie un message à son salon via WhatsApp, Messenger, Telegram ou SMS (ex : "Je voudrais une coupe mercredi après-midi"). L'IA conversationnelle comprend la demande, consulte l'historique du client pour proposer le même praticien et le même service que d'habitude, vérifie les disponibilités, et confirme le rendez-vous. Si des informations manquent (heure précise, praticien préféré), l'IA pose les bonnes questions. Le client reçoit une confirmation avec date, heure, praticien et service.

**Why this priority**: C'est le cœur de la proposition de valeur. Sans réservation conversationnelle, le produit n'existe pas.

**Independent Test**: Envoyer un message texte simulant une demande de RDV et vérifier que le système identifie le service, propose un créneau, et crée la réservation.

**Acceptance Scenarios**:

1. **Given** un client existant avec un historique de coupes chez "Marc", **When** il envoie "RDV coupe cette semaine", **Then** l'IA propose les créneaux disponibles de Marc cette semaine et confirme après choix du client.
2. **Given** un nouveau client sans historique, **When** il envoie "Bonjour je voudrais un RDV", **Then** l'IA demande le service souhaité, le praticien (ou propose le premier disponible), et le créneau.
3. **Given** un créneau déjà complet, **When** le client demande ce créneau, **Then** l'IA propose les alternatives les plus proches.
4. **Given** un client qui demande un service inexistant, **When** l'IA ne trouve pas de correspondance, **Then** elle propose les services les plus proches du catalogue.
5. **Given** un client avec un RDV confirmé dans 4h (délai d'annulation configuré à 2h), **When** il envoie "Je veux annuler mon RDV", **Then** l'IA annule le RDV et envoie une confirmation d'annulation.
6. **Given** un client avec un RDV confirmé dans 1h (délai d'annulation configuré à 2h), **When** il envoie "Je veux annuler mon RDV", **Then** l'IA refuse et invite le client à contacter le salon directement.

---

### User Story 2 — Dashboard Commerçant : Agenda & Gestion Quotidienne (Priority: P2)

Le commerçant se connecte à son dashboard et visualise son agenda du jour avec tous les RDV, répartis par praticien avec des couleurs distinctes. Il peut basculer entre les vues jour, semaine et mois. Il peut créer, modifier ou annuler un RDV manuellement. Il accède à la liste de ses clients, consulte leur fiche (historique, préférences, fidélité) et visualise les conversations IA dans la page Messages.

**Why this priority**: Le commerçant a besoin de voir et gérer ses RDV au quotidien pour que l'outil soit adopté.

**Independent Test**: Se connecter au dashboard, créer un RDV manuellement, vérifier qu'il apparaît dans l'agenda avec le bon praticien et la bonne couleur.

**Acceptance Scenarios**:

1. **Given** un commerçant connecté, **When** il ouvre la page Agenda, **Then** il voit les RDV du jour répartis par praticien avec couleurs distinctes.
2. **Given** un commerçant en vue semaine, **When** il clique sur un créneau vide, **Then** un formulaire de création de RDV s'ouvre pré-rempli avec la date/heure.
3. **Given** un commerçant sur la page Clients, **When** il clique sur un client, **Then** il voit la fiche complète : historique des visites, préférences, points de fidélité, forfaits actifs.
4. **Given** un commerçant sur la page Messages, **When** il ouvre une conversation, **Then** il voit l'historique complet de l'échange IA avec le client, tous canaux confondus.

---

### User Story 3 — Catalogue de Services & Configuration du Salon (Priority: P3)

Le commerçant configure son salon : il crée ses services (nom, durée, prix), ajoute ses praticiens (nom, spécialités, horaires), définit les horaires d'ouverture, et personnalise le comportement de l'IA (ton, langues supportées, nom). Il configure également les créneaux bloqués (pause déjeuner, congés).

**Why this priority**: La configuration est un prérequis pour que la réservation fonctionne, mais c'est une action ponctuelle — moins critique au quotidien que l'agenda.

**Independent Test**: Créer un service, ajouter un praticien avec ses horaires, et vérifier que les créneaux de réservation proposés correspondent.

**Acceptance Scenarios**:

1. **Given** un commerçant sur la page Services, **When** il crée un service "Coupe homme" à 25€ / 30 min, **Then** le service apparaît dans le catalogue et est proposé par l'IA aux clients.
2. **Given** un commerçant sur la page Paramètres, **When** il ajoute un praticien "Sophie" avec horaires lundi-vendredi 9h-18h, **Then** Sophie apparaît dans l'agenda et est proposée pour les réservations.
3. **Given** un praticien en congé le 15 avril, **When** un client demande un RDV avec ce praticien le 15 avril, **Then** l'IA indique l'indisponibilité et propose un autre praticien ou une autre date.

---

### User Story 4 — Paiements, Pourboires & Facturation (Priority: P4)

Le client peut payer sa prestation et laisser un pourboire nominatif à son praticien. Le commerçant est payé via Stripe Connect. Les pourboires sont attribués nommément au praticien concerné et visibles dans le dashboard. Le commerçant peut souscrire à son abonnement Plan (pricing par siège) et gérer sa facturation.

**Why this priority**: Le paiement est essentiel pour la monétisation mais peut être ajouté après le flux de réservation de base.

**Independent Test**: Simuler un paiement client, vérifier que le montant arrive sur le compte Stripe Connect du commerçant, et que le pourboire est attribué au bon praticien.

**Acceptance Scenarios**:

1. **Given** un RDV terminé, **When** le client reçoit un lien de paiement, **Then** il peut payer le montant de la prestation et optionnellement ajouter un pourboire en nommant le praticien.
2. **Given** un pourboire envoyé à "Marc", **When** le commerçant consulte le dashboard Statistiques, **Then** il voit le cumul des pourboires de Marc.
3. **Given** un commerçant avec 3 praticiens, **When** il souscrit à l'abonnement, **Then** le prix est calculé à 3 sièges selon la grille tarifaire (26,90€/mois).

---

### User Story 5 — Fidélité, Forfaits & Abonnements Client (Priority: P5)

Le commerçant crée des programmes de fidélité (points par visite ou par euro dépensé, paliers Bronze/Silver/Gold), des forfaits prépayés (ex : "5 coupes pour le prix de 4"), et des abonnements client (ex : "barbe illimitée 49€/mois"). Les forfaits se décomptent automatiquement à chaque visite. La fidélité se cumule et le client est informé de son palier.

**Why this priority**: Fonctionnalité de rétention et d'upsell — importante mais pas bloquante pour le MVP.

**Independent Test**: Créer un forfait "5 coupes", l'attribuer à un client, simuler 3 visites, et vérifier que le compteur affiche 2 restantes.

**Acceptance Scenarios**:

1. **Given** un programme fidélité actif (1 point/visite), **When** un client termine sa 10e visite, **Then** ses points sont mis à jour et il reçoit une notification s'il atteint un nouveau palier.
2. **Given** un client avec un forfait "5 coupes" (3 restantes), **When** il se présente pour une coupe, **Then** le forfait est automatiquement débité d'une unité.
3. **Given** un client abonné "barbe illimitée", **When** il réserve une barbe, **Then** aucun paiement supplémentaire n'est demandé et la visite est comptabilisée.

---

### User Story 6 — Répondeur Téléphonique IA (Priority: P6)

En option payante, le commerçant active un répondeur téléphonique IA. Quand un client appelle, l'IA décroche, comprend la demande vocalement, et gère la réservation par téléphone exactement comme par messagerie. L'appel est transcrit et visible dans la page Messages.

**Why this priority**: Option premium à forte valeur ajoutée, mais nécessite l'intégration voix — complexité plus élevée.

**Independent Test**: Appeler le numéro dédié du salon, formuler une demande de RDV à voix haute, et vérifier que le RDV est créé et la transcription visible.

**Acceptance Scenarios**:

1. **Given** un salon avec l'option téléphone activée, **When** un client appelle et dit "Je voudrais un RDV coupe demain matin", **Then** l'IA vocale propose les créneaux disponibles et confirme oralement.
2. **Given** un appel terminé, **When** le commerçant consulte la page Messages, **Then** il voit la transcription complète de l'appel et le RDV créé.
3. **Given** un salon sans l'option téléphone, **When** un client appelle, **Then** un message d'accueil standard invite à utiliser WhatsApp/SMS.

---

### User Story 7 — Statistiques & Avis Google (Priority: P7)

Le commerçant consulte ses statistiques : nombre de RDV, taux de remplissage, chiffre d'affaires, performance par praticien, pourboires cumulés. Après chaque prestation, le système envoie automatiquement une demande d'avis Google au client.

**Why this priority**: Les statistiques et avis sont des fonctionnalités de valeur ajoutée qui renforcent l'adoption mais ne sont pas nécessaires au fonctionnement de base.

**Independent Test**: Consulter la page Statistiques avec des données de test et vérifier que les métriques affichées correspondent aux RDV enregistrés.

**Acceptance Scenarios**:

1. **Given** un commerçant avec 50 RDV ce mois, **When** il ouvre la page Statistiques, **Then** il voit le nombre de RDV, le CA, le taux de remplissage et la répartition par praticien.
2. **Given** un RDV terminé, **When** 2 heures se sont écoulées, **Then** le client reçoit un message avec un lien vers la page avis Google du salon.

---

### Edge Cases

- Que se passe-t-il si un client envoie un message ambigu ou hors sujet (ex : "C'est combien ?") ? L'IA DOIT demander des précisions ou orienter vers le catalogue.
- Que se passe-t-il si deux clients réservent le même créneau simultanément ? Le système DOIT gérer la concurrence et attribuer le créneau au premier confirmé, puis proposer une alternative au second.
- Que se passe-t-il si le commerçant modifie un RDV déjà confirmé ? Le client DOIT recevoir une notification de modification sur le canal d'origine.
- Que se passe-t-il si Stripe est indisponible au moment du paiement ? Le système DOIT afficher un message d'erreur clair et permettre une nouvelle tentative.
- Que se passe-t-il si le client change de numéro de téléphone ? Le système DOIT permettre au commerçant de mettre à jour le contact sans perdre l'historique.
- Que se passe-t-il si un forfait expire avant d'être entièrement utilisé ? Le système DOIT notifier le client avant expiration et le commerçant DOIT pouvoir configurer la politique d'expiration.
- Que se passe-t-il si un client accumule des no-shows ? Le commerçant marque manuellement le no-show, le client reçoit une notification. Après 3 no-shows, le client est automatiquement bloqué pour la réservation via IA (il peut toujours réserver via le commerçant directement).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT recevoir et interpréter les messages clients via WhatsApp, Messenger, Telegram et SMS.
- **FR-002**: Le système DOIT utiliser l'historique du client (praticien habituel, service habituel, fréquence) pour pré-remplir les informations de réservation.
- **FR-003**: Le système DOIT vérifier les disponibilités en temps réel (praticien, créneau, service) avant de proposer un RDV.
- **FR-004**: Le système DOIT envoyer une confirmation de RDV au client sur le canal d'origine.
- **FR-005**: Le système DOIT envoyer des rappels automatiques avant chaque RDV (24h et 1h par défaut, configurable).
- **FR-006**: Le dashboard DOIT afficher 6 pages : Agenda, Clients, Messages, Services, Statistiques, Paramètres.
- **FR-007**: L'agenda DOIT supporter les vues jour, semaine et mois avec répartition par praticien et couleurs distinctes.
- **FR-008**: Le système DOIT permettre la création, modification et annulation de RDV depuis le dashboard.
- **FR-009**: Le système DOIT isoler les données de chaque commerçant — aucun commerçant ne DOIT pouvoir accéder aux données d'un autre.
- **FR-010**: Le système DOIT gérer les paiements via Stripe Connect, avec répartition automatique vers le compte du commerçant.
- **FR-011**: Le système DOIT permettre les pourboires nominatifs attribués à un praticien spécifique.
- **FR-012**: Le système DOIT supporter les forfaits prépayés avec décompte automatique à chaque utilisation.
- **FR-013**: Le système DOIT supporter les abonnements clients récurrents via Stripe Subscriptions.
- **FR-014**: Le système DOIT supporter un programme de fidélité avec points et paliers (Bronze, Silver, Gold).
- **FR-015**: Le système DOIT permettre l'activation optionnelle d'un répondeur téléphonique IA avec transcription automatique.
- **FR-016**: Le système DOIT facturer l'abonnement commerçant par nombre de sièges (praticiens), dès 16,90€/mois pour 1 siège.
- **FR-017**: Le système DOIT afficher des statistiques : nombre de RDV, CA, taux de remplissage, performance par praticien, pourboires.
- **FR-018**: Le système DOIT envoyer une demande d'avis Google automatique après chaque prestation.
- **FR-019**: Le système DOIT fournir un site de réservation public avec URL personnalisable et QR code pour chaque salon.
- **FR-020**: Le système DOIT gérer la concurrence d'accès aux créneaux (deux réservations simultanées sur le même créneau).
- **FR-021**: Le système DOIT permettre au commerçant de marquer un RDV comme no-show et notifier le client automatiquement.
- **FR-022**: Le système DOIT bloquer automatiquement la réservation via IA pour un client ayant cumulé 3 no-shows (réservation manuelle par le commerçant toujours possible).
- **FR-023**: Le système DOIT supporter le multilingue configurable — le commerçant choisit les langues supportées par son IA, et l'IA converse dans la langue sélectionnée par le client parmi celles activées.
- **FR-024**: Le système DOIT permettre au client d'annuler son RDV via messagerie IA, sous réserve d'un délai minimum configurable par le commerçant. Au-delà du délai, l'IA DOIT refuser l'annulation et inviter le client à contacter le salon directement.

### Key Entities

- **Commerçant (Merchant)** : Propriétaire du salon. Détient un abonnement, un ou plusieurs praticiens, un catalogue de services. Toutes les données lui sont rattachées.
- **Praticien (Practitioner)** : Employé du salon. Possède un planning, des spécialités, des horaires propres. Reçoit des pourboires nominatifs.
- **Client** : Personne qui réserve. Possède un historique de visites, des préférences (praticien, service), des points de fidélité, des forfaits/abonnements.
- **Service** : Prestation proposée (nom, durée, prix). Associé à un ou plusieurs praticiens compétents.
- **Réservation (Booking)** : Créneau réservé liant un client, un praticien, un service, une date/heure. Cycle de vie à 6 états : en attente → confirmé → en cours → terminé, annulé, no-show.
- **Conversation** : Échange IA avec un client sur un canal donné. Contient l'historique des messages et la transcription des appels.
- **Pourboire (Tip)** : Montant attribué nommément à un praticien par un client, lié à une visite.
- **Forfait (Package)** : Pack prépayé créé par le commerçant (ex : "5 coupes"). Suivi du nombre d'utilisations restantes par client.
- **Abonnement Client** : Souscription récurrente d'un client (ex : "barbe illimitée"). Géré via paiement récurrent.
- **Programme Fidélité** : Règles de cumul de points et paliers définis par le commerçant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un client DOIT pouvoir compléter une réservation via messagerie en moins de 2 minutes (3 échanges maximum avec l'IA).
- **SC-002**: 90% des demandes de réservation claires DOIVENT aboutir à un RDV confirmé sans intervention humaine.
- **SC-003**: Le commerçant DOIT pouvoir créer un RDV manuellement en moins de 30 secondes depuis l'agenda.
- **SC-004**: Le système DOIT supporter 500 commerçants simultanés sans dégradation perceptible de l'interface.
- **SC-005**: Les données d'un commerçant NE DOIVENT JAMAIS être accessibles par un autre commerçant (0 fuite de données cross-tenant).
- **SC-006**: 80% des commerçants DOIVENT compléter la configuration initiale (services + praticiens + horaires) en moins de 15 minutes.
- **SC-007**: Le taux d'envoi de demandes d'avis Google DOIT atteindre 95% des prestations terminées.
- **SC-008**: Les pourboires DOIVENT être attribués au bon praticien dans 100% des cas.

## Assumptions

- Les commerçants cibles sont des TPE (1 à 7 praticiens) dans le secteur de la beauté et du bien-être en France.
- Les clients finaux ont accès à au moins un canal de messagerie (WhatsApp, Messenger, Telegram ou SMS).
- Le commerçant dispose d'une connexion internet stable pour accéder au dashboard.
- L'onboarding commerçant (création de compte, configuration initiale) est guidé mais ne nécessite pas d'assistance humaine.
- L'authentification commerçant se fait exclusivement par Magic Link (lien envoyé par email, sans mot de passe).
- Les paiements sont en euros (€) — le multi-devise est hors scope pour la v1.
- L'intégration Telegram est traitée au même niveau que WhatsApp/Messenger/SMS comme canal de messagerie.
- Le programme Early Adopter (-30% à vie pour les 50 premiers) est géré via Stripe Coupons.
- Les rappels de RDV sont envoyés sur le canal de messagerie d'origine du client.
