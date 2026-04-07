import { sessionAdminValide } from "../lib/dinouch-auth.mjs";
import {
    enregistrerVisiteSitePartage,
    lireStatistiquesSitePartage
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

export async function GET(request) {
    if (!sessionAdminValide(request)) {
        return reponseJson({
            message: "Session administrateur requise."
        }, 401);
    }

    try {
        const resultat = await lireStatistiquesSitePartage();

        return reponseJson({
            statistiques: resultat.statistiques,
            shared: true,
            writable: resultat.writable,
            storage: resultat.storage,
            message: resultat.message
        });
    } catch (erreur) {
        return reponseJson({
            message: erreur.message || "Impossible de lire les statistiques du site."
        }, 503);
    }
}

export async function POST(request) {
    let donnees = {};

    try {
        donnees = await request.json();
    } catch (erreur) {
        return reponseJson({
            message: "Impossible de lire la visite du site."
        }, 400);
    }

    const identifiantVisiteur = String(donnees.visitorId || "").trim();

    if (!identifiantVisiteur) {
        return reponseJson({
            message: "Identifiant visiteur manquant."
        }, 400);
    }

    try {
        const resultat = await enregistrerVisiteSitePartage(identifiantVisiteur);

        return reponseJson({
            statistiques: resultat.statistiques,
            shared: true,
            writable: resultat.writable,
            storage: resultat.storage,
            message: resultat.message
        });
    } catch (erreur) {
        return reponseJson({
            message: erreur.message || "Impossible d'enregistrer la visite du site."
        }, 503);
    }
}
