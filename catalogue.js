(function () {
    const CLE_CATALOGUE = "dinouch_catalogue";
    const ANCIENNE_CLE_CATALOGUE = "atelier_articles";
    const CLE_PANIER = "dinouch_panier";
    const ANCIENNE_CLE_PANIER = "monPanier";
    const CLE_SESSION_ADMIN = "dinouch_session_admin";
    const ANCIENNE_CLE_SESSION_ADMIN = "atelier_admin_session";
    const CLE_VUES_UNIQUES = "dinouch_vues_uniques";
    const PRODUITS_PAR_PAGE = 15;

    function lireJson(cle, valeurParDefaut) {
        try {
            const brut = localStorage.getItem(cle);
            return brut ? JSON.parse(brut) : valeurParDefaut;
        } catch (erreur) {
            return valeurParDefaut;
        }
    }

    function enregistrerJson(cle, valeur) {
        localStorage.setItem(cle, JSON.stringify(valeur));
    }

    function migrerSiBesoin(nouvelleCle, ancienneCle) {
        if (!localStorage.getItem(nouvelleCle) && localStorage.getItem(ancienneCle)) {
            localStorage.setItem(nouvelleCle, localStorage.getItem(ancienneCle));
        }
    }

    function creerCatalogueParDefaut() {
        return [
            {
                id: "vase-artisanal",
                nom: "Vase artisanal",
                prix: 85,
                image: "",
                tailles: ["Unique"],
                vues: 0,
                description: "Une piece decorative au style artisanal, ideale pour sublimer une table ou une console.",
                estExemple: true
            },
            {
                id: "chemise-lin-ample",
                nom: "Chemise en lin ample",
                prix: 145,
                image: "",
                tailles: ["S", "M", "L"],
                vues: 0,
                description: "Une chemise legere a la coupe ample, pensee pour un style simple et raffine.",
                estExemple: true
            },
            {
                id: "assiettes-mouchetees",
                nom: "Service d'assiettes mouchetees",
                prix: 120,
                image: "",
                tailles: ["6 pieces"],
                vues: 0,
                description: "Un ensemble de table artisanal au rendu mineral et chaleureux.",
                estExemple: true
            },
            {
                id: "veste-lin-signature",
                nom: "Veste en lin signature",
                prix: 165,
                image: "",
                tailles: ["M", "L"],
                vues: 0,
                description: "Une veste de caractere, facile a porter au quotidien avec une allure epuree.",
                estExemple: true
            }
        ];
    }

    function creerIdentifiant(texte, index) {
        const base = String(texte || "produit")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

        return (base || "produit") + "-" + index;
    }

    function normaliserProduit(produit, index) {
        const tailles = Array.isArray(produit.tailles) && produit.tailles.length
            ? produit.tailles.map((taille) => String(taille))
            : ["Unique"];

        return {
            id: produit.id || creerIdentifiant(produit.nom, index),
            nom: String(produit.nom || "Produit sans nom"),
            prix: Number(produit.prix) || 0,
            image: String(produit.image || ""),
            tailles,
            vues: Number(produit.vues) || 0,
            description: String(produit.description || "Une piece selectionnee pour la boutique DINOUCH."),
            estExemple: Boolean(produit.estExemple)
        };
    }

    function catalogueNeContientQueDesExemples(catalogue) {
        return catalogue.length > 0 && catalogue.every((produit) => produit.estExemple);
    }

    function initialiserCatalogue() {
        migrerSiBesoin(CLE_CATALOGUE, ANCIENNE_CLE_CATALOGUE);
        migrerSiBesoin(CLE_PANIER, ANCIENNE_CLE_PANIER);

        if (!localStorage.getItem(CLE_SESSION_ADMIN) && localStorage.getItem(ANCIENNE_CLE_SESSION_ADMIN) === "active") {
            localStorage.setItem(CLE_SESSION_ADMIN, "active");
        }

        const catalogueExistant = lireJson(CLE_CATALOGUE, null);
        if (!Array.isArray(catalogueExistant) || catalogueExistant.length === 0) {
            enregistrerJson(CLE_CATALOGUE, creerCatalogueParDefaut());
            return;
        }

        const catalogueNormalise = catalogueExistant.map(normaliserProduit);
        enregistrerJson(CLE_CATALOGUE, catalogueNormalise);
    }

    function lireCatalogue() {
        initialiserCatalogue();
        return lireJson(CLE_CATALOGUE, []).map(normaliserProduit);
    }

    function enregistrerCatalogue(catalogue) {
        enregistrerJson(CLE_CATALOGUE, catalogue.map(normaliserProduit));
    }

    function trouverProduitParId(idProduit) {
        return lireCatalogue().find((produit) => produit.id === idProduit) || null;
    }

    function ajouterAuCatalogue(produit) {
        const catalogueActuel = lireCatalogue();
        const baseCatalogue = catalogueNeContientQueDesExemples(catalogueActuel) ? [] : catalogueActuel;
        const produitNormalise = normaliserProduit(
            {
                ...produit,
                id: produit.id || "dinouch-" + Date.now(),
                vues: Number(produit.vues) || 0,
                estExemple: false
            },
            baseCatalogue.length
        );

        baseCatalogue.unshift(produitNormalise);
        enregistrerCatalogue(baseCatalogue);
        return produitNormalise;
    }

    function retirerPhotoProduit(idProduit) {
        const catalogue = lireCatalogue();
        const index = catalogue.findIndex((produit) => produit.id === idProduit);

        if (index === -1) {
            return false;
        }

        catalogue[index].image = "";
        enregistrerCatalogue(catalogue);
        return true;
    }

    function formaterPrix(prix) {
        return new Intl.NumberFormat("fr-FR", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Number(prix) || 0) + " FCF";
    }

    function echapperTexte(valeur) {
        return String(valeur).replace(/[&<>"']/g, (caractere) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        }[caractere]));
    }

    function lirePanier() {
        initialiserCatalogue();
        return lireJson(CLE_PANIER, []);
    }

    function enregistrerPanier(panier) {
        enregistrerJson(CLE_PANIER, panier);
    }

    function ajouterAuPanier(entree, tailleChoisie) {
        const produit = typeof entree === "string" ? trouverProduitParId(entree) : entree;
        if (!produit) {
            return null;
        }

        const panier = lirePanier();
        panier.push({
            id: produit.id,
            nom: produit.nom,
            prix: Number(produit.prix) || 0,
            image: produit.image || "",
            taille: tailleChoisie || (Array.isArray(produit.tailles) && produit.tailles[0]) || "Unique"
        });
        enregistrerPanier(panier);
        return panier;
    }

    function retirerDuPanier(index) {
        const panier = lirePanier();
        panier.splice(index, 1);
        enregistrerPanier(panier);
        return panier;
    }

    function viderPanier() {
        enregistrerPanier([]);
    }

    function incrementerVueUnique(idProduit) {
        const vuesUniques = lireJson(CLE_VUES_UNIQUES, {});
        if (vuesUniques[idProduit]) {
            return false;
        }

        const catalogue = lireCatalogue();
        const index = catalogue.findIndex((produit) => produit.id === idProduit);
        if (index === -1) {
            return false;
        }

        catalogue[index].vues = (Number(catalogue[index].vues) || 0) + 1;
        enregistrerCatalogue(catalogue);
        vuesUniques[idProduit] = new Date().toISOString();
        enregistrerJson(CLE_VUES_UNIQUES, vuesUniques);
        return true;
    }

    function sessionAdminActive() {
        return localStorage.getItem(CLE_SESSION_ADMIN) === "active";
    }

    function ouvrirSessionAdmin() {
        localStorage.setItem(CLE_SESSION_ADMIN, "active");
    }

    function fermerSessionAdmin() {
        localStorage.removeItem(CLE_SESSION_ADMIN);
    }

    window.DINOUCH = {
        PRODUITS_PAR_PAGE,
        initialiserCatalogue,
        lireCatalogue,
        enregistrerCatalogue,
        trouverProduitParId,
        ajouterAuCatalogue,
        retirerPhotoProduit,
        catalogueNeContientQueDesExemples,
        formaterPrix,
        echapperTexte,
        lirePanier,
        enregistrerPanier,
        ajouterAuPanier,
        retirerDuPanier,
        viderPanier,
        incrementerVueUnique,
        sessionAdminActive,
        ouvrirSessionAdmin,
        fermerSessionAdmin
    };
})();
