# Sécurité

## Secrets

- `.env` et `.env.local` sont exclus de Git et de l’image Docker.
- Les tokens, mots de passe et chaînes de connexion ne doivent jamais être commités.
- `APP_ENCRYPTION_KEY` doit contenir exactement 32 octets encodés en hexadécimal.
- `AUTH_SECRET` doit contenir au minimum 32 caractères aléatoires.

## Chiffrement des secrets de connecteur

Les nouveaux secrets utilisent AES-256-GCM version 2 :

- IV aléatoire de 12 octets ;
- tag d’authentification de 16 octets ;
- AAD : `connectorId + encryptionVersion` ;
- taille plaintext maximale : 64 Kio ;
- la clé principale n’est jamais stockée en base.

Les payloads historiques version 1 à trois segments restent lisibles. Une future migration doit :

1. déchiffrer un enregistrement v1 avec l’ancienne clé ;
2. le rechiffrer en v2 avec son `connectorId` ;
3. mettre à jour `encryption_version` dans la même transaction ;
4. vérifier le résultat avant suppression de l’ancien secret ;
5. conserver une sauvegarde PostgreSQL validée avant rotation.

Ne jamais changer `APP_ENCRYPTION_KEY` sans procédure de rotation : les secrets existants deviendraient illisibles.

## Logger

Le logger produit du JSON et nettoie :

- champs dont le nom ressemble à un secret ;
- en-têtes Authorization, Bearer, Basic et cookies ;
- identifiants intégrés dans les URL ;
- tokens de query string ;
- chaînes de connexion ;
- objets imbriqués, erreurs, Map, Set, BigInt et références circulaires.

Le logger est conçu pour ne jamais interrompre le contrôle applicatif.

## Docker

`POST=0` impose uniquement `GET` et `HEAD`. Le proxy n’est accessible que depuis le réseau Docker interne et ne doit jamais recevoir de mapping de port LAN ou WAN.

Le montage `/var/run/docker.sock` reste sensible même en lecture seule. Toute personne capable de modifier `docker-compose.yml` ou les variables du proxy doit être considérée comme administrateur de l’hôte.

## TLS Synology

`SYNOLOGY_VERIFY_TLS=true` est le défaut obligatoire. Pour une PKI interne, monter une CA dédiée et utiliser `SYNOLOGY_CA_CERT_PATH`. Ne pas contourner une erreur de certificat en désactivant durablement la validation.

## MCP

- Aucun MCP ne reçoit le socket Docker du NAS.
- Aucun MCP PostgreSQL n’est connecté à la production.
- Les MCP GitHub et Grafana doivent utiliser des droits minimaux et de préférence la lecture seule.

## Authentification locale Phase 2

- Mots de passe hachés avec Argon2id.
- Jetons de session aléatoires de 32 octets.
- Seule l’empreinte SHA-256 du jeton est persistée.
- Cookie `HttpOnly`, `SameSite=Lax`, chemin `/` et expiration fixe de sept jours.
- Attribut `Secure` activé automatiquement lorsque `APP_URL` utilise HTTPS.
- Les tentatives de connexion sont limitées par IP et empreinte d’adresse e-mail.
- Les erreurs de connexion utilisent un message générique afin de ne pas confirmer l’existence d’un compte.

Le limiteur est volontairement en mémoire pour le déploiement mono-instance. Une architecture multi-réplicas doit utiliser un stockage partagé.

## Autorisation des favoris

Toutes les mutations valident les UUID, le rôle et `user_id`. Les groupes sont également vérifiés avant association. Une requête forgée ne peut pas modifier une ressource appartenant à un autre utilisateur.
