/* =========================================================
   GAMES — Hangman & Dodge Game
   Played inside the game modal of index.html / portfolio.html.

   Relies on globals from script.js (loaded first):
   canvas, ctx, gameTitle, leftButton, rightButton, fireButton,
   bombButton, restartButton, currentLanguage, activeGame,
   safeGet, safeSet, refreshGameHelp.

   Credits
   - Sounds: Kenney "Space Shooter Redux" (CC0)
   - Photos: Unsplash (Unsplash License)
========================================================= */


/* =========================================================
   SHARED HELPERS
========================================================= */

const GAME_W = 800;
const GAME_H = 600;

const SPACE_PATH = "assets/games/space/";

const UI_FONT = '"Manrope", "Inter", sans-serif';


function tr(fr, en) {
    return currentLanguage === "en" ? en : fr;
}


function rand(min, max) {
    return min + Math.random() * (max - min);
}


function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}


function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }

    return list;
}


function stripAccents(text) {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}


function loadImage(src, crossOrigin = false) {
    const image = new Image();

    if (crossOrigin) {
        image.crossOrigin = "anonymous";
    }

    image.decoding = "async";
    image.src = src;

    return image;
}


function imageReady(image) {
    return Boolean(image && image.complete && image.naturalWidth > 0);
}


/* Sharp canvas on high-density screens, 800x600 logical units. */
function setupGameCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = GAME_W * ratio;
    canvas.height = GAME_H * ratio;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = true;
}


function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left) * GAME_W / rect.width,
        y: (event.clientY - rect.top) * GAME_H / rect.height
    };
}


function roundRectPath(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}


function showGameButtons(visible) {
    leftButton.style.display = visible.left ? "inline-flex" : "none";
    rightButton.style.display = visible.right ? "inline-flex" : "none";
    fireButton.style.display = visible.fire ? "inline-flex" : "none";
    bombButton.style.display = visible.bomb ? "inline-flex" : "none";
    restartButton.style.display = visible.restart ? "inline-flex" : "none";
}


/* Keeps track of listeners so each game can clean up after itself. */
function createListenerBag() {
    const items = [];

    return {
        on(target, type, handler, options) {
            target.addEventListener(type, handler, options);
            items.push([target, type, handler, options]);
        },

        clear() {
            items.forEach(([target, type, handler, options]) => {
                target.removeEventListener(type, handler, options);
            });

            items.length = 0;
        }
    };
}


/* =========================================================
   SOUND
========================================================= */

const gameAudio = {

    muted: safeGet("game-muted") === "1",

    supported: (() => {
        try {
            return document
                .createElement("audio")
                .canPlayType('audio/ogg; codecs="vorbis"') !== "";
        } catch (error) {
            return false;
        }
    })(),

    sources: {},

    play(name, volume = 0.3, rate = 1) {
        if (this.muted || !this.supported) {
            return;
        }

        if (!this.sources[name]) {
            const source = new Audio(`${SPACE_PATH}sfx/${name}.ogg`);
            source.preload = "auto";
            this.sources[name] = source;
        }

        const sound = this.sources[name].cloneNode();

        sound.volume = volume;
        sound.playbackRate = rate;
        sound.preservesPitch = false;
        sound.play().catch(() => {});
    },

    toggle() {
        this.muted = !this.muted;
        safeSet("game-muted", this.muted ? "1" : "0");
    }
};


function addSoundButton(bag) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "game-control-button game-sound-button";

    function update() {
        button.textContent = gameAudio.muted ? "♪ OFF" : "♪ ON";
        button.setAttribute(
            "aria-label",
            gameAudio.muted
                ? tr("Activer le son", "Turn sound on")
                : tr("Couper le son", "Mute sound")
        );
    }

    bag.on(button, "click", () => {
        gameAudio.toggle();
        update();
        button.blur();
    });

    update();

    document
        .querySelector(".game-mobile-controls")
        .prepend(button);

    return {
        update,
        remove: () => button.remove()
    };
}


/* =========================================================
   HANGMAN — DATA
========================================================= */

