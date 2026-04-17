import { lireCataloguePartage } from "../lib/dinouch-storage.mjs";

const ENTETES_HTML = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
};

export const runtime = "nodejs";

function reponseHtml(contenu, statut = 200) {
    return new Response(contenu, {
        status: statut,
        headers: ENTETES_HTML
    });
}

function echapperHtml(valeur) {
    return String(valeur).replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[caractere]));
}

function formaterPrix(prix) {
    return new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Number(prix) || 0) + " FCF";
}

function decoderItems(itemsBruts) {
    return String(itemsBruts || "")
        .split(",")
        .map((bloc) => bloc.trim())
        .filter(Boolean)
        .map((bloc) => {
            const [idBrut = "", tailleBrute = "", quantiteBrute = "1"] = bloc.split("::");

            return {
                id: decodeURIComponent(idBrut || ""),
                taille: decodeURIComponent(tailleBrute || ""),
                quantite: Math.max(1, Math.min(50, Number(quantiteBrute) || 1))
            };
        })
        .filter((ligne) => ligne.id);
}

function tailleValidePourProduit(taille, produit) {
    const tailles = Array.isArray(produit?.tailles) && produit.tailles.length
        ? produit.tailles.map((valeur) => String(valeur))
        : ["Unique"];
    const tailleDemandee = String(taille || "");

    return tailles.includes(tailleDemandee) ? tailleDemandee : tailles[0];
}

function construireLignesPartage(catalogue, items) {
    const produitsPublies = new Map(
        (Array.isArray(catalogue) ? catalogue : [])
            .filter((produit) => Boolean(String(produit?.image || "").trim()))
            .map((produit) => [String(produit.id), produit])
    );

    return items.reduce((accumulateur, item) => {
        const produit = produitsPublies.get(String(item.id || ""));

        if (!produit) {
            return accumulateur;
        }

        accumulateur.push({
            produit,
            taille: tailleValidePourProduit(item.taille, produit),
            quantite: Math.max(1, Number(item.quantite) || 1)
        });
        return accumulateur;
    }, []);
}

function construireDescriptionPanier(lignes) {
    if (!lignes.length) {
        return "Decouvrez la selection partagee depuis la boutique DINOUCH.";
    }

    const descriptionArticles = lignes.slice(0, 3).map((ligne) => {
        const prefixeQuantite = ligne.quantite > 1 ? `${ligne.quantite} x ` : "";
        return `${prefixeQuantite}${ligne.produit.nom} (${ligne.taille})`;
    }).join(", ");
    const autresArticles = lignes.length - Math.min(lignes.length, 3);
    const suffixe = autresArticles > 0 ? `, +${autresArticles} autre(s)` : "";
    const total = lignes.reduce((somme, ligne) => somme + ((Number(ligne.produit.prix) || 0) * ligne.quantite), 0);

    return `${descriptionArticles}${suffixe}. Total estime : ${formaterPrix(total)}.`;
}

function construireTitrePanier(lignes) {
    const nombreArticles = lignes.reduce((somme, ligne) => somme + ligne.quantite, 0);

    if (!nombreArticles) {
        return "Panier partage DINOUCH";
    }

    return nombreArticles > 1
        ? `Panier partage DINOUCH - ${nombreArticles} articles`
        : `Panier partage DINOUCH - ${lignes[0].produit.nom}`;
}

function construireCorpsPage({ titre, description, lignes, urlBoutique }) {
    if (!lignes.length) {
        return `
            <section class="card">
                <p class="eyebrow">Partage DINOUCH</p>
                <h1>${echapperHtml(titre)}</h1>
                <p class="description">${echapperHtml(description)}</p>
                <a class="cta" href="${echapperHtml(urlBoutique)}">Ouvrir la boutique</a>
            </section>
        `;
    }

    const cartes = lignes.map((ligne) => {
        const totalLigne = (Number(ligne.produit.prix) || 0) * ligne.quantite;
        const quantite = ligne.quantite > 1
            ? `<span class="badge">${ligne.quantite} x</span>`
            : "";

        return `
            <article class="product">
                <img src="${echapperHtml(ligne.produit.image || "")}" alt="${echapperHtml(ligne.produit.nom)}">
                <div class="product-copy">
                    <div class="product-top">
                        <h2>${echapperHtml(ligne.produit.nom)}</h2>
                        ${quantite}
                    </div>
                    <p class="meta">Taille : ${echapperHtml(ligne.taille)}</p>
                    <p class="price">${echapperHtml(formaterPrix(totalLigne))}</p>
                </div>
            </article>
        `;
    }).join("");

    return `
        <section class="card">
            <p class="eyebrow">Partage DINOUCH</p>
            <h1>${echapperHtml(titre)}</h1>
            <p class="description">${echapperHtml(description)}</p>
            <div class="products">${cartes}</div>
            <a class="cta" href="${echapperHtml(urlBoutique)}">Ouvrir la boutique</a>
        </section>
    `;
}

