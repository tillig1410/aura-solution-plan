# Migration du projet vers un autre disque

Procédure safe pour déplacer/renommer le projet sans rien casser.
**Principe : copier d'abord, supprimer après — on ne touche aux originaux que quand tout marche.**

---

## Avant de commencer

1. **Fermer cette session Claude Code** (Ctrl+C ou `/exit`).
2. **Vérifier que git est propre** :
   ```powershell
   cd C:\Users\User\.Plan
   git status
   ```
   Doit afficher `nothing to commit, working tree clean`. Si non : commit ou stash avant.
3. **Vérifier que tout est pushé** :
   ```powershell
   git log origin/main..HEAD
   ```
   Doit ne rien afficher (= aucun commit local en avance sur GitHub).

---

## Variables à personnaliser

Dans les commandes ci-dessous, remplace ces 2 valeurs par tes choix :

| Variable | Exemple | Description |
|---|---|---|
| `$NewPath` | `D:\Projects\aura-solutions` | Le nouveau chemin du projet |
| `$NewMemoryName` | `D--Projects-aura-solutions` | Le nom du dossier mémoire correspondant (voir règle ci-dessous) |

**Règle de conversion du nom mémoire :** Claude Code transforme le chemin du projet en remplaçant `:`, `\`, `/` par des `-`.
- `C:\Users\User\.Plan` devient `C--Users-User--Plan`
- `D:\Projects\aura-solutions` devient `D--Projects-aura-solutions`
- `E:\dev\plan` devient `E--dev-plan`

---

## Étape 1 — Backup de la mémoire (filet de sécurité)

C'est la SEULE chose qui n'est pas dans git. Si tu rates tout le reste, tu peux la remettre.

```powershell
Copy-Item -Recurse `
  "C:\Users\User\.claude\projects\C--Users-User--Plan" `
  "C:\Users\User\Desktop\backup-memory-plan-$(Get-Date -Format 'yyyy-MM-dd')"
```

Vérifie que le dossier de backup existe sur le Bureau avant de continuer.

---

## Étape 2 — Vérifier le filet git (déjà en place)

Le code source vit sur GitHub : https://github.com/tillig1410/aura-solution-plan

En cas de catastrophe totale, tu peux toujours recloner :
```powershell
git clone https://github.com/tillig1410/aura-solution-plan.git
```
Tu perdras les `node_modules`, le `.env.local`, et le dossier `.next`, mais tout le code et la config tracée seront récupérés.

---

## Étape 3 — COPIER (pas déplacer) le projet vers le nouveau disque

```powershell
# Adapter le chemin de destination
$NewPath = "D:\Projects\aura-solutions"

# Créer le dossier parent si besoin
New-Item -ItemType Directory -Force -Path (Split-Path $NewPath -Parent) | Out-Null

# Copier le projet
Copy-Item -Recurse "C:\Users\User\.Plan" $NewPath

# Vérifier que la copie a marché
Test-Path "$NewPath\package.json"
Test-Path "$NewPath\.git"
```

Les deux `Test-Path` doivent retourner `True`.

À ce stade tu as **les deux versions du projet en parallèle**. Aucun risque, l'original n'a pas bougé.

---

## Étape 4 — Copier le dossier mémoire vers son nouveau nom

```powershell
# Adapter le nom mémoire (voir règle de conversion plus haut)
$NewMemoryName = "D--Projects-aura-solutions"

Copy-Item -Recurse `
  "C:\Users\User\.claude\projects\C--Users-User--Plan" `
  "C:\Users\User\.claude\projects\$NewMemoryName"

# Vérifier
Test-Path "C:\Users\User\.claude\projects\$NewMemoryName\memory\MEMORY.md"
```

Doit retourner `True`. Si non, vérifie le nom mémoire (règle de conversion).

---

## Étape 5 — Tester la nouvelle copie

1. Ouvrir un terminal dans le nouveau path :
   ```powershell
   cd D:\Projects\aura-solutions
   ```
2. Lancer Claude Code (commande habituelle, ex : `claude` ou raccourci).
3. Demander à Claude : "qu'est-ce que tu sais sur le projet ?" — il devrait charger la mémoire et te répondre avec les infos sur Resaapp, AurA, n8n, etc.
4. Vérifier git :
   ```powershell
   git status
   git log --oneline -5
   ```
5. Vérifier que le code build :
   ```powershell
   npm install   # uniquement si node_modules n'a pas été copié
   npm run build
   ```
6. Si tout marche : passer à l'étape 6. Si quelque chose casse : passer à l'étape 7.

---

## Étape 6 — Si tout marche : nettoyer les originaux

**Et seulement quand tu es 100% sûr que la nouvelle version marche.**

```powershell
# Supprimer l'ancien projet
Remove-Item -Recurse -Force "C:\Users\User\.Plan"

# Supprimer l'ancien dossier mémoire
Remove-Item -Recurse -Force "C:\Users\User\.claude\projects\C--Users-User--Plan"
```

Garde le backup du Desktop encore quelques jours, au cas où.

---

## Étape 7 — Si ça casse

Tu n'as touché à rien d'original. Procédure :

1. Ferme la session Claude qui plante dans le nouveau path.
2. Supprime la nouvelle copie ratée :
   ```powershell
   Remove-Item -Recurse -Force "D:\Projects\aura-solutions"
   Remove-Item -Recurse -Force "C:\Users\User\.claude\projects\D--Projects-aura-solutions"
   ```
3. Retourne sur l'ancien :
   ```powershell
   cd C:\Users\User\.Plan
   claude
   ```
4. Tout doit être comme avant. Lance une session et explique à Claude ce qui a échoué.

---

## Étape bonus — Mettre à jour `.claude/settings.local.json`

Après le déplacement réussi, ce fichier contient une référence à l'ancien path mémoire (dans une permission Bash). Pas critique, mais à updater.

Ouvrir le fichier et remplacer :
```
C:/Users/User/.claude/projects/C--Users-User--Plan/
```
par le nouveau chemin mémoire (avec slashes forward).

Puis commit :
```powershell
git add .claude/settings.local.json
git commit -m "chore: update settings path after project relocation"
git push
```

---

## Tu peux aussi y aller par étapes

Aucune urgence à tout faire d'un coup :

- **Aujourd'hui** : seulement l'étape 1 (backup mémoire). Zéro risque.
- **Plus tard** : étapes 3 + 4 (copies) quand tu te sens prêt. Toujours zéro risque, les originaux restent.
- **Encore plus tard** : étape 5 (test).
- **Quand tu es sûr** : étape 6 (suppression).

Tu peux laisser les deux versions cohabiter pendant des semaines. Aucun problème.

---

## Ce qui n'est PAS affecté par le déplacement

- Git (le repo est self-contained)
- GitHub (distant)
- Vercel (déploie depuis GitHub, `project.json` utilise des IDs)
- n8n workflows (vivent sur le VPS)
- Supabase (distant)
- CLAUDE.md (sera lu automatiquement depuis le nouveau path)
- Le code applicatif (aucun chemin absolu hardcodé)

## Ce qui EST affecté

- La working directory de Claude Code (relancer depuis le nouveau path)
- Le dossier mémoire de Claude (à renommer en parallèle pour préserver l'historique)
- `.claude/settings.local.json` (1 permission avec l'ancien path — à mettre à jour, optionnel)
