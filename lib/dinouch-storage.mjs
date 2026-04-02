import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHEMIN_CATALOGUE_LOCAL = resolve(__dirname, "../data/catalogue.json");
const API_GITHUB = "https://api.github.com";
const PROPRIETAIRE_DEPOT_DEFAUT = "suphileericka-dotcom";
const NOM_DEPOT_DEFAUT = "Dinouch";

export function creerCatalogueParDefaut() {
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

export function creerIdentifiant(texte, index) {
    const base = String(texte || "produit")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return (base || "produit") + "-" + index;
}

export function normaliserProduit(produit, index) {
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

export function normaliserCatalogue(catalogue) {
    if (!Array.isArray(catalogue)) {
        return creerCatalogueParDefaut().map(normaliserProduit);
    }

    return catalogue.map(normaliserProduit);
}

export function catalogueNeContientQueDesExemples(catalogue) {
    return catalogue.length > 0 && catalogue.every((produit) => produit.estExemple);
}

function encoderCheminGithub(chemin) {
    return chemin.split("/").map(encodeURIComponent).join("/");
}

function lireConfigGithub() {
    const token = process.env.GITHUB_TOKEN || "";
    const proprietaire = process.env.GITHUB_REPO_OWNER || process.env.VERCEL_GIT_REPO_OWNER || PROPRIETAIRE_DEPOT_DEFAUT;
    const depot = process.env.GITHUB_REPO_NAME || process.env.VERCEL_GIT_REPO_SLUG || NOM_DEPOT_DEFAUT;
    const branche = process.env.GITHUB_REPO_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || "main";
    const chemin = process.env.GITHUB_CATALOGUE_PATH || "data/catalogue.json";

    return {
        token,
        proprietaire,
        depot,
        branche,
        chemin,
        actif: Boolean(token)
    };
}

function creerEntetesGithub(token) {
    const entetes = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    };

    if (token) {
        entetes.Authorization = `Bearer ${token}`;
    }

    return entetes;
}

async function lireCatalogueDepuisFichier() {
    try {
        const brut = await readFile(CHEMIN_CATALOGUE_LOCAL, "utf8");
        return normaliserCatalogue(JSON.parse(brut));
    } catch (erreur) {
        return creerCatalogueParDefaut().map(normaliserProduit);
    }
}

async function lireCatalogueDepuisGithub(configGithub) {
    const url = `${API_GITHUB}/repos/${configGithub.proprietaire}/${configGithub.depot}/contents/${encoderCheminGithub(configGithub.chemin)}?ref=${encodeURIComponent(configGithub.branche)}`;
    const reponse = await fetch(url, {
        headers: creerEntetesGithub(configGithub.token),
        cache: "no-store"
    });

    if (reponse.status === 404) {
        return {
            catalogue: await lireCatalogueDepuisFichier(),
            sha: null
        };
    }

    if (!reponse.ok) {
        throw new Error(`Lecture GitHub impossible (${reponse.status})`);
    }

    const donnees = await reponse.json();
    const contenu = Buffer.from(String(donnees.content || "").replace(/\n/g, ""), "base64").toString("utf8");

    return {
        catalogue: normaliserCatalogue(JSON.parse(contenu)),
        sha: donnees.sha || null
    };
}

async function ecrireCatalogueDansGithub(configGithub, catalogue, sha, messageCommit) {
    const url = `${API_GITHUB}/repos/${configGithub.proprietaire}/${configGithub.depot}/contents/${encoderCheminGithub(configGithub.chemin)}`;
    const contenu = Buffer.from(`${JSON.stringify(normaliserCatalogue(catalogue), null, 2)}\n`).toString("base64");
    const corps = {
        message: messageCommit,
        content: contenu,
        branch: configGithub.branche
    };

    if (sha) {
        corps.sha = sha;
    }

    const reponse = await fetch(url, {
        method: "PUT",
        headers: {
            ...creerEntetesGithub(configGithub.token),
            "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify(corps)
    });

    if (reponse.status === 409) {
        throw new Error("Catalogue modifie en meme temps, merci de reessayer.");
    }

    if (!reponse.ok) {
        throw new Error(`Ecriture GitHub impossible (${reponse.status})`);
    }
}

export async function lireCataloguePartage() {
    const configGithub = lireConfigGithub();

    if (configGithub.actif) {
        try {
            const resultat = await lireCatalogueDepuisGithub(configGithub);
            return {
                catalogue: resultat.catalogue,
                writable: true,
                storage: "github",
                message: ""
            };
        } catch (erreur) {
            return {
                catalogue: await lireCatalogueDepuisFichier(),
                writable: false,
                storage: "file",
                message: "La synchronisation GitHub est indisponible pour le moment."
            };
        }
    }

    return {
        catalogue: await lireCatalogueDepuisFichier(),
        writable: false,
        storage: "file",
        message: "Ajoutez GITHUB_TOKEN sur Vercel pour publier le catalogue sur tous les appareils."
    };
}

export async function lireCatalogueEditable() {
    const configGithub = lireConfigGithub();

    if (!configGithub.actif) {
        throw new Error("La publication partagee n'est pas encore configuree sur Vercel.");
    }

    return {
        configGithub,
        ...(await lireCatalogueDepuisGithub(configGithub))
    };
}

export async function enregistrerCataloguePartage(catalogue, messageCommit) {
    const { configGithub, sha } = await lireCatalogueEditable();

    await ecrireCatalogueDansGithub(configGithub, catalogue, sha, messageCommit);

    const resultat = await lireCatalogueDepuisGithub(configGithub);
    return {
        catalogue: resultat.catalogue,
        writable: true,
        storage: "github",
        message: ""
    };
}
