# Authentification Phase 2

## Flux local

1. Le formulaire de connexion est validé côté serveur avec Zod.
2. L’utilisateur est recherché avec une adresse normalisée en minuscules.
3. Le mot de passe est vérifié avec Argon2id.
4. Un jeton aléatoire de 32 octets est créé.
5. Seule son empreinte SHA-256 est enregistrée dans `sessions.session_token`.
6. Le jeton brut est envoyé dans un cookie `HttpOnly`.
7. Les routes protégées chargent l’utilisateur via la session PostgreSQL.

Le cookie est `Secure` lorsque `APP_URL` commence par `https://`. Pour un test local sur `http://127.0.0.1`, il reste utilisable sans l’attribut `Secure`.

## Rôles

- `VIEWER` : consultation du dashboard et des favoris.
- `USER` : consultation et modification de ses favoris.
- `ADMIN` : droits utilisateur et futures fonctions d’administration.

Toutes les Server Actions sensibles contrôlent elles-mêmes la session et le rôle. L’affichage conditionnel d’un bouton ne constitue jamais une autorisation.

## Limitation de connexion

La Phase 2 utilise un limiteur mémoire par combinaison IP + empreinte d’e-mail : cinq échecs dans une fenêtre de quinze minutes déclenchent un blocage de quinze minutes.

Cette protection est adaptée au déploiement mono-instance prévu sur le NAS. Pour plusieurs réplicas, remplacer ce stockage par Redis ou PostgreSQL.

## Audit

Les succès, échecs et déconnexions sont écrits dans `audit_logs`. L’adresse e-mail soumise lors d’un échec n’est pas stockée en clair : seule une empreinte tronquée est conservée.

## Expiration

Les sessions expirent après sept jours sans renouvellement. Les sessions expirées sont ignorées et purgées lors de la création d’une nouvelle session.
