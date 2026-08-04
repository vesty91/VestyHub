# Développement

## Installation

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

## Contrôle qualité

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```

Le script agrégé est :

```bash
pnpm check
```

## Tests E2E

Localement, Playwright lance `pnpm dev` :

```bash
pnpm test:e2e
```

En CI ou pour tester le build de production :

```bash
pnpm test:e2e:ci
```

## Base de données

Après modification d’un schéma Drizzle :

```bash
pnpm db:generate
pnpm db:migrate
```

Ne jamais modifier une migration déjà appliquée en production. Générer une migration supplémentaire.

## Conventions

- TypeScript strict ; aucun `any`, `@ts-ignore` ou désactivation de test pour masquer une erreur.
- Validation Zod côté serveur aux frontières d’entrée.
- Composants serveur par défaut ; composant client uniquement lorsque nécessaire.
- Conventional Commits et hooks Husky/lint-staged.
- Aucun secret dans le dépôt, les fixtures ou les snapshots.

## Branche recommandée

```bash
git switch -c fix/phase1-foundation-hardening
```

L’archive de travail reçue ne contenait pas l’historique `.git`. Lors d’une réintégration dans le dépôt réel, créer la branche dans le dépôt original avant de remplacer les fichiers.

## Phase 2

Validation complète :

```bash
./scripts/validate-phase2.sh
```

Sur Windows :

```powershell
.\scripts\validate-phase2.ps1
```

Les modules marqués `use server` ne doivent exporter que des fonctions asynchrones. Les types et états initiaux des formulaires sont conservés dans des fichiers `state.ts` distincts.
