import { createHash, randomUUID } from "node:crypto";
import { sessionAdminValide } from "../lib/dinouch-auth.mjs";
import {
    enregistrerVisiteSitePartage,
    lireStatistiquesSitePartage
} from "../lib/dinouch-storage.mjs";

const NOM_COOKIE_VISITEUR = "dinouch_site_visitor";
const NOM_COOKIE_SESSION_VISITE = "dinouch_site_visit_session";
const DUREE_COOKIE_VISITEUR = 60 * 60 * 24 * 365;
const DUREE_COOKIE_SESSION_VISITE = 60 * 60;
const INTERVALLE_MINIMUM_VISITE_MS = DUREE_COOKIE_SESSION_VISITE * 1000;
const MOTIFS_ROBOT = [
    /bot/i,
    /crawl/i,
    /crawler/i,
    /spider/i,
    /slurp/i,
    /preview/i,
    /headless/i,
    /lighthouse/i,
    /facebookexternalhit/i,
    /whatsapp/i,
    /telegrambot/i,
    /slackbot/i,
    /discordbot/i,
    /curl/i,
    /wget/i,
    /python-requests/i,
    /axios/i,
    /monitor/i,
    /uptime/i
];
const ENTETES_JSON = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
};

function construireEntetes(entetesSupplementaires = {}) {
    const entetes = new Headers(ENTETES_JSON);

    Object.entries(entetesSupplementaires).forEach(([cle, valeur]) => {
        if (Array.isArray(valeur)) {
            valeur.filter(Boolean).forEach((element) => entetes.append(cle, element));
            return;
        }

        if (valeur) {
            entetes.set(cle, valeur);
        }
    });

    return entetes;
}

function reponseJson(corps, statut = 200, entetesSupplementaires = {}) {
    return new Response(JSON.stringify(corps), {
        status: statut,
        headers: construireEntetes(entetesSupplementaires)
    });
}

export const runtime = "nodejs";

function lireAttributsCookie(maxAge) {
    const attributs = [
        "Path=/",
        `Max-Age=${maxAge}`,
        "HttpOnly",
        "SameSite=Lax"
    ];

    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
        attributs.push("Secure");
    }

    return attributs;
}

function creerCookie(nom, valeur, maxAge) {
    return [
        `${nom}=${encodeURIComponent(valeur)}`,
        ...lireAttributsCookie(maxAge)
    ].join("; ");
}

function extraireCookies(request) {
    const cookie = request.headers.get("cookie") || "";

    return cookie.split(";").reduce((accumulateur, fragment) => {
        const [cle, ...reste] = fragment.trim().split("=");

        if (!cle) {
            return accumulateur;
        }

        try {
            accumulateur[cle] = decodeURIComponent(reste.join("="));
        } catch (erreur) {
            accumulateur[cle] = reste.join("=");
        }

        return accumulateur;
    }, {});
}

function extraireAdresseIp(request) {
    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const premiereAdresse = forwardedFor
        .split(",")
        .map((fragment) => fragment.trim())
        .find(Boolean);

    return premiereAdresse
        || request.headers.get("x-real-ip")
        || request.headers.get("cf-connecting-ip")
        || "";
}

function estRobot(request) {
    const agentUtilisateur = String(request.headers.get("user-agent") || "").trim();

    if (!agentUtilisateur) {
        return true;
    }

    return MOTIFS_ROBOT.some((motif) => motif.test(agentUtilisateur));
}

function creerIdentifiantServeur(request) {
    const agentUtilisateur = String(request.headers.get("user-agent") || "").trim();
    const adresseIp = extraireAdresseIp(request);

    if (!agentUtilisateur && !adresseIp) {
        return randomUUID();
    }

    return createHash("sha256")
        .update(`${adresseIp}|${agentUtilisateur}`)
        .digest("hex");
}

function normaliserIdentifiantClient(valeur) {
    const identifiant = String(valeur || "").trim();

    if (!identifiant || identifiant.length > 120) {
        return "";
    }

    return /^[a-z0-9-]+$/i.test(identifiant) ? identifiant : "";
}

function lireOuCreerIdentifiantVisiteur(request, identifiantClient) {
    const cookies = extraireCookies(request);
    const setCookies = [];
    const identifiantExistant = String(cookies[NOM_COOKIE_VISITEUR] || "").trim();

    if (identifiantExistant) {
        return {
            cookies,
            identifiantVisiteur: identifiantExistant,
            setCookies
        };
    }

    const identifiantVisiteur = normaliserIdentifiantClient(identifiantClient) || creerIdentifiantServeur(request);
    setCookies.push(creerCookie(NOM_COOKIE_VISITEUR, identifiantVisiteur, DUREE_COOKIE_VISITEUR));

    return {
        cookies,
        identifiantVisiteur,
        setCookies
    };
}

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
    if (estRobot(request)) {
        try {
            const resultat = await lireStatistiquesSitePartage();

            return reponseJson({
                statistiques: resultat.statistiques,
                shared: true,
                writable: resultat.writable,
                storage: resultat.storage,
                message: "Visite ignoree car un agent automatise a ete detecte."
            });
        } catch (erreur) {
            return reponseJson({
                message: erreur.message || "Impossible de lire la visite du site."
            }, 503);
        }
    }

    let donnees = {};

    try {
        donnees = await request.json();
    } catch (erreur) {
        donnees = {};
    }

    const {
        cookies,
        identifiantVisiteur,
        setCookies
    } = lireOuCreerIdentifiantVisiteur(request, donnees.visitorId);

    if (cookies[NOM_COOKIE_SESSION_VISITE] === "done") {
        try {
            const resultat = await lireStatistiquesSitePartage();

            return reponseJson({
                statistiques: resultat.statistiques,
                shared: true,
                writable: resultat.writable,
                storage: resultat.storage,
                message: "Visite deja comptabilisee pour cette session."
            }, 200, {
                "Set-Cookie": setCookies
            });
        } catch (erreur) {
            return reponseJson({
                message: erreur.message || "Impossible de lire la visite du site."
            }, 503);
        }
    }

    try {
        const resultat = await enregistrerVisiteSitePartage(identifiantVisiteur, {
            intervalleMinimumMs: INTERVALLE_MINIMUM_VISITE_MS
        });
        const cookiesReponse = [
            ...setCookies,
            creerCookie(NOM_COOKIE_SESSION_VISITE, "done", DUREE_COOKIE_SESSION_VISITE)
        ];

        return reponseJson({
            statistiques: resultat.statistiques,
            shared: true,
            writable: resultat.writable,
            storage: resultat.storage,
            message: resultat.message
        }, 200, {
            "Set-Cookie": cookiesReponse
        });
    } catch (erreur) {
        return reponseJson({
            message: erreur.message || "Impossible d'enregistrer la visite du site."
        }, 503);
    }
}
