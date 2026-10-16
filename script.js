document.documentElement.classList.add("js");


/* =========================================================
   ELEMENTS
========================================================= */

const header = document.querySelector("#header");

const menuButton = document.querySelector("#menu-button");
const navLinks = document.querySelector("#nav-links");

const langFr = document.querySelector("#lang-fr");
const langEn = document.querySelector("#lang-en");

const contactForm = document.querySelector("#contact-form");
const formMessage = document.querySelector("#form-message");

const gameModal = document.querySelector("#game-modal");
const gameClose = document.querySelector("#game-close");

const gameTitle = document.querySelector("#game-title");
const gameHelp = document.querySelector("#game-help");

const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");

const leftButton = document.querySelector("#game-left");
const rightButton = document.querySelector("#game-right");
const fireButton = document.querySelector("#game-fire");
const bombButton = document.querySelector("#game-bomb");
const restartButton = document.querySelector("#game-restart");


let currentLanguage = "fr";

let activeGame = null;

let currentGameCleanup = null;


/* =========================================================
   SAFE LOCAL STORAGE
========================================================= */

function safeGet(key, fallback = null) {

    try {

        const value = localStorage.getItem(key);

        return value === null
            ? fallback
            : value;

    } catch (error) {

        return fallback;

    }

}


function safeSet(key, value) {

    try {

        localStorage.setItem(
            key,
            value
        );

    } catch (error) {

        console.info(
            "Local storage unavailable."
        );

    }

}


/* =========================================================
   HEADER SCROLL
========================================================= */

function updateHeader() {

    header.classList.toggle(
        "scrolled",
        window.scrollY > 30
    );

}


window.addEventListener(
    "scroll",
    updateHeader,
    {
        passive: true
    }
);


updateHeader();


/* =========================================================
   MOBILE MENU
========================================================= */

function closeMobileMenu() {

    menuButton.classList.remove(
        "active"
    );

    navLinks.classList.remove(
        "active"
    );

    menuButton.setAttribute(
        "aria-expanded",
        "false"
    );

}


menuButton.addEventListener(
    "click",
    () => {

        const isOpen =
            navLinks.classList.toggle(
                "active"
            );


        menuButton.classList.toggle(
            "active",
            isOpen
        );


        menuButton.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

    }
);


document
    .querySelectorAll(".nav-links a")
    .forEach(
        (link) => {

            link.addEventListener(
                "click",
                closeMobileMenu
            );

        }
    );


/* =========================================================
   LANGUAGE FR / EN
========================================================= */

function changeLanguage(language) {

    currentLanguage =
        language;


    document.documentElement.lang =
        language;


    safeSet(
        "cv-language",
        language
    );


    document
        .querySelectorAll(
            "[data-fr][data-en]"
        )
        .forEach(
            (element) => {

                element.textContent =
                    language === "fr"
                        ? element.dataset.fr
                        : element.dataset.en;

            }
        );


    document
        .querySelectorAll(
            "[data-fr-placeholder][data-en-placeholder]"
        )
        .forEach(
            (element) => {

                element.placeholder =
                    language === "fr"
                        ? element.dataset.frPlaceholder
                        : element.dataset.enPlaceholder;

            }
        );


    document
        .querySelectorAll(
            "[data-alt-fr][data-alt-en]"
        )
        .forEach(
            (element) => {

                element.alt =
                    language === "fr"
                        ? element.dataset.altFr
                        : element.dataset.altEn;

            }
        );


    langFr.classList.toggle(
        "active",
        language === "fr"
    );


    langEn.classList.toggle(
        "active",
        language === "en"
    );


    refreshGameHelp();

}


langFr.addEventListener(
    "click",
    () => {

        changeLanguage("fr");

    }
);


langEn.addEventListener(
    "click",
    () => {

        changeLanguage("en");

    }
);


if (
    safeGet("cv-language") === "en"
) {

    changeLanguage("en");

}


/* =========================================================
   HERO ANIMATION
========================================================= */

requestAnimationFrame(
    () => {

        document
            .querySelectorAll(".hero-wave")
            .forEach(
                (element) => {

                    element.classList.add(
                        "hero-visible"
                    );

                }
            );

    }
);


