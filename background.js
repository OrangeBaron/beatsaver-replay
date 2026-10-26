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
            .then(result => sendResponse(result))
            .catch(err => {
                console.error("Errore Background:", err);
                sendResponse({ found: false, suffix: "91", error: err.toString() });
            });
        return true; 
    }
});

async function findReplayId(mapKey) {
    try {
        // 1. Dati da BeatSaver
        console.log("1. Cerco su BeatSaver la mappa:", mapKey);
        const bsResponse = await fetch(`https://api.beatsaver.com/maps/id/${mapKey}`);
        if (!bsResponse.ok) throw new Error("BeatSaver API error");
        const bsData = await bsResponse.json();
        
        const latestVersion = bsData.versions[0];
        const hash = latestVersion.hash;
        console.log("Hash trovato:", hash);

        // 2. Determina la difficoltà MIGLIORE (Standard)
        const standardDiffs = latestVersion.diffs.filter(d => d.characteristic === "Standard");
        let bestDiffValue = 9;
        let bestDiffName = "ExpertPlus";
        const priorityKeys = ["ExpertPlus", "Expert", "Hard", "Normal", "Easy"];
        
        for (const key of priorityKeys) {
            if (standardDiffs.some(d => d.difficulty === key)) {
                bestDiffValue = DIFF_PRIORITY[key];
                bestDiffName = key;
                break;
            }
        }
        const currentSuffix = `${bestDiffValue}1`;
        console.log("Difficoltà scelta:", bestDiffName, "- Suffisso previsto:", currentSuffix);

        // 3. Ottieni le leaderboard da BeatLeader (Usiamo il dominio .com)
        console.log("2. Cerco la leaderboard su BeatLeader per l'hash:", hash);
        const blResponse = await fetch(`https://api.beatleader.com/leaderboards/hash/${hash}`);
        
        let lbId = `${hash}${currentSuffix}`; // Fallback ID

        if (blResponse.ok) {
            const blData = await blResponse.json();
            const leaderboards = blData.leaderboards || blData;
            
            if (Array.isArray(leaderboards)) {
                // Cerchiamo la leaderboard in modo più flessibile
                const specificLb = leaderboards.find(lb => 
                    lb.difficulty && 
                    (lb.difficulty.value === bestDiffValue || lb.difficulty.difficultyName === bestDiffName) &&
                    (lb.difficulty.modeName === "Standard" || lb.difficulty.mode === 1)
                );

                if (specificLb && specificLb.id) {
                    console.log("Leaderboard trovata tramite API! ID esatto:", specificLb.id);
                    lbId = specificLb.id;
                } else {
                    console.warn("Leaderboard specifica non trovata nell'array. Uso ID manuale.");
                }
            } else {
                console.warn("Struttura dati imprevista da /leaderboards/hash/");
            }
        } else {
            console.warn("Nessuna mappa trovata in /leaderboards/hash/. Status:", blResponse.status);
        }

        // 4. Cerchiamo il punteggio migliore
        console.log("3. Cerco i punteggi per la leaderboard:", lbId);
        const scoresResponse = await fetch(`https://api.beatleader.com/leaderboard/${lbId}?page=1&count=1`);
        
        if (!scoresResponse.ok) {
            console.error("Errore fetch punteggi. Status:", scoresResponse.status);
            return { found: false, suffix: currentSuffix };
        }
        
        const scoresData = await scoresResponse.json();
        // Controlliamo vari nomi possibili dell'array dei punteggi
        const scoreList = scoresData.scores || scoresData.plays || scoresData.data;
        
        if (scoreList && scoreList.length > 0) {
            console.log("Trovato replay! ID:", scoreList[0].id);
            return { found: true, scoreId: scoreList[0].id, suffix: currentSuffix };
        }
        
        console.log("Nessun punteggio presente in questa leaderboard (array vuoto).");
        return { found: false, suffix: currentSuffix };

    } catch (error) {
        console.error("Errore ricerca API generale:", error);
        return { found: false, suffix: "91" }; // Fallback
    }
}