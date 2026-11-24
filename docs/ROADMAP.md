# VestyHub — feuille de route de livraison

> Source de vérité pour les travaux futurs. Les points « à valider » ne sont **pas**
> des fonctionnalités livrées. Réviser cette feuille de route après chaque PR.

## Objectif et périmètre

Construire un centre de contrôle homelab utilisable, sécurisé et maintenable,
avec PostgreSQL, dashboards et favoris, connecteurs Docker / Synology / monitoring
en lecture seule et supervision locale de développement.

**Priorités invariables :** préserver les données ; n'ajouter aucun accès
d'administration dangereux par défaut ; valider tout changement avant déploiement.

## État du code et des PR

La branche `main` n'inclut **pas** automatiquement les changements en brouillon.
Les travaux actuels forment une pile de PR dépendantes :

| PR                                                 | Branche                             | Sujet                                                | Dépend de |
| -------------------------------------------------- | ----------------------------------- | ---------------------------------------------------- | --------- |
| [#20](https://github.com/vesty91/VestyHub/pull/20) | `fix/security-hardening-2026-11-15` | Durcissement NAS, permissions, contrôle Docker et CI | `main`    |
| [#21](https://github.com/vesty91/VestyHub/pull/21) | `feat/windows-local-development`    | Environnement PostgreSQL Windows local isolé         | #20       |
| [#22](https://github.com/vesty91/VestyHub/pull/22) | `feat/dashboard-local-health`       | Diagnostic des services et page d'erreur             | #21       |
| [#23](https://github.com/vesty91/VestyHub/pull/23) | `feat/dashboard-local-v2`           | CPU, RAM, disques et services Windows                | #22       |
| [#24](https://github.com/vesty91/VestyHub/pull/24) | `feat/windows-process-supervision`  | Top 5 des processus Windows par RAM                  | #23       |

**Ne fusionner aucune de ces PR dans le désordre.** Les PR restent en brouillon
tant que les prérequis d'intégration et de production ne sont pas remplis.

## Jalons prioritaires

### P0 — fiabilité et préparation à la livraison

- [x] Développement Windows sur PostgreSQL isolé, ports loopback, secrets locaux.
- [x] Tests Vitest, ESLint, Prettier, TypeScript et build automatisés sur GitHub.
- [x] Vérification syntaxique des Compose NAS et locaux par CI.
- [x] Supervision Windows locale CPU/RAM/disques et processus en lecture seule.
- [x] **Tests E2E CI sur PostgreSQL jetable** : migrations, comptes fictifs ADMIN/USER/VIEWER,
      connexion, isolation des favoris, permissions d’édition et dashboard en desktop/mobile.
      Les rôles sont testés par navigateur et par API sans utiliser les bases réelles.
- [ ] **Relecture sécurité API** : permissions sur chaque route, limites de requêtes,
      erreurs non bavardes, protections SSRF sur les healthchecks externes.
- [ ] **Gestion des indisponibilités** : circuit breaker isolé par connecteur
      pour Docker NAS, DSM et Prometheus/Loki/Alertmanager (3 échecs, 30 s,
      reprise avec sonde unique) ; délais totaux DSM, Docker NAS et monitoring
      vérifiés sur réponses HTTP fragmentées. La résilience PostgreSQL est
      vérifiée sur base Docker jetable (panne réelle, reprise et conservation
      d'une donnée), complétée par un scénario Chromium de reconnexion à une
      session existante ; reste la validation staging NAS.
- [ ] **Contrôle dépendances** : audit des bibliothèques runtime, analyse de licences
      et plan de patch avec mise à jour testée. Ne pas appliquer une mise à jour
      majeure sans tests.
- [ ] **Sauvegarde/restauration PostgreSQL** : exercice reproductible sur volume
      de test distinct ; checksum et vérification du compte restauré.
- [ ] **Bilan de configuration** : HTTPS, proxy, variables et secrets revus avant
      tout déploiement sur le NAS.

### P1 — expérience homelab utile

- [ ] **Dashboard responsive final** : revue visuelle desktop/tablette/mobile,
      recadrage GridStack et accessibilité au clavier.
- [x] **Historique local léger** : graphique CPU/RAM sur 5 minutes en mémoire de l'onglet,
      sans nouvelle base ni collecteur permanent. Les relevés disque sont des valeurs
      instantanées ; un historique des disques reste optionnel.
- [x] **Alertes locales non intrusives** : seuils CPU/RAM réglables (session navigateur),
      confirmation sur deux relevés distincts et réarmement avec hystérésis. Aucun service
      ne peut être arrêté par cette fonctionnalité.
- [ ] **Alertes NAS futures** : définir une gestion explicite des services désactivés
      et des cibles réellement indisponibles, à valider sur staging Synology.
- [ ] **Favoris robustes** : Playwright CI couvre le CRUD de favoris et les permissions
      inter-utilisateurs ; compléter avec les URL malformées, les raccourcis et l’accessibilité.
- [ ] **Recherche et navigation** : validation ergonomique des pages Dashboard,
      Applications, Docker, NAS, Monitoring et Paramètres.
- [ ] **Documentation opérateur** : démarrage Windows, récupération de mot de
      passe, diagnostics, gestion des erreurs, journaux, sauvegardes.
- [ ] **Connecteurs** : distinction « non configuré » / panne implémentée
      pour Prometheus, Loki, Alertmanager et Docker NAS, avec tests ;
      compléter les contrats d'erreur, timeouts, réponses partielles et
      l'inspection en staging, sans exposer de secrets au navigateur.

### P2 — intégration Synology (bloquée sans NAS accessible)

- [ ] Relever l'état réel du NAS et des volumes, sans modifier les données.
- [ ] Confirmer la topologie Nginx Proxy Manager / reverse proxy et le binding
      loopback avant tout changement de `VESTYHUB_BIND_IP`.
- [ ] Créer un **staging isolé** avec PostgreSQL et volumes distincts.
- [ ] Vérifier TLS/DSM, SNMPv3, proxy Docker lecture seule et monitoring
      Prometheus/Loki/Alertmanager sur les vraies cibles.
- [ ] Tester migrations, healthchecks, redémarrage, sauvegarde, restauration
      et retour arrière, avec contrôle explicite avant passage en production.
- [ ] Soumettre la mise en production à une décision humaine après tests.

## Définition de « prêt pour la production »

Les conditions suivantes doivent **toutes** être vraies :

1. Tests statiques, unitaires et E2E CI réussis sur le commit ciblé.
2. Au moins un test staging NAS reproductible, avec captures des résultats.
3. Exercice de sauvegarde/restauration réalisé hors données de production.
4. Analyse de sécurité : rôles et routes, cookies/sessions, secrets, SSRF,
   exposition Docker, réseau, TLS et logs vérifiés.
5. Écrans et flux critiques vérifiés pour desktop et mobile, en mode disponible
   et indisponible.
6. Procédure de déploiement et rollback écrite, appliquée au staging, avec
   risques explicites.
7. Approbation explicite avant fusion dans `main` et avant intervention NAS.

**Aucune PR verte ne remplace à elle seule les tests réels de staging.**

## Validation immédiate sur le PC Windows

```bat
cd /d D:\Dev\VestyHub
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
curl.exe -fsS http://127.0.0.1:3200/api/health/ready
docker compose --env-file .env.local -f compose.local.yml ps
```

Les nouveaux endpoints de diagnostic Windows sont réservés aux sessions
authentifiées et désactivés hors développement Windows.

## Règles de continuation

À chaque nouvelle session de développement :

1. Vérifier GitHub, les PR ouvertes, le HEAD et les CI avant de modifier le code.
2. Privilégier **une seule amélioration bornée et testable** par branche.
3. Tester localement, puis confirmer GitHub Actions ; conserver la PR en brouillon.
4. Ne jamais modifier `.env.local`, les volumes d'autres projets, la production NAS
   ou les services Docker tiers sans nécessité et autorisation explicite.
5. Mettre à jour les statuts ci-dessus ; ne pas marquer une fonctionnalité livrée
   sur la seule base de l'intention ou d'une maquette.