/* =========================================================
   SCROLL REVEAL
========================================================= */

const revealElements =
    document.querySelectorAll(".reveal");


if (
    "IntersectionObserver" in window
) {

    const revealObserver =
        new IntersectionObserver(

            (entries) => {

                entries.forEach(
                    (entry) => {

                        if (
                            entry.isIntersecting
                        ) {

                            entry.target.classList.add(
                                "visible"
                            );


                            revealObserver.unobserve(
                                entry.target
                            );

                        }

                    }
                );

            },

            {
                threshold: 0.10
            }

        );


    revealElements.forEach(
        (element, index) => {

            element.style.setProperty(
                "--reveal-index",
                index % 4
            );


            revealObserver.observe(
                element
            );

        }
    );

} else {

    revealElements.forEach(
        (element) => {

            element.classList.add(
                "visible"
            );

        }
    );

}


/* =========================================================
   CONTACT FORM
========================================================= */

contactForm?.addEventListener(
    "submit",
    (event) => {

        event.preventDefault();


        const name =
            document
                .querySelector("#name")
                .value
                .trim();


        const email =
            document
                .querySelector("#email")
                .value
                .trim();


        const subject =
            document
                .querySelector("#subject")
                .value
                .trim();


        const message =
            document
                .querySelector("#message")
                .value
                .trim();


        if (
            !name ||
            !email ||
            !subject ||
            !message
        ) {

            formMessage.textContent =
                currentLanguage === "fr"
                    ? "Merci de remplir tous les champs."
                    : "Please complete all fields.";

            return;

        }


        const body =
            `Nom : ${name}\n` +
            `Email : ${email}\n\n` +
            `${message}`;


        const mailto =
            `mailto:sabina.karimova@epitech.eu` +
            `?subject=${encodeURIComponent(subject)}` +
            `&body=${encodeURIComponent(body)}`;


        formMessage.textContent =
            currentLanguage === "fr"
                ? "Ouverture de votre application e-mail..."
                : "Opening your email application...";


        window.location.href =
            mailto;

    }
);


/* =========================================================
   THREE.JS EARTH
========================================================= */

async function createEarth() {

    try {

        const THREE =
            await import(
                "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"
            );


        const globe =
            document.querySelector(
                ".globe"
            );


        if (!globe) {

            return;

        }


        const scene =
            new THREE.Scene();


        const camera =
            new THREE.PerspectiveCamera(
                38,
                1,
                0.1,
                100
            );


        camera.position.z =
            3.68;


        const renderer =
            new THREE.WebGLRenderer(
                {
                    alpha: true,
                    antialias: true
                }
            );


        renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio,
                2
            )
        );


        renderer.setSize(
            globe.clientWidth,
            globe.clientHeight
        );


        renderer.outputColorSpace =
            THREE.SRGBColorSpace;


        renderer.toneMapping =
            THREE.ACESFilmicToneMapping;


        renderer.toneMappingExposure =
            1.32;


        renderer.domElement.style.position =
            "absolute";


        renderer.domElement.style.inset =
            "0";


        renderer.domElement.style.width =
            "100%";


        renderer.domElement.style.height =
            "100%";


        renderer.domElement.setAttribute(
            "aria-hidden",
            "true"
        );


        globe.appendChild(
            renderer.domElement
        );


        const geometry =
            new THREE.SphereGeometry(
                1.32,
                96,
                96
            );


        const textureLoader =
            new THREE.TextureLoader();


        function onEarthLoaded() {

            const staticPhoto =
                document.querySelector(
                    ".globe-photo"
                );


            if (staticPhoto) {

                staticPhoto.style.opacity =
                    "0.12";

            }

        }


        /*
            Local copy first; when the page is opened
            as a file (file://), fall back to the CDN copy.
        */

        const texture =
            textureLoader.load(

                "assets/img/earth-blue-marble.jpg",

                onEarthLoaded,

                undefined,

                () => {

                    textureLoader.load(

                        "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",

                        (remote) => {

                            texture.image =
                                remote.image;

                            texture.needsUpdate =
                                true;

                            onEarthLoaded();

                        }

                    );

                }

            );


        texture.colorSpace =
            THREE.SRGBColorSpace;


        texture.anisotropy =
            renderer.capabilities
                .getMaxAnisotropy();


        const material =
            new THREE.MeshStandardMaterial(
                {
                    map: texture,
                    roughness: 0.84,
                    metalness: 0.015
                }
            );


        const earth =
            new THREE.Mesh(
                geometry,
                material
            );


        /*
            Real Earth axial tilt
        */

        earth.rotation.z =
            THREE.MathUtils.degToRad(
                23.44
            );


        /*
            Initial view:
            Asia + Australia
        */

        earth.rotation.y =
            THREE.MathUtils.degToRad(
                -112
            );


        scene.add(
            earth
        );


        /*
            Ambient light
        */

        const ambient =
            new THREE.AmbientLight(
                0x9fc7ee,
                1.45
            );


        scene.add(
            ambient
        );


        /*
            Main sunlight
        */

        const sun =
            new THREE.DirectionalLight(
                0xffffff,
                3.35
            );


        sun.position.set(
            -4,
            3,
            5
        );


        scene.add(
            sun
        );


        /*
            Soft blue fill light
        */

        const fill =
            new THREE.DirectionalLight(
                0x80b9e8,
                0.62
            );


        fill.position.set(
            4,
            -2,
            2
        );


        scene.add(
            fill
        );


        const reducedMotion =
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches;


        function resizeEarth() {

            const size =
                globe.clientWidth;


            renderer.setSize(
                size,
                size
            );


            camera.aspect =
                1;


            camera.updateProjectionMatrix();

        }


        function animateEarth() {

            /*
                Full rotation:
                about 150 seconds
            */

            if (!reducedMotion) {

                earth.rotation.y +=
                    (Math.PI * 2) /
                    (150 * 60);

            }


            renderer.render(
                scene,
                camera
            );


            requestAnimationFrame(
                animateEarth
            );

        }


        window.addEventListener(
            "resize",
            resizeEarth
        );


        resizeEarth();

        animateEarth();

    } catch (error) {

        console.info(
            "3D Earth unavailable. Static NASA Earth fallback remains active."
        );

    }

}


