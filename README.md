# DINOUCH

Boutique statique HTML/CSS/JavaScript avec catalogue partage entre appareils via des fonctions Vercel.

## Ce qui a change

Avant, les produits etaient enregistres dans le `localStorage` du navigateur.
Resultat :

- le telephone et le PC pouvaient afficher des catalogues differents
- Safari et Chrome pouvaient voir des donnees differentes
- l'admin publiait seulement sur l'appareil utilise

Maintenant :

- la lecture du catalogue passe par `GET /api/catalogue`
- le catalogue par defaut vit dans `data/catalogue.json`
- l'admin se connecte via `POST /api/admin-auth`
- les publications et suppressions passent par `POST /api/catalogue`
- le panier reste local au navigateur, ce qui est normal

## Fichiers principaux

- `index.html` : boutique
- `produit.html` : fiche produit
- `panier.html` : panier local
- `admin_login.html` : connexion admin
- `admin.html` : publication et suppression des produits
- `catalogue.js` : logique front commune
- `api/admin-auth.mjs` : session admin HTTP-only
- `api/catalogue.mjs` : lecture et ecriture du catalogue partage
- `lib/dinouch-auth.mjs` : signature/verif de session admin
- `lib/dinouch-storage.mjs` : lecture/ecriture du catalogue
- `data/catalogue.json` : catalogue partage de base

## Fonctionnement

### Lecture

Le front appelle `/api/catalogue`.

- si `GITHUB_TOKEN` est configure sur Vercel, l'API lit `data/catalogue.json` dans le repo GitHub
- sinon l'API lit le fichier local deploye `data/catalogue.json`

Dans les deux cas, tous les appareils lisent la meme base de catalogue.

### Publication admin

Quand l'admin ajoute ou supprime un article :

- l'utilisateur doit avoir une session admin valide
- l'API ecrit le nouveau catalogue dans le repo GitHub
- le site relit ensuite le catalogue partage

## Variables Vercel a ajouter

Pour que les publications de l'admin soient visibles partout, ajoute au minimum :

- `GITHUB_TOKEN`

## Configuration rapide de `GITHUB_TOKEN`

Le plus simple est d'utiliser un token GitHub "fine-grained".

1. Ouvre GitHub > `Settings` > `Developer settings` > `Personal access tokens` > `Fine-grained tokens`.
2. Clique sur `Generate new token`.
3. Choisis comme resource owner le compte qui possede le repo `suphileericka-dotcom/Dinouch`.
4. Dans `Repository access`, selectionne uniquement le repo `Dinouch`.
5. Dans `Permissions`, donne au minimum `Contents: Read and write`.
6. Copie le token tout de suite apres creation.
7. Dans Vercel > projet `Dinouch` > `Settings` > `Environment Variables`, ajoute :
   - nom : `GITHUB_TOKEN`
   - valeur : le token GitHub
8. Sauvegarde puis redeploie le projet pour que la variable soit prise en compte.

Si tu utilises un token GitHub "classic", il faut au minimum le scope `repo`, mais GitHub recommande plutot les tokens fine-grained.

Le token doit pouvoir modifier le repo `suphileericka-dotcom/Dinouch`.

Variables optionnelles :

- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `GITHUB_REPO_OWNER`
- `GITHUB_REPO_NAME`
- `GITHUB_REPO_BRANCH`
- `GITHUB_CATALOGUE_PATH`

Par defaut, le projet utilise :

- repo : `suphileericka-dotcom/Dinouch`
- branche : `main`
- fichier catalogue : `data/catalogue.json`
- mot de passe admin : `@16Dinou`

## Important

- Sans `GITHUB_TOKEN`, le catalogue reste lisible partout mais l'admin ne peut pas publier de facon partagee.
- Le panier reste volontairement local a chaque navigateur.
- Les vues n'ont plus ete gardees dans l'interface, car ce n'etait pas une information fiable entre appareils.

## Deploiement

Le projet reste compatible avec Vercel sans framework.

- les pages statiques servent le front
- `api/*.mjs` servent les endpoints
- aucune dependance npm n'a ete ajoutee

## Verification locale faite

J'ai verifie :

- la syntaxe de `catalogue.js`
- la syntaxe des fichiers `api/*.mjs` et `lib/*.mjs`
- `GET /api/catalogue` en local
- `GET /api/admin-auth` en local
- le refus de publication sans session admin
- le message explicite si `GITHUB_TOKEN` n'est pas encore configure
