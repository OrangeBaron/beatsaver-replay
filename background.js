// Mappa per convertire stringhe BeatSaver -> Valori BeatLeader
const DIFF_PRIORITY = {
    "ExpertPlus": 9,
    "Expert": 7,
    "Hard": 5,
    "Normal": 3,
    "Easy": 1
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "findReplay") {
        findReplayId(request.mapKey)
            .then(result => {
                // result contiene: { found: bool, scoreId: string, suffix: string }
                sendResponse(result);
            })
            .catch(err => {
                console.error("Errore Background:", err);
                // In caso di errore grave, fallback su Expert+ (91)
                sendResponse({ found: false, suffix: "91", error: err.toString() });
            });
        
        return true; 
    }
});

async function findReplayId(mapKey) {
    try {
        // 1. Ottieni dati da BeatSaver
        const bsResponse = await fetch(`https://api.beatsaver.com/maps/id/${mapKey}`);
        if (!bsResponse.ok) throw new Error("BeatSaver API error");
        const bsData = await bsResponse.json();
        
        const latestVersion = bsData.versions[0];
        const hash = latestVersion.hash;

        // 2. Determina la difficoltà MIGLIORE disponibile (Standard mode)
        // Filtriamo solo le diff 'Standard'
        const standardDiffs = latestVersion.diffs.filter(d => d.characteristic === "Standard");
        
        let bestDiffValue = 9; // Default Expert+
        let bestDiffName = "ExpertPlus";

        // Cerchiamo la difficoltà più alta presente nella mappa
        const priorityKeys = ["ExpertPlus", "Expert", "Hard", "Normal", "Easy"];
        for (const key of priorityKeys) {
            if (standardDiffs.some(d => d.difficulty === key)) {
                bestDiffValue = DIFF_PRIORITY[key];
                bestDiffName = key;
                break; // Trovata la più alta, ci fermiamo
            }
        }

        // Costruiamo il suffisso (es. 91, 71, etc.)
        // Nota: Assumiamo sempre Standard (1) come mode
        const currentSuffix = `${bestDiffValue}1`;

        // 3. Ottieni la lista delle leaderboard da BeatLeader
        const blResponse = await fetch(`https://api.beatleader.xyz/leaderboards/hash/${hash}`);
        const blData = await blResponse.json();
        
        const leaderboards = blData.leaderboards || blData; // Gestione array o oggetto
        
        // Trova la leaderboard specifica usando il valore calcolato
        const specificLb = leaderboards.find(lb => 
            lb.difficulty.value === bestDiffValue && 
            lb.difficulty.modeName === "Standard"
        );

        // Se non esiste la leaderboard (strano se la mappa ha la diff, ma possibile), restituiamo il suffisso per il fallback
        if (!specificLb) {
            return { found: false, suffix: currentSuffix };
        }

        // 4. Cerchiamo il punteggio
        const scoresResponse = await fetch(`https://api.beatleader.xyz/leaderboard/${specificLb.id}?page=1&count=1`);
        const scoresData = await scoresResponse.json();

        if (scoresData.scores && scoresData.scores.length > 0) {
            return { found: true, scoreId: scoresData.scores[0].id, suffix: currentSuffix };
        }

        // Nessun punteggio trovato, ma sappiamo il suffisso corretto per la pagina classifica
        return { found: false, suffix: currentSuffix };

    } catch (error) {
        console.error("Errore ricerca API:", error);
        return { found: false, suffix: "91" }; // Fallback di sicurezza
    }
}