createEarth();


/* =========================================================
   GAME MODAL
========================================================= */

document
    .querySelectorAll(
        ".game-launch"
    )
    .forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    openGame(
                        button.dataset.game
                    );

                }
            );

        }
    );


function stopCurrentGame() {

    if (
        typeof currentGameCleanup ===
        "function"
    ) {

        currentGameCleanup();

    }


    currentGameCleanup =
        null;


    activeGame =
        null;

}


function openGame(game) {

    stopCurrentGame();


    activeGame =
        game;


    gameModal.classList.add(
        "open"
    );


    gameModal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "game-open"
    );


    if (
        game === "hangman"
    ) {

        currentGameCleanup =
            startHangman();

    }


    if (
        game === "dodge"
    ) {

        currentGameCleanup =
            startDodge();

    }

}


function closeGame() {

    stopCurrentGame();


    gameModal.classList.remove(
        "open"
    );


    gameModal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "game-open"
    );

}


function refreshGameHelp() {

    if (
        activeGame === "hangman"
    ) {

        gameHelp.textContent =
            currentLanguage === "fr"
                ? "Clavier ou boutons : choisissez une lettre • Indice : coûte 1 vie • Entrée : mot suivant"
                : "Keyboard or buttons: pick a letter • Hint: costs 1 life • Enter: next word";

    }


    if (
        activeGame === "dodge"
    ) {

        gameHelp.textContent =
            currentLanguage === "fr"
                ? "Flèches / ZQSD : bouger • Espace : tirer • X : bombe • P : pause • M : son • R : recommencer • Mobile : glissez sur l'écran"
                : "Arrows / WASD: move • Space: fire • X: bomb • P: pause • M: sound • R: restart • Mobile: drag on the screen";

    }

}


gameClose.addEventListener(
    "click",
    closeGame
);


document
    .querySelectorAll(
        "[data-game-close]"
    )
    .forEach(
        (element) => {

            element.addEventListener(
                "click",
                closeGame
            );

        }
    );


window.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Escape" &&
            gameModal.classList.contains(
                "open"
            )
        ) {

            closeGame();

        }

    }
);


/* Games (Hangman, Dodge Game) live in games.js. */
