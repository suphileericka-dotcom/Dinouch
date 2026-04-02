import { createHmac, timingSafeEqual } from "node:crypto";

const NOM_COOKIE_SESSION = "dinouch_admin_session";
const DUREE_SESSION = 60 * 60 * 24 * 7;

function encoderBase64Url(valeur) {
    return Buffer.from(valeur).toString("base64url");
}

function decoderBase64Url(valeur) {
    return Buffer.from(valeur, "base64url").toString("utf8");
}

function lireSecretSession() {
    return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "@16Dinou";
}

function lireAttributsCookie(maxAge) {
    const attributs = [
        "Path=/",
        `Max-Age=${maxAge}`,
        "HttpOnly",
        "SameSite=Strict"
    ];

    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
        attributs.push("Secure");
    }

    return attributs;
}

function signer(valeur) {
    return createHmac("sha256", lireSecretSession()).update(valeur).digest("base64url");
}

function extraireCookies(request) {
    const cookie = request.headers.get("cookie") || "";
    return cookie.split(";").reduce((accumulateur, fragment) => {
        const [cle, ...reste] = fragment.trim().split("=");
        if (!cle) {
            return accumulateur;
        }

        accumulateur[cle] = reste.join("=");
        return accumulateur;
    }, {});
}

export function lireMotDePasseAdmin() {
    return process.env.ADMIN_PASSWORD || "@16Dinou";
}

export function creerCookieSession() {
    const chargeUtile = encoderBase64Url(JSON.stringify({
        exp: Date.now() + (DUREE_SESSION * 1000)
    }));
    const signature = signer(chargeUtile);

    return [
        `${NOM_COOKIE_SESSION}=${chargeUtile}.${signature}`,
        ...lireAttributsCookie(DUREE_SESSION)
    ].join("; ");
}

export function effacerCookieSession() {
    return [
        `${NOM_COOKIE_SESSION}=`,
        ...lireAttributsCookie(0)
    ].join("; ");
}

export function sessionAdminValide(request) {
    const cookies = extraireCookies(request);
    const jeton = cookies[NOM_COOKIE_SESSION];

    if (!jeton || !jeton.includes(".")) {
        return false;
    }

    const [chargeUtile, signature] = jeton.split(".");
    const signatureAttendue = signer(chargeUtile);

    try {
        const bufferSignature = Buffer.from(signature);
        const bufferSignatureAttendue = Buffer.from(signatureAttendue);

        if (bufferSignature.length !== bufferSignatureAttendue.length) {
            return false;
        }

        if (!timingSafeEqual(bufferSignature, bufferSignatureAttendue)) {
            return false;
        }

        const session = JSON.parse(decoderBase64Url(chargeUtile));
        return Number(session.exp) > Date.now();
    } catch (erreur) {
        return false;
    }
}
