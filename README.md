# DINOUCH

Boutique statique en HTML, CSS et JavaScript pour une gestion simple depuis le navigateur.

## Technologies utilisees

- `HTML` pour la structure des pages
- `Tailwind CSS` via CDN pour la mise en page rapide
- `CSS` classique pour les styles specifiques a chaque page
- `JavaScript` natif pour toute la logique
- `localStorage` pour stocker les produits, le panier, la session admin et les vues
- `Cloudinary` pour l'upload des photos
- `Formspree` pour l'envoi des formulaires

## Fichiers principaux

- `index.html` : page d'accueil de la boutique
- `produit.html` : fiche d'un produit
- `panier.html` : panier et formulaire de commande
- `suggestions.html` : page de suggestions clients
- `admin_login.html` : connexion admin
- `admin.html` : publication des produits et gestion des photos
- `catalogue.js` : coeur logique du site
- `style.css`, `panier.css`, `produit.css`, `suggestion.css`, `admin_login.css` : styles par page

## Comment l'interface a ete codee

L'interface repose sur une base simple :

```html
<main class="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6 pb-32">
    <div id="grille-produits" class="grid grid-cols-2 gap-x-3 gap-y-8"></div>
</main>
```

Ici, on cree une zone centrale avec une grille de cartes produit. Ensuite, le JavaScript remplit cette grille automatiquement.

Exemple de carte produit dans `index.html` :

```js
function creerCarteProduit(produit) {
    return `
        <article class="product-card group">
            <a href="produit.html?id=${window.DINOUCH.echapperTexte(produit.id)}" class="block">
                ...
            </a>
            <button data-produit-id="${window.DINOUCH.echapperTexte(produit.id)}">
                Ajouter au panier
            </button>
        </article>
    `;
}
```

Donc :

- le HTML prepare les emplacements
- Tailwind gere le layout
- JavaScript genere le contenu reel

## Comment le code fonctionne

### 1. Le catalogue

Le fichier `catalogue.js` contient la logique principale.

Lecture du catalogue :

```js
function lireCatalogue() {
    initialiserCatalogue();
    return lireJson(CLE_CATALOGUE, []).map(normaliserProduit);
}
```

Ajout d'un produit :

```js
function ajouterAuCatalogue(produit) {
    const catalogueActuel = lireCatalogue();
    ...
    baseCatalogue.unshift(produitNormalise);
    enregistrerCatalogue(baseCatalogue);
    return produitNormalise;
}
```

Cela veut dire que chaque nouvel article publie dans `admin.html` est enregistre dans le `localStorage`, puis apparait dans la boutique.

### 2. La pagination

La pagination de la page d'accueil est geree dans `index.html`.

```js
const totalPages = Math.max(1, Math.ceil(catalogue.length / window.DINOUCH.PRODUITS_PAR_PAGE));
const debut = (pageCourante - 1) * window.DINOUCH.PRODUITS_PAR_PAGE;
const produitsVisibles = catalogue.slice(debut, debut + window.DINOUCH.PRODUITS_PAR_PAGE);
```

Le nombre de produits par page est defini ici :

```js
const PRODUITS_PAR_PAGE = 15;
```

dans `catalogue.js`.

### 3. Les vues

Les vues sont incrementees quand un visiteur ouvre `produit.html`.

```js
window.DINOUCH.incrementerVueUnique(produit.id);
```

et dans `catalogue.js` :

```js
function incrementerVueUnique(idProduit) {
    const vuesUniques = lireJson(CLE_VUES_UNIQUES, {});
    if (vuesUniques[idProduit]) {
        return false;
    }
    ...
    catalogue[index].vues = (Number(catalogue[index].vues) || 0) + 1;
}
```

Important :

- ce sont des vues uniques par navigateur
- ce n'est pas un compteur global serveur

### 4. Le panier

Ajout au panier :

```js
window.DINOUCH.ajouterAuPanier(produit.id, tailleSelectionnee);
```

Dans `catalogue.js` :

```js
function ajouterAuPanier(entree, tailleChoisie) {
    const produit = typeof entree === "string" ? trouverProduitParId(entree) : entree;
    ...
    panier.push({
        id: produit.id,
        nom: produit.nom,
        prix: Number(produit.prix) || 0,
        image: produit.image || "",
        taille: tailleChoisie || "Unique"
    });
}
```

Le panier est ensuite relu dans `panier.html` pour afficher les articles et calculer le total.

### 5. Le prix en FCF

Le formatage du prix est centralise dans `catalogue.js` :

```js
function formaterPrix(prix) {
    return new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Number(prix) || 0) + " FCF";
}
```

Comme cette fonction est appelee partout, changer la devise ici met a jour tout le site.

### 6. La publication d'une photo

Dans `admin.html`, l'upload se fait via Cloudinary :

```js
widgetCloudinary = cloudinary.createUploadWidget(
    {
        cloudName: "dues52ox5",
        uploadPreset: "ml_default"
    },
    (erreur, resultat) => {
        if (!erreur && resultat && resultat.event === "success") {
            const imageUrl = resultat.info.secure_url;
            imageApercu.src = imageUrl;
            urlPhoto.value = imageUrl;
        }
    }
);
```

Ensuite, l'URL de l'image est stockee dans le produit.

### 7. Supprimer un article depuis l'admin

La suppression d'un article depuis l'admin passe maintenant par `catalogue.js` :

```js
function supprimerProduit(idProduit) {
    const catalogue = lireCatalogue();
    const index = catalogue.findIndex((produit) => produit.id === idProduit);
    if (index === -1) {
        return false;
    }
    catalogue.splice(index, 1);
    enregistrerCatalogue(catalogue);
    return true;
}
```

Cela ne supprime pas le fichier de Cloudinary.
Cela retire l'article du catalogue du site.

## Fonctionnement page par page

### `admin.html`

- ajoute un article
- enregistre le produit
- affiche les articles recents
- permet de supprimer un article du site

### `index.html`

- lit le catalogue
- affiche 15 produits par page
- gere les boutons `Precedent` et `Suivant`

### `produit.html`

- lit l'id du produit dans l'URL
- affiche la fiche complete
- incremente les vues
- ajoute au panier

### `panier.html`

- lit les produits en panier
- calcule le total
- prepare le champ cache envoye a Formspree

## Limites actuelles

- tout fonctionne cote navigateur
- les donnees sont stockees dans `localStorage`
- si on change d'appareil ou de navigateur, on ne retrouve pas les memes donnees
- les vues ne sont pas centralisees sur un serveur
- la suppression d'un article retire le produit du site, pas le fichier Cloudinary

## Si tu veux faire evoluer le projet plus tard

Les prochaines evolutions logiques seraient :

- vraie base de donnees
- vrai espace admin securise cote serveur
- vraies vues globales
- suppression Cloudinary cote serveur
- edition complete d'un produit deja publie
