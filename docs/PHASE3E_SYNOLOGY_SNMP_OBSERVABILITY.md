# Phase 3E — Observabilité Synology par SNMPv3

## Objectif

Compléter les données DSM accessibles au compte de service `vestyhub` sans lui accorder de privilèges administrateur. Les informations système restent collectées via DSM WebAPI ; les disques, volumes et états RAID sont collectés via SNMPv3, exposés à Prometheus par `snmp_exporter`, puis normalisés côté serveur par VestyHub.

## Architecture

```text
DSM WebAPI
├── identité et version DSM
├── disponibilité
├── CPU
└── mémoire

Synology SNMPv3 (UDP/161, authPriv)
└── snmp_exporter
    └── Prometheus job synology-snmp
        └── VestyHub mode hybrid
            ├── disques
            ├── températures
            ├── santé des disques
            ├── volumes
            └── groupes de stockage
```

Le conteneur `snmp-exporter` appartient à deux réseaux :

- `backend`, réseau interne utilisé par Prometheus ;
- `monitoring-egress`, réseau dédié permettant au collecteur SNMP de joindre le NAS sur le LAN.

Aucun port HTTP de `snmp-exporter` n’est publié sur l’hôte.

## Versions

- `prom/snmp-exporter:v0.30.1` ;
- module officiel `synology` fourni dans l’image ;
- authentification séparée dans `deploy/snmp-exporter/auth.yml`.

## Configuration DSM

Dans **Panneau de configuration → Terminal et SNMP → SNMP** :

1. activer le service SNMP ;
2. laisser SNMPv1 et SNMPv2c désactivés ;
3. activer SNMPv3 ;
4. créer l’identifiant dédié `vestyhub-snmp` ;
5. sélectionner le protocole d’authentification **SHA** ;
6. activer la confidentialité SNMP ;
7. sélectionner le protocole de confidentialité **AES** ;
8. utiliser deux mots de passe longs et distincts ;
9. appliquer la configuration.

Les mots de passe doivent respecter les contraintes DSM : 8 à 127 caractères, sans espace ni les caractères `"`, `'` ou `\`.

## Variables locales

```dotenv
SNMPV3_USERNAME=
SNMPV3_AUTH_PASSWORD=
SNMPV3_PRIV_PASSWORD=
```

Ces variables sont transmises uniquement au conteneur `snmp-exporter`. Elles ne sont pas transmises à l’application Next.js et ne doivent jamais être committées.

Pour activer la fusion DSM + SNMP dans VestyHub :

```dotenv
SYNOLOGY_ENABLED=true
SYNOLOGY_MODE=hybrid
PROMETHEUS_URL=http://prometheus:9090
```

## Cible

Le job Prometheus `synology-snmp` cible actuellement le NAS local :

```text
192.168.1.5:161/udp
```

La cible est définie dans `deploy/prometheus/prometheus.yml`. Le scrape HTTP s’effectue vers `snmp-exporter:9116`, qui agit comme proxy SNMP.

## Démarrage

```powershell
docker compose --profile monitoring up -d snmp-exporter prometheus
```

Ne pas exécuter `docker compose config` sans `--quiet` après avoir chargé les secrets dans l’environnement si la sortie doit être copiée ou partagée : Compose développe les variables d’environnement dans sa sortie.

## Validation réelle du DS920+

Validation effectuée le 5 août 2026 sur le NAS `RestorPc` :

```text
job              instance       health
snmp-exporter    snmp-exporter  up
synology-snmp    192.168.1.5    up
```

La requête Prometheus suivante retourne `1` :

```promql
up{job="synology-snmp"}
```

Les métriques réelles confirmées sont :

```text
diskStatus
diskTemperature
diskHealthStatus
raidStatus
raidFreeSize
raidTotalSize
```

Résultat observé :

- 4 disques détectés ;
- état de déploiement `1` pour les 4 disques, soit `Normal` ;
- santé `1` pour les 4 disques, soit `Normal` ;
- températures observées : 38 °C, 42 °C, 40 °C et 40 °C ;
- `Storage Pool 1` détecté et normal ;
- `Volume 1` détecté et normal ;
- capacité du volume : `14 376 458 133 504` octets ;
- espace libre du volume : `7 363 491 246 080` octets.

## Normalisation VestyHub

`src/connectors/synology/snmp.ts` interroge Prometheus avec une requête instantanée et produit :

- `NasDisk[]` depuis `diskStatus`, `diskHealthStatus` et `diskTemperature` ;
- `NasVolume[]` pour les entrées RAID dont le nom commence par `Volume` ;
- `NasStoragePool[]` pour les autres entrées RAID ;
- `usedBytes` et `usagePercent` depuis `raidTotalSize` et `raidFreeSize` ;
- décodage des identifiants hexadécimaux SNMP, par exemple `0x4469736B2031` vers `Disk 1`.

En mode `hybrid`, les données DSM restent prioritaires. SNMPv3 complète uniquement les catégories absentes, ce qui conserve la compatibilité avec un futur compte DSM autorisé à lire les API de stockage.

## Sécurité

- SNMPv1 et SNMPv2c désactivés ;
- SNMPv3 utilise `authPriv` avec SHA et AES ;
- aucun secret SNMP dans Prometheus ou VestyHub ;
- aucun port `9116` publié sur l’hôte ;
- aucun accès aux dossiers partagés DSM ;
- aucune permission supplémentaire accordée au compte WebAPI `vestyhub` ;
- collecte en lecture seule uniquement.

## Validation applicative

Après récupération du dernier commit :

```powershell
$env:SYNOLOGY_MODE="hybrid"
$env:VESTYHUB_IMAGE_TAG="phase3e-local"

docker compose --profile monitoring up -d `
  --no-deps `
  --build `
  --force-recreate `
  app
```

La page `http://localhost:3000/nas` doit afficher :

- 4 disques ;
- leurs températures ;
- `Volume 1` avec sa capacité et son occupation ;
- `Storage Pool 1` avec son état ;
- la mention de complément SNMPv3 dans les avertissements de source.