const HANGMAN_CATEGORIES = {
    tech: { fr: "Technologie", en: "Technology" },
    everyday: { fr: "Quotidien", en: "Everyday life" },
    travel: { fr: "Voyage", en: "Travel" },
    nature: { fr: "Nature", en: "Nature" },
    animals: { fr: "Animaux", en: "Animals" }
};


const HANGMAN_WORDS = [
    { fr: "CLAVIER", en: "KEYBOARD", cat: "tech", photo: "1587829741301-dc798b83add3" },
    { fr: "ORDINATEUR", en: "LAPTOP", cat: "tech", photo: "1496181133206-80ce9b88a853" },
    { fr: "ROBOT", en: "ROBOT", cat: "tech", photo: "1485827404703-89b55fcc595e" },
    { fr: "SERVEUR", en: "SERVER", cat: "tech", photo: "1680992046626-418f7e910589" },
    { fr: "FUSÉE", en: "ROCKET", cat: "tech", photo: "1517976487492-5750f3195933" },

    { fr: "SMARTPHONE", en: "SMARTPHONE", cat: "everyday", photo: "1511707171634-5f897ff02aa9" },
    { fr: "SOURIS", en: "MOUSE", cat: "everyday", photo: "1527864550417-7fd91fc51a46" },
    { fr: "GUITARE", en: "GUITAR", cat: "everyday", photo: "1510915361894-db8b60106cb1" },
    { fr: "CAFÉ", en: "COFFEE", cat: "everyday", photo: "1509042239860-f550ce710b93" },

    { fr: "PASSEPORT", en: "PASSPORT", cat: "travel", photo: "1581553673739-c4906b5d0de8" },
    { fr: "BAKOU", en: "BAKU", cat: "travel", photo: "1616701639706-a89d1a609eda" },
    { fr: "NANTES", en: "NANTES", cat: "travel", photo: "1544013592-1c2496aa255e" },
    { fr: "PARIS", en: "PARIS", cat: "travel", photo: "1511739001486-6bfe10ce785f" },
    { fr: "NAVIRE", en: "SHIP", cat: "travel", photo: "1605745341112-85968b19335b" },
    { fr: "CONTENEUR", en: "CONTAINER", cat: "travel", photo: "1594571603435-0b192ab6dafa" },
    { fr: "AVION", en: "AIRPLANE", cat: "travel", photo: "1436491865332-7a61a109cc05" },
    { fr: "PHARE", en: "LIGHTHOUSE", cat: "travel", photo: "1610029795220-e5afca4dc7ba" },

    { fr: "MONTAGNE", en: "MOUNTAIN", cat: "nature", photo: "1464822759023-fed622ff2c3b" },
    { fr: "OCÉAN", en: "OCEAN", cat: "nature", photo: "1518837695005-2083093ee35b" },
    { fr: "FORÊT", en: "FOREST", cat: "nature", photo: "1448375240586-882707db888b" },
    { fr: "VOLCAN", en: "VOLCANO", cat: "nature", photo: "1619266465172-02a857c3556d" },
    { fr: "DÉSERT", en: "DESERT", cat: "nature", photo: "1542401886-65d6c61db217" },
    { fr: "GALAXIE", en: "GALAXY", cat: "nature", photo: "1464802686167-b939a6910659" },

    { fr: "ÉLÉPHANT", en: "ELEPHANT", cat: "animals", photo: "1557050543-4d5f4e07ef46" },
    { fr: "PINGOUIN", en: "PENGUIN", cat: "animals", photo: "1598439210625-5067c578f3f6" },
    { fr: "TORTUE", en: "TURTLE", cat: "animals", photo: "1437622368342-7a3d73a34c8f" },
    { fr: "GIRAFE", en: "GIRAFFE", cat: "animals", photo: "1604336755604-96ee6fa9f3f1" },
    { fr: "HIBOU", en: "OWL", cat: "animals", photo: "1543549790-8b5f4a028cfb" },
    { fr: "RENARD", en: "FOX", cat: "animals", photo: "1474511320723-9a56873867b5" },
    { fr: "PYTHON", en: "PYTHON", cat: "animals", photo: "1570741066052-817c6de995c8" }
];


