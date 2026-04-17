import { sessionAdminValide } from "../lib/dinouch-auth.mjs";
import {
    catalogueNeContientQueDesExemples,
    enregistrerCataloguePartage,
    lireCatalogueEditable,
    lireCataloguePartage,
    normaliserProduit
} from "../lib/dinouch-storage.mjs";

const ENTETES_JSON = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
};

function reponseJson(corps, statut = 200) {
    return new Response(JSON.stringify(corps), {
        status: statut,
        headers: ENTETES_JSON
    });
}

export const runtime = "nodejs";

export async function GET() {
    const resultat = await lireCataloguePartage();

    return reponseJson({
        catalogue: resultat.catalogue,
        shared: true,
        writable: resultat.writable,
        storage: resultat.storage,
        message: resultat.message
    });
}

export async function POST(request) {
    let donnees = {};

    try {
        donnees = await request.json();
    } catch (erreur) {
        return reponseJson({
            message: "Impossible de lire la mise a jour du catalogue."
        }, 400);
    }

    if (!sessionAdminValide(request)) {
        return reponseJson({
            message: "Session administrateur requise."
        }, 401);
    }

    if (!donnees.action) {
        return reponseJson({
            message: "Action manquante."
        }, 400);
    }

    try {
        const { catalogue } = await lireCatalogueEditable();

        if (donnees.action === "create") {
            const produitRecu = donnees.produit || {};
            const baseCatalogue = catalogueNeContientQueDesExemples(catalogue) ? [] : [...catalogue];
            const produit = normaliserProduit({
                ...produitRecu,
                id: produitRecu.id || `dinouch-${Date.now()}`,
                vues: 0,
                estExemple: false
            }, baseCatalogue.length);

            baseCatalogue.unshift(produit);

            const resultat = await enregistrerCataloguePartage(baseCatalogue, `Publier ${produit.nom} dans la boutique`);
            return reponseJson({
                catalogue: resultat.catalogue,
                produit,
                shared: true,
                writable: true,
                storage: resultat.storage,
                message: ""
            });
        }

        if (donnees.action === "delete") {
            const idProduit = String(donnees.idProduit || "");
            const prochainCatalogue = catalogue.filter((produit) => produit.id !== idProduit);

            if (prochainCatalogue.length === catalogue.length) {
                return reponseJson({
                    message: "Article introuvable."
                }, 404);
            }

            const resultat = await enregistrerCataloguePartage(prochainCatalogue, `Supprimer ${idProduit} du catalogue`);
            return reponseJson({
                catalogue: resultat.catalogue,
                shared: true,
                writable: true,
                storage: resultat.storage,
                message: ""
            });
        }

        if (donnees.action === "update") {
            const produitRecu = donnees.produit || {};
            const idProduit = String(produitRecu.id || "");
            const indexProduit = catalogue.findIndex((produit) => produit.id === idProduit);

            if (indexProduit === -1) {
                return reponseJson({
                    message: "Article introuvable."
                }, 404);
            }

            const produitActuel = catalogue[indexProduit];
            const produitMisAJour = normaliserProduit({
                ...produitActuel,
                ...produitRecu,
                id: produitActuel.id,
                vues: produitActuel.vues,
                estExemple: false
            }, indexProduit);
            const prochainCatalogue = [...catalogue];

            prochainCatalogue.splice(indexProduit, 1, produitMisAJour);

            const resultat = await enregistrerCataloguePartage(prochainCatalogue, `Mettre a jour ${produitMisAJour.nom}`);
            return reponseJson({
                catalogue: resultat.catalogue,
                produit: produitMisAJour,
                shared: true,
                writable: true,
                storage: resultat.storage,
                message: ""
            });
        }

        return reponseJson({
            message: "Action inconnue."
        }, 400);
    } catch (erreur) {
        return reponseJson({
            message: erreur.message || "Impossible de mettre a jour le catalogue partage."
        }, 503);
    }
}
