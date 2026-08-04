# Validation Phase 2.1

## Contrôles effectués lors de la préparation

- syntaxe TypeScript/TSX sur l’ensemble du dépôt ;
- vérification sémantique isolée du registre et du sélecteur d’icônes ;
- validation JSON et YAML ;
- 86 choix d’icônes uniques dans 11 catégories ;
- vérification de la présence des icônes de téléchargement et de transfert ;
- absence de `.env`, `.env.local`, clés privées, `.next`, `node_modules` et `.git` dans l’archive ;
- aucune migration PostgreSQL et aucune dépendance supplémentaire.

## Validation complète à exécuter sur la machine cible

```powershell
pnpm install --frozen-lockfile
pnpm format
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```

Ou avec le script existant :

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\validate-phase2.ps1
```

Le déploiement ne doit être lancé que lorsque toutes les étapes sont validées.