function hangmanPhotoUrl(id) {
    return `assets/games/hangman/${id}.jpg`;
}


/* =========================================================
   HANGMAN
========================================================= */

function startHangman() {

    activeGame = "hangman";
    gameTitle.textContent = "Hangman";
    refreshGameHelp();

    showGameButtons({ left: false, right: false, fire: false, bomb: false, restart: false });
    setupGameCanvas();

    const W = GAME_W;
    const H = GAME_H;
    const MAX_ERRORS = 6;

    const bag = createListenerBag();
    const sound = addSoundButton(bag);

    const pixelCanvas = document.createElement("canvas");
    const pixelCtx = pixelCanvas.getContext("2d");

    let deck = [];
    let round = null;
    let score = 0;
    let streak = 0;
    let bestStreak = Number(safeGet("hangman-best-streak", "0")) || 0;

    let time = 0;
    let last = performance.now();
    let frameId = null;

    let pixelSize = 44;
    let shakeTime = 0;
    let confetti = [];
    let notice = null;


    /* -----------------------------------------------------
       KEYBOARD (HTML, so it stays usable on phones)
    ----------------------------------------------------- */

    const panel = document.createElement("div");
    panel.className = "hangman-panel";

    const keys = document.createElement("div");
    keys.className = "hangman-keys";

    const letterButtons = {};

    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((letter) => {
        const key = document.createElement("button");

        key.type = "button";
        key.className = "hangman-key";
        key.textContent = letter;
        key.dataset.letter = letter;

        letterButtons[letter] = key;
        keys.append(key);
    });

    const actions = document.createElement("div");
    actions.className = "hangman-actions";

    const hintButton = createActionButton("Indice (−1 vie)", "Hint (−1 life)", "hangman-action");
    const nextButton = createActionButton("Mot suivant →", "Next word →", "hangman-action hangman-next");

    actions.append(hintButton, nextButton);
    panel.append(keys, actions);

    document
        .querySelector(".game-stage-wrap")
        .after(panel);


    function createActionButton(fr, en, className) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = className;
        button.dataset.fr = fr;
        button.dataset.en = en;
        button.textContent = tr(fr, en);

        return button;
    }


    function updateKeyboard() {
        Object.entries(letterButtons).forEach(([letter, key]) => {
            const used = round.guessed.has(letter);
            const hit = used && round.base.includes(letter);

            key.disabled = used || round.finished;
            key.classList.toggle("is-hit", hit);
            key.classList.toggle("is-miss", used && !hit);
        });

        hintButton.disabled = round.finished;
        nextButton.classList.toggle("is-ready", round.finished);
    }


    /* -----------------------------------------------------
       ROUNDS
    ----------------------------------------------------- */

    function nextRound() {
        if (!deck.length) {
            deck = shuffle(HANGMAN_WORDS.slice());
        }

        const entry = deck.pop();
        const word = currentLanguage === "en" ? entry.en : entry.fr;

        round = {
            entry,
            word,
            base: stripAccents(word),
            guessed: new Set(),
            errors: 0,
            partTimes: [],
            revealTimes: {},
            finished: false,
            won: false,
            gained: 0,
            endTime: 0,
            image: loadImage(hangmanPhotoUrl(entry.photo))
        };

        pixelSize = 44;
        confetti = [];
        notice = null;

        if (deck.length) {
            loadImage(hangmanPhotoUrl(deck[deck.length - 1].photo));
        }

        updateKeyboard();
    }


    function isComplete() {
        return [...round.base].every((letter) => round.guessed.has(letter));
    }


    function guess(letter) {
        if (!round || round.finished || round.guessed.has(letter)) {
            return;
        }

        round.guessed.add(letter);

        if (round.base.includes(letter)) {
            [...round.base].forEach((char, index) => {
                if (char === letter) {
                    round.revealTimes[index] = time;
                }
            });

            gameAudio.play("sfx_twoTone", 0.18, 1.3);

            if (isComplete()) {
                winRound();
            }
        } else {
            addError();

            if (round.errors >= MAX_ERRORS) {
                loseRound();
            }
        }

        updateKeyboard();
    }


    function addError() {
        round.errors += 1;
        round.partTimes.push(time);
        shakeTime = 0.4;

        gameAudio.play("sfx_shieldDown", 0.25);
    }


    function useHint() {
        if (!round || round.finished) {
            return;
        }

        const missing = [...new Set(round.base)].filter((letter) => !round.guessed.has(letter));

        if (round.errors >= MAX_ERRORS - 1) {
            notice = { text: tr("Plus assez de vies pour un indice.", "Not enough lives left for a hint."), until: time + 2.2 };
            return;
        }

        if (missing.length <= 1) {
            notice = { text: tr("Plus qu'une lettre : à vous de jouer !", "Only one letter left: your turn!"), until: time + 2.2 };
            return;
        }

        round.errors += 1;
        round.partTimes.push(time);

        guess(pick(missing));
    }


    function winRound() {
        round.finished = true;
        round.won = true;
        round.endTime = time;
        round.gained = round.base.length * 10 + (MAX_ERRORS - round.errors) * 15;

        score += round.gained;
        streak += 1;

        if (streak > bestStreak) {
            bestStreak = streak;
            safeSet("hangman-best-streak", String(bestStreak));
        }

        gameAudio.play("sfx_shieldUp", 0.35);

        const colors = ["#d8e6f6", "#9fb9da", "#8ef0a8", "#ffd36b", "#ff9aa2"];

        for (let i = 0; i < 110; i++) {
            confetti.push({
                x: rand(370, 760),
                y: rand(70, 120),
                vx: rand(-140, 140),
                vy: rand(-320, -80),
                rotation: rand(0, Math.PI),
                spin: rand(-8, 8),
                size: rand(5, 9),
                color: pick(colors),
                life: rand(1.6, 2.6)
            });
        }
    }


    function loseRound() {
        round.finished = true;
        round.endTime = time;
        streak = 0;

        [...round.base].forEach((char, index) => {
            if (!(index in round.revealTimes)) {
                round.revealTimes[index] = time + index * 0.06;
            }
        });

        gameAudio.play("sfx_lose", 0.35);
    }


    /* -----------------------------------------------------
       INPUT
    ----------------------------------------------------- */

    bag.on(keys, "click", (event) => {
        const key = event.target.closest(".hangman-key");

        if (key) {
            guess(key.dataset.letter);
        }
    });

    bag.on(hintButton, "click", () => {
        useHint();
        hintButton.blur();
    });

    bag.on(nextButton, "click", () => {
        nextRound();
        nextButton.blur();
    });

    bag.on(canvas, "pointerdown", () => {
        if (round && round.finished) {
            nextRound();
        }
    });

    bag.on(window, "keydown", (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        const letter = stripAccents(event.key.toUpperCase());

        if (/^[A-Z]$/.test(letter)) {
            event.preventDefault();
            guess(letter);
        } else if (event.key === "Enter") {
            event.preventDefault();

            if (round.finished) {
                nextRound();
            }
        }
    });


    /* -----------------------------------------------------
       DRAWING
    ----------------------------------------------------- */

    function drawBackground() {
        const gradient = ctx.createLinearGradient(0, 0, 0, H);
        gradient.addColorStop(0, "#0c1726");
        gradient.addColorStop(1, "#060b13");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
        ctx.lineWidth = 1;

        for (let x = 0; x <= W; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, H);
            ctx.stroke();
        }

        for (let y = 0; y <= H; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(W, y + 0.5);
            ctx.stroke();
        }
    }


    function heartPath(cx, cy, size) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + size * 0.55);
        ctx.bezierCurveTo(cx - size * 1.2, cy - size * 0.2, cx - size * 0.55, cy - size * 1.05, cx, cy - size * 0.4);
        ctx.bezierCurveTo(cx + size * 0.55, cy - size * 1.05, cx + size * 1.2, cy - size * 0.2, cx, cy + size * 0.55);
        ctx.closePath();
    }


    function drawHeader() {
        const category = HANGMAN_CATEGORIES[round.entry.cat];
        const label = `${tr("CATÉGORIE", "CATEGORY")} · ${tr(category.fr, category.en).toUpperCase()}`;

        ctx.font = `800 12px ${UI_FONT}`;
        ctx.textBaseline = "middle";

        const chipWidth = ctx.measureText(label).width + 32;

        roundRectPath(30, 22, chipWidth, 32, 16);
        ctx.fillStyle = "rgba(159, 185, 218, 0.14)";
        ctx.fill();
        ctx.strokeStyle = "rgba(159, 185, 218, 0.42)";
        ctx.stroke();

        ctx.fillStyle = "#d8e6f6";
        ctx.textAlign = "left";
        ctx.fillText(label, 46, 38.5);

        for (let i = 0; i < MAX_ERRORS; i++) {
            const alive = i < MAX_ERRORS - round.errors;
            const x = W - 40 - i * 24;

            heartPath(x, 38, 10);

            if (alive) {
                ctx.fillStyle = "#ff7d8a";
                ctx.fill();
            } else {
                ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }

        ctx.font = `700 13px ${UI_FONT}`;
        ctx.textAlign = "right";
        ctx.fillStyle = "#c7d0dc";
        ctx.fillText(
            `${tr("SCORE", "SCORE")} ${score}   •   ${tr("SÉRIE", "STREAK")} ${streak}   •   ${tr("RECORD", "BEST")} ${bestStreak}`,
            W - 40 - MAX_ERRORS * 24,
            38.5
        );
    }


    function drawBeam(x1, y1, x2, y2) {
        ctx.lineCap = "round";

        ctx.strokeStyle = "#5b4130";
        ctx.lineWidth = 13;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = "#8d6849";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 228, 190, 0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1 - 2, y1 - 2);
        ctx.lineTo(x2 - 2, y2 - 2);
        ctx.stroke();
    }


    function partProgress(index) {
        const start = round.partTimes[index];

        if (start === undefined) {
            return 0;
        }

        return clampValue((time - start) / 0.35, 0, 1);
    }


    function drawLimb(x1, y1, x2, y2, progress) {
        if (progress <= 0) {
            return;
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + (x2 - x1) * progress, y1 + (y2 - y1) * progress);
        ctx.stroke();
    }


    function drawGallows() {
        const x = 30;
        const y = 76;
        const w = 300;
        const h = 380;

        const offset = shakeTime > 0 ? Math.sin(time * 70) * 7 * (shakeTime / 0.4) : 0;

        ctx.save();
        ctx.translate(offset, 0);

        roundRectPath(x, y, w, h, 20);
        ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();

        const ground = ctx.createLinearGradient(0, 398, 0, 430);
        ground.addColorStop(0, "rgba(120, 170, 120, 0.28)");
        ground.addColorStop(1, "rgba(120, 170, 120, 0)");
        ctx.fillStyle = ground;
        ctx.fillRect(x + 16, 398, w - 32, 32);

        drawBeam(70, 400, 260, 400);
        drawBeam(110, 400, 110, 112);
        drawBeam(104, 116, 246, 116);
        drawBeam(110, 172, 162, 116);

        /* Figure hangs from the rope and swings when the round is lost. */
        const swing = round.finished && !round.won
            ? Math.sin((time - round.endTime) * 2.4) * 0.1
            : Math.sin(time * 1.2) * 0.012;

        ctx.translate(232, 116);
        ctx.rotate(swing);

        ctx.strokeStyle = "#d9c39a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 36);
        ctx.stroke();

        ctx.translate(0, 36);

        ctx.strokeStyle = "#f2f6fb";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.shadowColor = "rgba(159, 185, 218, 0.55)";
        ctx.shadowBlur = 12;

        const head = partProgress(0);

        if (head > 0) {
            ctx.beginPath();
            ctx.arc(0, 24, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * head);
            ctx.stroke();
        }

        drawLimb(0, 46, 0, 128, partProgress(1));
        drawLimb(0, 66, -34, 104, partProgress(2));
        drawLimb(0, 66, 34, 104, partProgress(3));
        drawLimb(0, 128, -28, 180, partProgress(4));
        drawLimb(0, 128, 28, 180, partProgress(5));

        ctx.shadowBlur = 0;

        if (head >= 1) {
            ctx.strokeStyle = "#f2f6fb";
            ctx.fillStyle = "#f2f6fb";
            ctx.lineWidth = 2.5;

            if (round.finished && !round.won) {
                [[-8, 20], [8, 20]].forEach(([ex, ey]) => {
                    ctx.beginPath();
                    ctx.moveTo(ex - 4, ey - 4);
                    ctx.lineTo(ex + 4, ey + 4);
                    ctx.moveTo(ex + 4, ey - 4);
                    ctx.lineTo(ex - 4, ey + 4);
                    ctx.stroke();
                });
            } else {
                ctx.beginPath();
                ctx.arc(-8, 20, 2.6, 0, Math.PI * 2);
                ctx.arc(8, 20, 2.6, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.beginPath();

            if (round.won) {
                ctx.arc(0, 28, 8, 0.15 * Math.PI, 0.85 * Math.PI);
            } else {
                ctx.arc(0, 38, 7, 1.15 * Math.PI, 1.85 * Math.PI);
            }

            ctx.stroke();
        }

        ctx.restore();
    }


    function drawPhoto() {
        const x = 360;
        const y = 76;
        const w = 410;
        const h = 300;
        const image = round.image;

        ctx.save();
        roundRectPath(x, y, w, h, 20);
        ctx.clip();

        ctx.fillStyle = "#0a1320";
        ctx.fillRect(x, y, w, h);

        if (imageReady(image)) {
            const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
            const sw = w / scale;
            const sh = h / scale;
            const sx = (image.naturalWidth - sw) / 2;
            const sy = (image.naturalHeight - sh) / 2;

            if (pixelSize > 1.6) {
                const cw = Math.max(1, Math.round(w / pixelSize));
                const ch = Math.max(1, Math.round(h / pixelSize));

                pixelCanvas.width = cw;
                pixelCanvas.height = ch;
                pixelCtx.drawImage(image, sx, sy, sw, sh, 0, 0, cw, ch);

                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(pixelCanvas, 0, 0, cw, ch, x, y, w, h);
                ctx.imageSmoothingEnabled = true;
            } else {
                ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
            }
        } else {
            const failed = image.complete;
            const shine = ((time * 260) % (w + 300)) - 150;
            const gradient = ctx.createLinearGradient(x + shine - 120, 0, x + shine + 120, 0);

            gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
            gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.06)");
            gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, w, h);

            ctx.fillStyle = "#8e99a8";
            ctx.font = `600 14px ${UI_FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                failed
                    ? tr("Image indisponible — devinez sans indice !", "Image unavailable — guess without a hint!")
                    : tr("Chargement de la photo…", "Loading photo…"),
                x + w / 2,
                y + h / 2
            );
        }

        const shade = ctx.createLinearGradient(0, y + h - 70, 0, y + h);
        shade.addColorStop(0, "rgba(3, 6, 12, 0)");
        shade.addColorStop(1, "rgba(3, 6, 12, 0.85)");
        ctx.fillStyle = shade;
        ctx.fillRect(x, y + h - 70, w, 70);

        ctx.fillStyle = "#e6eef8";
        ctx.font = `700 12px ${UI_FONT}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(
            round.finished
                ? `${round.word} · Photo : Unsplash`
                : tr("Indice visuel — la photo se précise à chaque bonne lettre", "Visual hint — the photo sharpens with every correct letter"),
            x + 16,
            y + h - 16
        );

        ctx.restore();

        roundRectPath(x, y, w, h, 20);
        ctx.strokeStyle = round.finished
            ? (round.won ? "rgba(142, 240, 168, 0.6)" : "rgba(255, 125, 138, 0.6)")
            : "rgba(255, 255, 255, 0.10)";
        ctx.lineWidth = round.finished ? 2 : 1;
        ctx.stroke();
    }


    function drawWord() {
        const letters = [...round.word];
        const count = letters.length;
        const gap = 6;
        const slot = Math.min(46, (410 - gap * (count - 1)) / count);
        const total = slot * count + gap * (count - 1);
        const startX = 565 - total / 2;
        const y = 440;

        letters.forEach((char, index) => {
            const x = startX + index * (slot + gap);
            const revealedAt = round.revealTimes[index];
            const missed = round.finished && !round.won && !round.guessed.has(round.base[index]);

            ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
            roundRectPath(x, y - 46, slot, 52, 8);
            ctx.fill();

            ctx.fillStyle = missed ? "#ff7d8a" : "#9fb9da";
            ctx.fillRect(x + 4, y + 2, slot - 8, 3);

            if (revealedAt !== undefined && time >= revealedAt) {
                const t = clampValue((time - revealedAt) / 0.28, 0, 1);
                const scale = 1 + (1 - t) * 0.5;

                ctx.save();
                ctx.globalAlpha = t;
                ctx.translate(x + slot / 2, y - 18);
                ctx.scale(scale, scale);
                ctx.fillStyle = missed ? "#ff9aa2" : "#ffffff";
                ctx.font = `800 ${Math.round(slot * 0.66)}px ${UI_FONT}`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(char, 0, 0);
                ctx.restore();
            }
        });
    }


    function drawMessage() {
        let title;
        let subtitle;
        let color = "#ffffff";

        if (!round.finished) {
            title = tr("Devinez le mot caché", "Guess the hidden word");
            subtitle = tr(
                "Tapez une lettre au clavier ou utilisez les boutons ci-dessous",
                "Type a letter on your keyboard or use the buttons below"
            );
        } else if (round.won) {
            title = `${tr("Bravo !", "Well done!")}  +${round.gained}`;
            subtitle = tr("Entrée ou clic : mot suivant", "Enter or click: next word");
            color = "#8ef0a8";
        } else {
            title = `${tr("Perdu… le mot était", "Game over… the word was")} ${round.word}`;
            subtitle = tr("Entrée ou clic : mot suivant", "Enter or click: next word");
            color = "#ff9aa2";
        }

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillStyle = color;
        ctx.font = `800 26px ${UI_FONT}`;
        ctx.fillText(title, W / 2, 506);

        const showNotice = notice && time < notice.until;

        ctx.fillStyle = showNotice ? "#ffd36b" : "#8e99a8";
        ctx.font = `600 14px ${UI_FONT}`;
        ctx.fillText(showNotice ? notice.text : subtitle, W / 2, 542);
    }


    function drawConfetti() {
        confetti.forEach((piece) => {
            ctx.save();
            ctx.globalAlpha = clampValue(piece.life, 0, 1);
            ctx.translate(piece.x, piece.y);
            ctx.rotate(piece.rotation);
            ctx.fillStyle = piece.color;
            ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
            ctx.restore();
        });
    }


    /* -----------------------------------------------------
       LOOP
    ----------------------------------------------------- */

    function update(dt) {
        time += dt;
        shakeTime = Math.max(0, shakeTime - dt);

        const unique = new Set(round.base);
        const found = [...unique].filter((letter) => round.guessed.has(letter)).length;
        const progress = found / unique.size;
        const target = round.finished ? 1 : 4 + 40 * Math.pow(1 - progress, 1.3);

        pixelSize += (target - pixelSize) * Math.min(1, dt * (round.finished ? 3 : 5));

        confetti.forEach((piece) => {
            piece.vy += 520 * dt;
            piece.x += piece.vx * dt;
            piece.y += piece.vy * dt;
            piece.rotation += piece.spin * dt;
            piece.life -= dt;
        });

        confetti = confetti.filter((piece) => piece.life > 0 && piece.y < H + 20);
    }


    function draw() {
        drawBackground();
        drawHeader();
        drawGallows();
        drawPhoto();
        drawWord();
        drawMessage();
        drawConfetti();
    }


    function frame(now) {
        const dt = clampValue((now - last) / 1000, 0, 0.05);
        last = now;

        update(dt);
        draw();

        frameId = requestAnimationFrame(frame);
    }


    nextRound();
    frameId = requestAnimationFrame(frame);


    return () => {
        cancelAnimationFrame(frameId);
        bag.clear();
        panel.remove();
        sound.remove();
    };
}


/* Dodge Game lives in dodge.js. */
