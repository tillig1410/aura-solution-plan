# Guide Claude Code — Raccourcis, Modes, Astuces & Configuration

> Référence rapide pour utiliser Claude Code efficacement dans VS Code et en CLI.

---

## 3. Raccourcis essentiels

### Dans VS Code

| Raccourci | Action |
|---|---|
| `Cmd+Shift+P` / `Ctrl+Shift+P` | Ouvrir la palette de commandes (taper "Claude Code") |
| `Cmd+Esc` / `Ctrl+Esc` | Basculer entre l'éditeur et le prompt Claude |
| `Shift+Tab` | Cycler entre les modes : Normal → Auto-accept → Plan |
| `Alt+T` / `Option+T` | Activer/désactiver le mode **Extended Thinking** (raisonnement visible) |
| `Alt+P` / `Option+P` | Sélection rapide du modèle (Opus, Sonnet, Haiku) |
| `Escape` | Annuler la génération en cours |
| `@fichier` | Mentionner un fichier spécifique dans le prompt |
| `@fichier:10-50` | Mentionner un fichier avec une plage de lignes |

### Dans le terminal (CLI)

| Raccourci | Action |
|---|---|
| `Tab` | Autocomplétion des commandes |
| `Ctrl+C` | Interrompre la génération |
| `Ctrl+D` | Quitter Claude Code |
| `↑` / `↓` | Naviguer dans l'historique des prompts |

---

## 4. Modes utiles

### Mode Normal (par défaut)
Claude demande confirmation avant chaque action (écriture fichier, commande bash, etc.). C'est le mode le plus sûr pour débuter.

### Mode Auto-accept
Claude applique les modifications **sans demander de confirmation**. Idéal pour les tâches répétitives où tu fais confiance au contexte. Active avec `Shift+Tab` ou dans les paramètres.

> **Attention** : en mode auto-accept, Claude exécutera les commandes bash et écrira les fichiers automatiquement.

### Mode Plan
Claude **analyse et planifie** avant d'agir. Il propose un plan d'action détaillé que tu peux revoir et valider étape par étape avant l'exécution. Parfait pour les tâches complexes ou sensibles.

### Mode Extended Thinking (`Alt+T`)
Claude affiche son **raisonnement interne** étape par étape. Utile pour comprendre sa logique sur des problèmes complexes ou pour débugger son approche.

### Mode Fast
Même modèle Opus 4.6 mais avec des paramètres API optimisés pour la vitesse. Idéal pour l'itération rapide et le débogage en direct.

---

## 5. Commandes slash (toutes)

### Commandes essentielles

| Commande | Description |
|---|---|
| `/help` | Affiche toutes les commandes disponibles (y compris customs) |
| `/init` | Initialise le projet avec un fichier `CLAUDE.md` |
| `/clear` | Efface l'historique de conversation (utilise souvent !) |
| `/compact` | Compacte le contexte en gardant les infos essentielles |
| `/compact [sujet]` | Compacte en priorisant un sujet spécifique |
| `/cost` | Affiche le coût de la session (tokens entrée/sortie, montant) |
| `/model` | Changer de modèle (Opus, Sonnet, Haiku) |

### Commandes de gestion

| Commande | Description |
|---|---|
| `/login` | Se connecter / changer de compte Anthropic |
| `/logout` | Se déconnecter |
| `/doctor` | Diagnostic de l'installation (santé de Claude Code) |
| `/review` | Lancer une revue de code |
| `/install-github-app` | Installer l'app GitHub pour review automatique de PR |
| `/permissions` | Gérer les permissions (commandes autorisées sans confirmation) |
| `/hooks` | Interface interactive pour configurer les hooks |
| `/keybindings` | Personnaliser les raccourcis clavier |

### Commandes customs
Tu peux créer tes propres commandes dans :
- **Projet** : `.claude/commands/ma-commande.md`
- **Global** : `~/.claude/commands/ma-commande.md`

Elles apparaîtront automatiquement dans `/help`.

---

## 6. Astuces

### Gestion du contexte
- **`/clear` souvent** : à chaque nouveau sujet, efface le chat. L'historique consomme des tokens et ralentit Claude.
- **`/compact` à 80%** : quand l'utilisation du contexte dépasse 80%, compacte plutôt que de continuer.
- **Sois spécifique** : plutôt que "corrige le bug", dis "corrige le bug de validation email dans `src/auth/login.ts` ligne 45".

### Mentions de fichiers
- Utilise `@fichier.ts` pour inclure un fichier dans le contexte.
- Utilise `@fichier.ts:10-50` pour cibler des lignes précises.
- Tu peux mentionner **plusieurs fichiers** dans un même prompt.

### Workflow efficace
1. Commence toujours par `/init` sur un nouveau projet.
2. Rédige un bon `CLAUDE.md` avec le contexte projet, la stack, les conventions.
3. Utilise le **mode Plan** pour les features complexes.
4. Utilise le **mode Auto-accept** pour le refactoring simple.
5. Fais un `/clear` entre chaque tâche distincte.

### Astuces CLI
- **Pipe d'entrée** : `cat fichier.ts | claude "explique ce code"`
- **Non-interactif** : `claude -p "génère un composant Button"` (exécute et quitte)
- **Continuer une session** : `claude --continue` reprend la dernière conversation
- **Résumé de session** : `claude --resume` pour choisir une session précédente

