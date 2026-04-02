import {
    creerCookieSession,
    effacerCookieSession,
    lireMotDePasseAdmin,
    sessionAdminValide
} from "../lib/dinouch-auth.mjs";

const ENTETES_JSON = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
};

function reponseJson(corps, statut = 200, entetes = {}) {
    return new Response(JSON.stringify(corps), {
        status: statut,
        headers: {
            ...ENTETES_JSON,
            ...entetes
        }
    });
}

export const runtime = "nodejs";

export async function GET(request) {
    return reponseJson({
        active: sessionAdminValide(request)
    });
}

export async function POST(request) {
    let donnees = {};

    try {
        donnees = await request.json();
    } catch (erreur) {
        return reponseJson({
            message: "Impossible de lire la demande de connexion."
        }, 400);
    }

    if (String(donnees.password || "") !== lireMotDePasseAdmin()) {
        return reponseJson({
            message: "Mot de passe incorrect."
        }, 401);
    }

    return new Response(null, {
        status: 204,
        headers: {
            "Cache-Control": "no-store",
            "Set-Cookie": creerCookieSession()
        }
    });
}

export async function DELETE() {
    return new Response(null, {
        status: 204,
        headers: {
            "Cache-Control": "no-store",
            "Set-Cookie": effacerCookieSession()
        }
    });
}