export async function GET(request) {
    const url = new URL(request.url);
    const origine = url.origin;
    const urlBoutique = new URL("/index.html", origine).toString();
    const items = decoderItems(url.searchParams.get("items"));
    const { catalogue } = await lireCataloguePartage();
    const lignes = construireLignesPartage(catalogue, items);
    const titre = construireTitrePanier(lignes);
    const description = construireDescriptionPanier(lignes);
    const imagePartage = lignes.find((ligne) => String(ligne.produit.image || "").trim())?.produit.image || "";
    const corpsPage = construireCorpsPage({
        titre,
        description,
        lignes,
        urlBoutique
    });
    const metaImage = imagePartage
        ? `
        <meta property="og:image" content="${echapperHtml(imagePartage)}">
        <meta name="twitter:image" content="${echapperHtml(imagePartage)}">
    `
        : "";

    return reponseHtml(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${echapperHtml(titre)}</title>
    <meta name="description" content="${echapperHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${echapperHtml(titre)}">
    <meta property="og:description" content="${echapperHtml(description)}">
    <meta property="og:url" content="${echapperHtml(url.toString())}">
    ${metaImage}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${echapperHtml(titre)}">
    <meta name="twitter:description" content="${echapperHtml(description)}">
    <style>
        :root {
            color-scheme: light;
            --fond: #f6efe8;
            --carte: #ffffff;
            --texte: #2f2d2b;
            --texte-secondaire: #6d6760;
            --accent: #705b44;
            --accent-clair: #efe2d4;
            --bordure: rgba(47, 45, 43, 0.08);
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            font-family: Inter, Arial, sans-serif;
            background:
                radial-gradient(circle at top left, rgba(112, 91, 68, 0.15), transparent 32%),
                linear-gradient(180deg, #f8f1ea 0%, var(--fond) 100%);
            color: var(--texte);
        }

        main {
            width: min(760px, calc(100% - 32px));
            margin: 0 auto;
            padding: 40px 0;
        }

        .card {
            border: 1px solid var(--bordure);
            border-radius: 28px;
            background: rgba(255, 255, 255, 0.92);
            padding: 28px;
            box-shadow: 0 24px 50px rgba(47, 45, 43, 0.08);
            backdrop-filter: blur(12px);
        }

        .eyebrow {
            margin: 0 0 12px;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.28em;
            text-transform: uppercase;
            color: var(--accent);
        }

        h1 {
            margin: 0;
            font-size: clamp(30px, 5vw, 44px);
            line-height: 1.05;
        }

        .description {
            margin: 16px 0 0;
            color: var(--texte-secondaire);
            line-height: 1.6;
        }

        .products {
            margin-top: 24px;
            display: grid;
            gap: 16px;
        }

        .product {
            display: grid;
            grid-template-columns: 116px 1fr;
            gap: 16px;
            border: 1px solid var(--bordure);
            border-radius: 22px;
            background: #fff;
            padding: 12px;
        }

        .product img {
            width: 100%;
            height: 124px;
            border-radius: 18px;
            object-fit: cover;
            background: var(--accent-clair);
        }

        .product-copy {
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .product-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
        }

        h2 {
            margin: 0;
            font-size: 18px;
            line-height: 1.25;
        }

        .meta {
            margin: 10px 0 0;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            color: var(--texte-secondaire);
        }

        .price {
            margin: 14px 0 0;
            font-size: 16px;
            font-weight: 800;
            color: var(--accent);
        }

        .badge {
            flex-shrink: 0;
            border-radius: 999px;
            background: var(--accent-clair);
            padding: 6px 10px;
            font-size: 11px;
            font-weight: 800;
            color: var(--accent);
        }

        .cta {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-top: 24px;
            border-radius: 999px;
            background: var(--accent);
            padding: 14px 24px;
            color: #fff;
            font-weight: 800;
            text-decoration: none;
        }

        @media (max-width: 640px) {
            main {
                width: min(100%, calc(100% - 24px));
                padding: 24px 0;
            }

            .card {
                padding: 20px;
                border-radius: 24px;
            }

            .product {
                grid-template-columns: 1fr;
            }

            .product img {
                height: 220px;
            }
        }
    </style>
</head>
<body>
    <main>
        ${corpsPage}
    </main>
</body>
</html>`);
}
