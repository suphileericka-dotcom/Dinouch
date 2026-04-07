import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHEMIN_CATALOGUE_LOCAL = resolve(__dirname, "../data/catalogue.json");
const CHEMIN_STATS_LOCAL = resolve(__dirname, "../data/site-stats.json");
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

export function creerStatistiquesSiteParDefaut() {
    return {
        visitesTotales: 0,
        visiteursUniquesEstimes: 0,
        derniereVisite: "",
        visiteurs: {}
    };
}

export function normaliserStatistiquesSite(statistiques) {
    const visiteursBruts = statistiques && typeof statistiques.visiteurs === "object" && !Array.isArray(statistiques.visiteurs)
        ? statistiques.visiteurs
        : {};
    const visiteurs = Object.fromEntries(
        Object.entries(visiteursBruts).map(([identifiant, date]) => [String(identifiant), String(date || "")])
    );

    return {
        visitesTotales: Math.max(0, Number(statistiques?.visitesTotales) || 0),
        visiteursUniquesEstimes: Math.max(
            Number(statistiques?.visiteursUniquesEstimes) || 0,
            Object.keys(visiteurs).length
        ),
        derniereVisite: String(statistiques?.derniereVisite || ""),
        visiteurs
    };
}

export function extraireStatistiquesSitePubliques(statistiques) {
    const statistiquesNormalisees = normaliserStatistiquesSite(statistiques);

    return {
        visitesTotales: statistiquesNormalisees.visitesTotales,
        visiteursUniquesEstimes: statistiquesNormalisees.visiteursUniquesEstimes,
        derniereVisite: statistiquesNormalisees.derniereVisite
    };
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
    const cheminCatalogue = process.env.GITHUB_CATALOGUE_PATH || "data/catalogue.json";
    const cheminStatistiques = process.env.GITHUB_SITE_STATS_PATH || "data/site-stats.json";

    return {
        token,
        proprietaire,
        depot,
        branche,
        cheminCatalogue,
        cheminStatistiques,
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

async function lireJsonDepuisFichier(chemin, creerValeurParDefaut, normaliserValeur) {
    try {
        const brut = await readFile(chemin, "utf8");
        return normaliserValeur(JSON.parse(brut));
    } catch (erreur) {
        return normaliserValeur(creerValeurParDefaut());
    }
}

async function lireFichierDepuisGithub(configGithub, chemin) {
    const url = `${API_GITHUB}/repos/${configGithub.proprietaire}/${configGithub.depot}/contents/${encoderCheminGithub(chemin)}?ref=${encodeURIComponent(configGithub.branche)}`;
    const reponse = await fetch(url, {
        headers: creerEntetesGithub(configGithub.token),
        cache: "no-store"
    });

    if (reponse.status === 404) {
        return {
            donnees: null,
            sha: null
        };
    }

    if (!reponse.ok) {
        throw new Error(`Lecture GitHub impossible (${reponse.status})`);
    }

    const donnees = await reponse.json();
    const contenu = Buffer.from(String(donnees.content || "").replace(/\n/g, ""), "base64").toString("utf8");

    return {
        donnees: JSON.parse(contenu),
        sha: donnees.sha || null
    };
}

async function ecrireJsonDansGithub(configGithub, chemin, donnees, sha, messageCommit) {
    const url = `${API_GITHUB}/repos/${configGithub.proprietaire}/${configGithub.depot}/contents/${encoderCheminGithub(chemin)}`;
    const contenu = Buffer.from(`${JSON.stringify(donnees, null, 2)}\n`).toString("base64");
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
        throw new Error("Fichier modifie en meme temps, merci de reessayer.");
    }

    if (!reponse.ok) {
        throw new Error(`Ecriture GitHub impossible (${reponse.status})`);
    }
}

async function lireCatalogueDepuisFichier() {
    return lireJsonDepuisFichier(CHEMIN_CATALOGUE_LOCAL, creerCatalogueParDefaut, normaliserCatalogue);
}

async function lireCatalogueDepuisGithub(configGithub) {
    const resultat = await lireFichierDepuisGithub(configGithub, configGithub.cheminCatalogue);

    if (!resultat.donnees) {
        return {
            catalogue: await lireCatalogueDepuisFichier(),
            sha: null
        };
    }

    return {
        catalogue: normaliserCatalogue(resultat.donnees),
        sha: resultat.sha
    };
}

async function ecrireCatalogueDansGithub(configGithub, catalogue, sha, messageCommit) {
    await ecrireJsonDansGithub(
        configGithub,
        configGithub.cheminCatalogue,
        normaliserCatalogue(catalogue),
        sha,
        messageCommit
    );
}

async function lireStatistiquesSiteDepuisFichier() {
    return lireJsonDepuisFichier(CHEMIN_STATS_LOCAL, creerStatistiquesSiteParDefaut, normaliserStatistiquesSite);
}

async function lireStatistiquesSiteDepuisGithub(configGithub) {
    const resultat = await lireFichierDepuisGithub(configGithub, configGithub.cheminStatistiques);

    if (!resultat.donnees) {
        return {
            statistiques: await lireStatistiquesSiteDepuisFichier(),
            sha: null
        };
    }

    return {
        statistiques: normaliserStatistiquesSite(resultat.donnees),
        sha: resultat.sha
    };
}

async function ecrireStatistiquesSiteDansGithub(configGithub, statistiques, sha, messageCommit) {
    await ecrireJsonDansGithub(
        configGithub,
        configGithub.cheminStatistiques,
        normaliserStatistiquesSite(statistiques),
        sha,
        messageCommit
    );
}

function creerEmpreinteVisiteur(identifiantVisiteur) {
    const identifiant = String(identifiantVisiteur || "").trim();

    if (!identifiant) {
        throw new Error("Identifiant visiteur manquant.");
    }

    return createHash("sha256").update(identifiant).digest("hex");
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

export async function lireStatistiquesSitePartage() {
    const configGithub = lireConfigGithub();

    if (configGithub.actif) {
        try {
            const resultat = await lireStatistiquesSiteDepuisGithub(configGithub);
            return {
                statistiques: extraireStatistiquesSitePubliques(resultat.statistiques),
                writable: true,
                storage: "github",
                message: ""
            };
        } catch (erreur) {
            return {
                statistiques: extraireStatistiquesSitePubliques(await lireStatistiquesSiteDepuisFichier()),
                writable: false,
                storage: "file",
                message: "La synchronisation GitHub des statistiques est indisponible pour le moment."
            };
        }
    }

    return {
        statistiques: extraireStatistiquesSitePubliques(await lireStatistiquesSiteDepuisFichier()),
        writable: false,
        storage: "file",
        message: "Ajoutez GITHUB_TOKEN sur Vercel pour compter les visites sur tous les appareils."
    };
}

export async function lireStatistiquesSiteEditable() {
    const configGithub = lireConfigGithub();

    if (!configGithub.actif) {
        throw new Error("Le comptage partage des visites n'est pas encore configure sur Vercel.");
    }

    return {
        configGithub,
        ...(await lireStatistiquesSiteDepuisGithub(configGithub))
    };
}

export async function enregistrerVisiteSitePartage(identifiantVisiteur) {
    const empreinteVisiteur = creerEmpreinteVisiteur(identifiantVisiteur);
    const maximumTentatives = 3;

    for (let tentative = 0; tentative < maximumTentatives; tentative += 1) {
        const { configGithub, statistiques, sha } = await lireStatistiquesSiteEditable();
        const maintenant = new Date().toISOString();
        const dejaVu = Boolean(statistiques.visiteurs[empreinteVisiteur]);
        const prochainesStatistiques = normaliserStatistiquesSite({
            ...statistiques,
            visitesTotales: statistiques.visitesTotales + 1,
            visiteursUniquesEstimes: dejaVu
                ? statistiques.visiteursUniquesEstimes
                : statistiques.visiteursUniquesEstimes + 1,
            derniereVisite: maintenant,
            visiteurs: {
                ...statistiques.visiteurs,
                [empreinteVisiteur]: maintenant
            }
        });

        try {
            await ecrireStatistiquesSiteDansGithub(
                configGithub,
                prochainesStatistiques,
                sha,
                "Enregistrer une visite du site"
            );

            return {
                statistiques: extraireStatistiquesSitePubliques(prochainesStatistiques),
                writable: true,
                storage: "github",
                message: ""
            };
        } catch (erreur) {
            const message = String(erreur.message || "");
            const conflitEcriture = message.includes("modifie en meme temps");

            if (!conflitEcriture || tentative === maximumTentatives - 1) {
                throw erreur;
            }
        }
    }

    throw new Error("Impossible d'enregistrer la visite du site.");
}
