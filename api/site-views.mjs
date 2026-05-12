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

function reponseDesactivee() {
    return {
        statistiques: {
            visitesTotales: 0,
            visiteursUniquesEstimes: 0,
            derniereVisite: "",
            fuseauHoraire: "Europe/Paris",
            historiqueLimite: 0,
            jourActuel: {
                date: "",
                visitesTotales: 0,
                visiteursUniquesEstimes: 0
            },
            historiqueJournalier: []
        },
        shared: false,
        writable: false,
        storage: "disabled",
        message: "Le compteur de visites a ete retire pour stabiliser l'hebergement."
    };
}

export async function GET() {
    return reponseJson(reponseDesactivee());
}

export async function POST() {
    return reponseJson(reponseDesactivee());
}
