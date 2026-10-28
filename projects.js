/* Projects page: game modal and JobBoard screenshot viewer. */

const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");

const gameModal = document.querySelector("#game-modal");
const gameTitle = document.querySelector("#game-title");
const gameHelp = document.querySelector("#game-help");

const leftButton = document.querySelector("#game-left");
const rightButton = document.querySelector("#game-right");
const fireButton = document.querySelector("#game-fire");
const bombButton = document.querySelector("#game-bomb");
const restartButton = document.querySelector("#game-restart");

let activeGame = null;
let currentGameCleanup = null;

function refreshGameHelp() {
    if (activeGame === "hangman") {
        gameHelp.textContent = currentLanguage === "fr"
            ? "Clavier ou boutons : choisissez une lettre • Indice : coûte 1 vie • Entrée : mot suivant"
            : "Keyboard or buttons: pick a letter • Hint: costs 1 life • Enter: next word";
    }

    if (activeGame === "dodge") {
        gameHelp.textContent = currentLanguage === "fr"
            ? "Flèches / ZQSD : bouger • Espace : tirer • X : bombe • P : pause • M : son • Mobile : glissez sur l'écran"
            : "Arrows / WASD: move • Space: fire • X: bomb • P: pause • M: sound • Mobile: drag on the screen";
    }
}

/* ---------- game modal ---------- */

function stopCurrentGame() {
    if (typeof currentGameCleanup === "function") {
        currentGameCleanup();
    }

    currentGameCleanup = null;
    activeGame = null;
}


function openGame(game) {
    stopCurrentGame();
    activeGame = game;

    gameModal.classList.add("open");
    gameModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("game-open");

    currentGameCleanup = game === "hangman" ? startHangman() : startDodge();
}


function closeGame() {
    stopCurrentGame();

    gameModal.classList.remove("open");
    gameModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("game-open");
}


document.querySelectorAll(".game-launch").forEach((button) => {
    button.addEventListener("click", () => openGame(button.dataset.game));
});

document.querySelector("#game-close").addEventListener("click", closeGame);
document.querySelector("[data-game-close]").addEventListener("click", closeGame);

window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && gameModal.classList.contains("open")) {
        closeGame();
    }
});


/* Screenshot viewer for the JobBoard card */
const shotsModal = document.querySelector("#shots-modal");
const shotsView = document.querySelector("#shots-view");
const shots = [
    { src: "assets/games/previews/jobboard.webp", fr: "Capture du JobBoard : page d'accueil avec la recherche d'emploi et la liste des offres", en: "JobBoard screenshot: home page with job search and the list of offers" },
    { src: "assets/games/previews/jobboard-offre.webp", fr: "JobBoard : détail d'une offre", en: "JobBoard: job offer details" }
];

function showShot(index) {
    const shot = shots[index];
    shotsView.src = shot.src;
    shotsView.alt = currentLanguage === "fr" ? shot.fr : shot.en;
    document.querySelectorAll(".shots-thumb").forEach((thumb) => {
        thumb.setAttribute("aria-pressed", String(Number(thumb.dataset.shot) === index));
    });
}

function openShots(index) {
    showShot(index);
    shotsModal.classList.add("open");
    shotsModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("game-open");
}

function closeShots() {
    shotsModal.classList.remove("open");
    shotsModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("game-open");
}

document.querySelectorAll(".shots-launch").forEach((button) => {
    button.addEventListener("click", () => openShots(Number(button.dataset.shot)));
});

document.querySelectorAll(".shots-thumb").forEach((thumb) => {
    thumb.addEventListener("click", () => showShot(Number(thumb.dataset.shot)));
});

document.querySelector("#shots-close").addEventListener("click", closeShots);
document.querySelector("[data-shots-close]").addEventListener("click", closeShots);

window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && shotsModal.classList.contains("open")) {
        closeShots();
    }
});
