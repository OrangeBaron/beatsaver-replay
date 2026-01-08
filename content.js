function replaceOneClickButton(button) {
    if (button.dataset.processed) return;
    button.dataset.processed = "true";

    const href = button.getAttribute("href");
    if (!href || !href.startsWith("beatsaver://")) return;
    
    const mapKey = href.split("//")[1];
    
    // Modifica estetica pulsante
    button.removeAttribute("href");
    button.style.cursor = "pointer";
    button.title = `Replay`;
    button.setAttribute("aria-label", "BeatLeader Replay");

    const textSpan = button.querySelector(".dd-text");
    if (textSpan) {
        textSpan.textContent = "BeatLeader";
        textSpan.style.color = "#d65692";
    }
    
    const icon = button.querySelector("i");
    if (icon) {
        icon.className = "fas fa-trophy";
        icon.style.color = "#d65692";
    }

    // --- CLICK LISTENER ---
    button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (textSpan) textSpan.textContent = "Cercando...";

        // Chiediamo al background di fare tutto il lavoro
        chrome.runtime.sendMessage({ 
            action: "findReplay", 
            mapKey: mapKey
            // NON inviamo più diffSuffix, se lo calcola lui
        }, (response) => {
            
            // Default suffix se qualcosa va storto
            const suffix = (response && response.suffix) ? response.suffix : "91";
            const leaderboardUrl = `https://beatleader.com/leaderboard/global/${mapKey}${suffix}`;

            if (chrome.runtime.lastError || !response) {
                console.error("Errore Ext:", chrome.runtime.lastError);
                window.open(leaderboardUrl, '_blank');
                return;
            }

            if (response.found) {
                // TROVATO REPLAY
                const replayUrl = `https://replay.beatleader.com/?scoreId=${response.scoreId}`;
                window.open(replayUrl, '_blank');
                if (textSpan) textSpan.textContent = "Replay!";
            } else {
                // NON TROVATO (ma abbiamo il suffisso corretto per la leaderboard!)
                console.log("Nessun replay, apro leaderboard corretta:", suffix);
                window.open(leaderboardUrl, '_blank');
                if (textSpan) textSpan.textContent = "Leaderboard";
            }

            setTimeout(() => {
                 if (textSpan) textSpan.textContent = "BeatLeader";
            }, 3000);
        });
    });
}

function scanForButtons() {
    const buttons = document.querySelectorAll('a[href^="beatsaver://"]');
    buttons.forEach(replaceOneClickButton);
}

const observer = new MutationObserver((mutations) => {
    scanForButtons();
});

observer.observe(document.body, { childList: true, subtree: true });
scanForButtons();