### Gain de temps
- Crée des **skills** (`.claude/skills/`) pour les tâches récurrentes (ex: créer un composant, lancer les tests).
- Configure les **permissions** pour éviter les confirmations répétitives sur les commandes sûres.
- Utilise les **hooks** pour le linting automatique plutôt que des instructions dans CLAUDE.md.

---

## 7. Configuration avancée

### Fichiers de configuration

| Fichier | Portée | Usage |
|---|---|---|
| `CLAUDE.md` (racine projet) | Projet | Instructions, contexte, conventions — partagé avec l'équipe |
| `.claude/settings.json` | Projet | Permissions, hooks, outils — partagé (versionné) |
| `.claude/settings.local.json` | Local | Surcharges personnelles (gitignored) |
| `~/.claude/settings.json` | Global | Config par défaut pour tous les projets |
| `~/.claude/CLAUDE.md` | Global | Instructions globales pour tous les projets |

**Priorité** : Managed > Local > Projet > Global

### Structure settings.json

```json
{
  "permissions": {
    "allow": [
      "Bash(npm test)",
      "Bash(npm run *)",
      "Bash(git *)",
      "Read",
      "Write"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force *)"
    ]
  },
  "hooks": {
    "afterWrite": [
      {
        "command": "npx eslint --fix $FILE",
        "description": "Auto-lint après écriture"
      }
    ],
    "afterCommit": [
      {
        "command": "npm test",
        "description": "Tests après chaque commit"
      }
    ]
  },
  "env": {
    "NODE_ENV": "development"
  }
}
```

### Permissions avec wildcards

```json
{
  "permissions": {
    "allow": [
      "Bash(npm *)",
      "Bash(npx *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)"
    ],
    "deny": [
      "Bash(rm -rf /)",
      "Bash(* --force *)"
    ]
  }
}
```

> Les règles **deny** sont évaluées en premier, puis **ask**, puis **allow**.

### Hooks (automatisations)

Les hooks s'exécutent de manière **déterministe** à des moments clés du cycle de vie :

| Hook | Déclencheur |
|---|---|
| `afterWrite` | Après l'écriture d'un fichier |
| `afterCommit` | Après un commit git |
| `beforeCommand` | Avant l'exécution d'une commande bash |
| `afterCommand` | Après l'exécution d'une commande bash |

Utilise `/hooks` pour les configurer interactivement.

### Fichiers ignorés

Dans `settings.json`, tu peux exclure des fichiers de la recherche et de la lecture :

```json
{
  "ignorePatterns": [
    "node_modules/**",
    ".env*",
    "*.lock",
    "dist/**"
  ]
}
```

### Skills (commandes personnalisées avancées)

Crée un fichier `.claude/skills/mon-skill/SKILL.md` :

```markdown
---
name: create-component
description: Crée un composant React avec tests et styles
autoInvoke: true
---

Quand on te demande de créer un composant :
1. Crée le fichier `.tsx` dans `src/components/`
2. Ajoute les tests dans `__tests__/`
3. Utilise Tailwind + shadcn/ui
4. Exporte depuis `index.ts`
```

### Variables d'environnement utiles

| Variable | Usage |
|---|---|
| `ANTHROPIC_API_KEY` | Clé API si tu utilises ton propre compte |
| `CLAUDE_CODE_MAX_TOKENS` | Limite de tokens par réponse |
| `SLASH_COMMAND_TOOL_CHAR_BUDGET` | Budget caractères pour les skills |
| `CLAUDE_CODE_USE_BEDROCK=1` | Utiliser AWS Bedrock comme provider |
| `CLAUDE_CODE_USE_VERTEX=1` | Utiliser Google Vertex comme provider |

---

## 8. Commandes CLI importantes

```bash
# Installation et mise à jour
npm install -g @anthropic-ai/claude-code    # Installer
npm update -g @anthropic-ai/claude-code     # Mettre à jour
claude --version                             # Vérifier la version

# Utilisation basique
claude                                       # Lancer en mode interactif
claude "ta question ici"                     # Question directe
claude -p "prompt"                           # Mode non-interactif (pipe-friendly)
claude --continue                            # Reprendre la dernière session
claude --resume                              # Choisir une session à reprendre

# Gestion de projet
claude /init                                 # Initialiser CLAUDE.md
claude /doctor                               # Vérifier la santé de l'installation

# Configuration
claude config set model claude-sonnet-4-6   # Changer le modèle par défaut
claude config list                           # Voir la config actuelle

# Intégration Git
claude /review                               # Revue de code
claude /install-github-app                   # Auto-review des PR GitHub
```

---

## Mémo rapide

```
Shift+Tab     → Cycler les modes (Normal / Auto / Plan)
Alt+T         → Extended Thinking ON/OFF
Alt+P         → Changer de modèle
/clear        → Nouveau sujet = nouveau chat
/compact      → Contexte plein ? Compacte !
/cost         → Combien ça coûte ?
/doctor       → Ça marche pas ? Diagnostique !
@fichier      → Inclure un fichier dans le prompt
```

---

*Guide créé le 28/03/2026 — Sources vérifiées sur la documentation officielle Claude Code.*
