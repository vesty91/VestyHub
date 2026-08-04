# Validation Phase 2

## Qualité locale

```powershell
.\scripts\validate-phase2.ps1
```

Résultats obligatoires :

- `pnpm format:check` : zéro fichier non formaté ;
- `pnpm lint` : zéro erreur ;
- `pnpm typecheck` : zéro erreur ;
- `pnpm test:unit` : tous les tests réussis ;
- `pnpm build` : build Next.js réussi ;
- `docker compose config --quiet` : configuration valide.

## Intégration Docker

```powershell
docker compose build --no-cache
docker compose up -d --remove-orphans
docker compose ps -a
```

Créer ensuite le compte :

```powershell
docker compose --profile seed run --rm seed
```

Contrôles manuels :

1. `/` redirige vers `/login` sans session.
2. Le compte de seed peut se connecter.
3. `/dashboard` affiche les widgets et les données Docker.
4. Un favori peut être créé, modifié, épinglé puis supprimé.
5. La déconnexion supprime la session active.
6. Le proxy Docker reste en lecture seule.

## Vérification du proxy

```powershell
docker compose config | Select-String -Pattern "POST:|ALLOW_START:|ALLOW_STOP:|ALLOW_RESTARTS:"
```

Toutes les valeurs doivent rester à `0`.
