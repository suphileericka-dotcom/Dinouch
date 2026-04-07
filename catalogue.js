(function () {
    const CLE_CATALOGUE = "dinouch_catalogue";
    const ANCIENNE_CLE_CATALOGUE = "atelier_articles";
    const CLE_PANIER = "dinouch_panier";
    const ANCIENNE_CLE_PANIER = "monPanier";
    const CLE_SESSION_ADMIN = "dinouch_session_admin";
    const ANCIENNE_CLE_SESSION_ADMIN = "atelier_admin_session";
    const CLE_VISITEUR_SITE = "dinouch_site_visitor";
    const CLE_SESSION_VISITE = "dinouch_site_visit_session";
    const PRODUITS_PAR_PAGE = 15;

    let catalogueEnMemoire = null;
    let promesseInitialisation = null;
    let statutStockage = {
        shared: false,
        writable: false,
        storage: "local",
        message: ""
    };
    let sessionAdminMemoire = null;
    let identifiantVisiteurMemoire = null;

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

    function normaliserCatalogue(catalogue) {
        if (!Array.isArray(catalogue)) {
            return creerCatalogueParDefaut().map(normaliserProduit);
        }

        return catalogue.map(normaliserProduit);
    }

    function lireCatalogueLocal() {
        const catalogue = lireJson(CLE_CATALOGUE, null);
        if (!Array.isArray(catalogue)) {
            return creerCatalogueParDefaut().map(normaliserProduit);
        }

        return catalogue.map(normaliserProduit);
    }

    function enregistrerCatalogueLocal(catalogue) {
        const catalogueNormalise = normaliserCatalogue(catalogue);
        catalogueEnMemoire = catalogueNormalise;
        enregistrerJson(CLE_CATALOGUE, catalogueNormalise);
        return catalogueNormalise;
    }

    function clonerCatalogue(catalogue) {
        return normaliserCatalogue(catalogue).map((produit) => ({ ...produit, tailles: [...produit.tailles] }));
    }

    function mutationLocaleAutorisee() {
        return window.location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(window.location.hostname);
    }

    async function lireJsonApi(url, options) {
        const reponse = await fetch(url, {
            cache: "no-store",
            credentials: "same-origin",
            ...options
        });

        let donnees = {};
        try {
            donnees = await reponse.json();
        } catch (erreur) {
            donnees = {};
        }

        if (!reponse.ok) {
            throw new Error(donnees.message || "Impossible de contacter le service distant.");
        }

        return donnees;
    }

    async function initialiserCatalogue(options) {
        const force = Boolean(options && options.force);

        migrerSiBesoin(CLE_CATALOGUE, ANCIENNE_CLE_CATALOGUE);
        migrerSiBesoin(CLE_PANIER, ANCIENNE_CLE_PANIER);

        if (!localStorage.getItem(CLE_SESSION_ADMIN) && localStorage.getItem(ANCIENNE_CLE_SESSION_ADMIN) === "active") {
            localStorage.setItem(CLE_SESSION_ADMIN, "active");
        }

        if (!catalogueEnMemoire) {
            catalogueEnMemoire = lireCatalogueLocal();
        }

        if (promesseInitialisation && !force) {
            return promesseInitialisation;
        }

        promesseInitialisation = lireJsonApi("/api/catalogue")
            .then((donnees) => {
                statutStockage = {
                    shared: Boolean(donnees.shared),
                    writable: Boolean(donnees.writable),
                    storage: String(donnees.storage || "remote"),
                    message: String(donnees.message || "")
                };
                return enregistrerCatalogueLocal(donnees.catalogue || []);
            })
            .catch(() => {
                statutStockage = {
                    shared: false,
                    writable: false,
                    storage: "local",
                    message: "Le catalogue partage n'est pas joignable. Les donnees locales restent affichees."
                };
                return enregistrerCatalogueLocal(catalogueEnMemoire || lireCatalogueLocal());
            });

        return promesseInitialisation;
    }

    function lireCatalogue() {
        if (!catalogueEnMemoire) {
            catalogueEnMemoire = lireCatalogueLocal();
        }

        return clonerCatalogue(catalogueEnMemoire);
    }

    function lireStatutStockage() {
        return { ...statutStockage };
    }

    function publicationPartageeDisponible() {
        return Boolean(statutStockage.writable);
    }

    function lireMessagePublicationIndisponible() {
        if (statutStockage.shared) {
            return "La photo peut etre envoyee sur Cloudinary, mais l'article ne sera pas enregistre sur le catalogue partage tant que GITHUB_TOKEN n'est pas ajoute sur Vercel.";
        }

        return statutStockage.message || "Le catalogue partage n'est pas disponible pour le moment.";
    }

    function trouverProduitParId(idProduit) {
        return lireCatalogue().find((produit) => produit.id === idProduit) || null;
    }

    async function ajouterAuCatalogue(produit) {
        await initialiserCatalogue();

        try {
            const donnees = await lireJsonApi("/api/catalogue", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify({
                    action: "create",
                    produit
                })
            });

            statutStockage = {
                shared: Boolean(donnees.shared),
                writable: Boolean(donnees.writable),
                storage: String(donnees.storage || "github"),
                message: String(donnees.message || "")
            };

            enregistrerCatalogueLocal(donnees.catalogue || []);
            return normaliserProduit(donnees.produit || produit, 0);
        } catch (erreur) {
            if (!mutationLocaleAutorisee()) {
                if (!statutStockage.writable) {
                    throw new Error(lireMessagePublicationIndisponible());
                }

                throw erreur;
            }

            const catalogueActuel = lireCatalogue();
            const produitNormalise = normaliserProduit({
                ...produit,
                id: produit.id || `dinouch-${Date.now()}`,
                vues: 0,
                estExemple: false
            }, catalogueActuel.length);

            catalogueActuel.unshift(produitNormalise);
            enregistrerCatalogueLocal(catalogueActuel);
            statutStockage = {
                shared: false,
                writable: true,
                storage: "local",
                message: "Publication locale uniquement."
            };
            return produitNormalise;
        }
    }

    async function supprimerProduit(idProduit) {
        await initialiserCatalogue();

        try {
            const donnees = await lireJsonApi("/api/catalogue", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify({
                    action: "delete",
                    idProduit
                })
            });

            statutStockage = {
                shared: Boolean(donnees.shared),
                writable: Boolean(donnees.writable),
                storage: String(donnees.storage || "github"),
                message: String(donnees.message || "")
            };

            enregistrerCatalogueLocal(donnees.catalogue || []);
            return true;
        } catch (erreur) {
            if (!mutationLocaleAutorisee()) {
                if (!statutStockage.writable) {
                    throw new Error(lireMessagePublicationIndisponible());
                }

                throw erreur;
            }

            const catalogue = lireCatalogue();
            const index = catalogue.findIndex((produit) => produit.id === idProduit);
            if (index === -1) {
                return false;
            }

            catalogue.splice(index, 1);
            enregistrerCatalogueLocal(catalogue);
            return true;
        }
    }

    function formaterPrix(prix) {
        return new Intl.NumberFormat("fr-FR", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Number(prix) || 0) + " FCF";
    }

    function normaliserStatistiquesSite(statistiques) {
        const jourActuel = statistiques && typeof statistiques.jourActuel === "object" && !Array.isArray(statistiques.jourActuel)
            ? statistiques.jourActuel
            : {};
        const historiqueJournalier = Array.isArray(statistiques?.historiqueJournalier)
            ? statistiques.historiqueJournalier
            : [];

        return {
            visitesTotales: Math.max(0, Number(statistiques?.visitesTotales) || 0),
            visiteursUniquesEstimes: Math.max(0, Number(statistiques?.visiteursUniquesEstimes) || 0),
            derniereVisite: String(statistiques?.derniereVisite || ""),
            fuseauHoraire: String(statistiques?.fuseauHoraire || "UTC"),
            jourActuel: {
                date: String(jourActuel.date || ""),
                visitesTotales: Math.max(0, Number(jourActuel.visitesTotales) || 0),
                visiteursUniquesEstimes: Math.max(0, Number(jourActuel.visiteursUniquesEstimes) || 0)
            },
            historiqueJournalier: historiqueJournalier.map((statistiquesJour) => ({
                date: String(statistiquesJour?.date || ""),
                visitesTotales: Math.max(0, Number(statistiquesJour?.visitesTotales) || 0),
                visiteursUniquesEstimes: Math.max(0, Number(statistiquesJour?.visiteursUniquesEstimes) || 0)
            }))
        };
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

    function lireOuCreerIdentifiantVisiteur() {
        const creerNouvelIdentifiant = () => typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `dinouch-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        try {
            const identifiantExistant = localStorage.getItem(CLE_VISITEUR_SITE);

            if (identifiantExistant) {
                return identifiantExistant;
            }

            const nouvelIdentifiant = creerNouvelIdentifiant();
            localStorage.setItem(CLE_VISITEUR_SITE, nouvelIdentifiant);
            return nouvelIdentifiant;
        } catch (erreur) {
            if (!identifiantVisiteurMemoire) {
                identifiantVisiteurMemoire = creerNouvelIdentifiant();
            }

            return identifiantVisiteurMemoire;
        }
    }

    async function enregistrerVisiteSite() {
        try {
            if (sessionStorage.getItem(CLE_SESSION_VISITE) === "done") {
                return null;
            }

            sessionStorage.setItem(CLE_SESSION_VISITE, "done");
        } catch (erreur) {
            return null;
        }

        try {
            const donnees = await lireJsonApi("/api/site-views", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify({
                    visitorId: lireOuCreerIdentifiantVisiteur()
                })
            });

            return normaliserStatistiquesSite(donnees.statistiques || {});
        } catch (erreur) {
            try {
                sessionStorage.removeItem(CLE_SESSION_VISITE);
            } catch (erreurSession) {
                return null;
            }

            return null;
        }
    }

    async function lireStatistiquesSite() {
        const donnees = await lireJsonApi("/api/site-views");

        return {
            statistiques: normaliserStatistiquesSite(donnees.statistiques || {}),
            shared: Boolean(donnees.shared),
            writable: Boolean(donnees.writable),
            storage: String(donnees.storage || "remote"),
            message: String(donnees.message || "")
        };
    }

    async function verifierSessionAdmin(force) {
        if (sessionAdminMemoire !== null && !force) {
            return sessionAdminMemoire;
        }

        try {
            const donnees = await lireJsonApi("/api/admin-auth");
            sessionAdminMemoire = Boolean(donnees.active);
            if (sessionAdminMemoire) {
                localStorage.setItem(CLE_SESSION_ADMIN, "active");
            } else {
                localStorage.removeItem(CLE_SESSION_ADMIN);
            }
            return sessionAdminMemoire;
        } catch (erreur) {
            sessionAdminMemoire = localStorage.getItem(CLE_SESSION_ADMIN) === "active";
            return sessionAdminMemoire;
        }
    }

    async function ouvrirSessionAdmin(password) {
        await fetch("/api/admin-auth", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify({
                password
            })
        }).then(async (reponse) => {
            if (reponse.ok) {
                return;
            }

            let donnees = {};
            try {
                donnees = await reponse.json();
            } catch (erreur) {
                donnees = {};
            }

            throw new Error(donnees.message || "Connexion administrateur impossible.");
        });

        sessionAdminMemoire = true;
        localStorage.setItem(CLE_SESSION_ADMIN, "active");
        return true;
    }

    async function fermerSessionAdmin() {
        try {
            await fetch("/api/admin-auth", {
                method: "DELETE",
                credentials: "same-origin"
            });
        } finally {
            sessionAdminMemoire = false;
            localStorage.removeItem(CLE_SESSION_ADMIN);
        }
    }

    function sessionAdminActive() {
        return sessionAdminMemoire === true || localStorage.getItem(CLE_SESSION_ADMIN) === "active";
    }

    window.DINOUCH = {
        PRODUITS_PAR_PAGE,
        initialiserCatalogue,
        lireCatalogue,
        lireStatutStockage,
        publicationPartageeDisponible,
        lireMessagePublicationIndisponible,
        trouverProduitParId,
        ajouterAuCatalogue,
        supprimerProduit,
        formaterPrix,
        echapperTexte,
        lirePanier,
        enregistrerPanier,
        ajouterAuPanier,
        retirerDuPanier,
        viderPanier,
        enregistrerVisiteSite,
        lireStatistiquesSite,
        verifierSessionAdmin,
        sessionAdminActive,
        ouvrirSessionAdmin,
        fermerSessionAdmin
    };

    const pageActuelle = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

    if (!["admin.html", "admin_login.html"].includes(pageActuelle)) {
        enregistrerVisiteSite().catch(() => null);
    }
})();
