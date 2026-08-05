# Phase 3D — Observabilité NAS Synology

## Objectif

Remplacer l’écran NAS de préparation par une vue réellement alimentée par DSM, sans exposer d’opération destructive ni de secret au navigateur.

## Périmètre

- découverte des API disponibles via `SYNO.API.Info` ;
- authentification serveur via `SYNO.API.Auth` avec session dédiée VestyHub ;
- lecture de l’identité du NAS, de DSM, de l’uptime et de la température lorsqu’ils sont exposés ;
- lecture des volumes, groupes de stockage et disques lorsque les API sont disponibles ;
- lecture de l’utilisation CPU, mémoire, stockage et réseau lorsque DSM l’expose ;
- vue `/nas` thématisée et responsive ;
- API authentifiée `/api/nas/overview` ;
- état partiel explicite lorsque certaines API DSM ne sont pas disponibles ;
- cache serveur court, timeout, limite de taille et déconnexion de session en `finally` ;
- aucune donnée fictive.

## Contraintes de sécurité

- URL DSM fournie uniquement par l’environnement serveur ;
- protocoles autorisés : HTTP et HTTPS ;
- aucune URL arbitraire reçue du navigateur ;
- aucune valeur de mot de passe, SID ou SynoToken dans les réponses, journaux ou erreurs publiques ;
- authentification envoyée en corps `application/x-www-form-urlencoded`, pas dans l’URL ;
- catalogue fermé d’API et de méthodes de lecture ;
- aucune méthode de création, modification, arrêt, redémarrage, suppression ou mise à jour ;
- déconnexion DSM tentée même en cas d’échec partiel ;
- TLS vérifié par défaut ;
- CA privée optionnelle côté serveur ;
- désactivation de la vérification TLS visible comme avertissement de sécurité.

## Modes

### `dsm-api`

DSM fournit l’identité, le stockage et les métriques disponibles.

### `prometheus`

La page NAS utilise uniquement les métriques Prometheus déjà configurées. Ce mode ne doit être utilisé que lorsque les exporters observent réellement le NAS.

### `hybrid`

DSM fournit l’identité et le stockage ; Prometheus peut compléter les métriques d’utilisation absentes. Le déploiement doit garantir que Prometheus observe bien le NAS avant d’activer ce mode.

## Validation attendue

- connexion réelle au DS920+ ;
- découverte des API sans fuite de secret ;
- compte DSM dédié et limité ;
- affichage du modèle, de DSM et de l’uptime ;
- affichage des volumes et disques réellement retournés ;
- comportement propre avec identifiants invalides ;
- comportement propre avec une API DSM absente ;
- comportement propre avec certificat non approuvé ;
- aucune session DSM abandonnée volontairement ;
- CI complète verte ;
- validation visuelle dans les cinq thèmes.
