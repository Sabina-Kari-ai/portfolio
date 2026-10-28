/* Shared by every page: language switch, backgrounds, counters, copy buttons. */

let currentLanguage = "fr";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


function safeGet(key, fallback = null) {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
    } catch (error) {
        return fallback;
    }
}


function safeSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        /* Storage unavailable: the page works without it. */
    }
}


/* ---------- language ---------- */

function changeLanguage(language) {
    currentLanguage = language;
    document.documentElement.lang = language;

    document.querySelectorAll("[data-fr][data-en]").forEach((element) => {
        element.textContent = language === "fr" ? element.dataset.fr : element.dataset.en;
    });

    document.querySelectorAll("[data-alt-fr][data-alt-en]").forEach((element) => {
        element.alt = language === "fr" ? element.dataset.altFr : element.dataset.altEn;
    });

    document.querySelectorAll("[data-count][data-suffix]").forEach((element) => {
        element.dataset.suffix = language === "fr" ? " ans" : " yrs";
        element.textContent = element.dataset.count + element.dataset.suffix;
    });

    document.querySelector("#lang-fr").setAttribute("aria-pressed", String(language === "fr"));
    document.querySelector("#lang-en").setAttribute("aria-pressed", String(language === "en"));

    document.querySelectorAll("[data-fr-placeholder][data-en-placeholder]").forEach((element) => {
        element.placeholder = language === "fr" ? element.dataset.frPlaceholder : element.dataset.enPlaceholder;
    });

    const navToggle = document.querySelector("#nav-toggle");

    if (navToggle) {
        const isOpen = navToggle.getAttribute("aria-expanded") === "true";
        navToggle.setAttribute("aria-label", isOpen
            ? (language === "fr" ? "Fermer le menu" : "Close the menu")
            : (language === "fr" ? "Ouvrir le menu" : "Open the menu"));
    }

    safeSet("cv-language", language);
    if (typeof refreshGameHelp === "function") {
        refreshGameHelp();
    }
}

document.querySelector("#lang-fr").addEventListener("click", () => changeLanguage("fr"));
document.querySelector("#lang-en").addEventListener("click", () => changeLanguage("en"));

if (safeGet("cv-language") === "en") {
    changeLanguage("en");
}


/* ---------- mobile menu ---------- */

(function mobileMenu() {
    const nav = document.querySelector(".nav");
    const toggle = document.querySelector("#nav-toggle");

    if (!nav || !toggle) {
        return;
    }

    function setOpen(open) {
        nav.classList.toggle("open", open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute(
            "aria-label",
            open
                ? (currentLanguage === "fr" ? "Fermer le menu" : "Close the menu")
                : (currentLanguage === "fr" ? "Ouvrir le menu" : "Open the menu")
        );
    }

    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("open")));

    nav.querySelectorAll(".nav-links a").forEach((link) => {
        link.addEventListener("click", () => setOpen(false));
    });

    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && nav.classList.contains("open")) {
            setOpen(false);
            toggle.focus();
        }
    });

    window.matchMedia("(min-width: 1001px)").addEventListener("change", (event) => {
        if (event.matches) {
            setOpen(false);
        }
    });
})();


/* ---------- active section in the menu ---------- */

(function scrollSpy() {
    const links = [...document.querySelectorAll(".nav-links a[data-sections]")];

    if (!links.length || !("IntersectionObserver" in window)) {
        return;
    }

    const targets = new Map();

    links.forEach((link) => {
        link.dataset.sections.split(" ").forEach((id) => {
            targets.set(id, link);
        });
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }

            const active = targets.get(entry.target.id);

            links.forEach((link) => {
                if (link === active) {
                    link.setAttribute("aria-current", "true");
                } else {
                    link.removeAttribute("aria-current");
                }
            });
        });
    }, { rootMargin: "-45% 0px -50% 0px" });

    targets.forEach((link, id) => {
        const section = document.getElementById(id);

        if (section) {
            observer.observe(section);
        }
    });
})();


/* ---------- starfield ---------- */

(function starfield() {
    const starCanvas = document.querySelector("#stars");
    const starCtx = starCanvas.getContext("2d");
    let stars = [];
    let width = 0;
    let height = 0;

    function resize() {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        starCanvas.width = width * ratio;
        starCanvas.height = height * ratio;
        starCtx.setTransform(ratio, 0, 0, ratio, 0, 0);

        stars = Array.from({ length: Math.round((width * height) / 7000) }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            r: Math.random() * 1.2 + 0.2,
            a: Math.random() * 0.7 + 0.2,
            s: Math.random() * 2 + 0.5
        }));
    }

    function draw(time) {
        starCtx.clearRect(0, 0, width, height);

        stars.forEach((star) => {
            const twinkle = reduceMotion ? 1 : 0.65 + Math.sin(time / 1000 * star.s + star.x) * 0.35;
            starCtx.globalAlpha = star.a * twinkle;
            starCtx.fillStyle = "#e6efff";
            starCtx.beginPath();
            starCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
            starCtx.fill();
        });

        if (!reduceMotion) {
            requestAnimationFrame(draw);
        }
    }

    resize();
    window.addEventListener("resize", resize);
    requestAnimationFrame(draw);
})();


/* ---------- spiral galaxy background (Three.js) ---------- */

(async function galaxyBackground() {
    const galaxyCanvas = document.querySelector("#galaxy");

    let THREE;

    try {
        THREE = await import("https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js");
    } catch (error) {
        return;
    }

    let renderer;

    try {
        renderer = new THREE.WebGLRenderer({ canvas: galaxyCanvas, alpha: true, powerPreference: "low-power" });
    } catch (error) {
        return;
    }

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(pixelRatio);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 3.4, 8.5);

    /* Particles laid out along four logarithmic-ish arms. */
    const count = window.innerWidth < 700 ? 24000 : 60000;
    const radius = 7.5;
    const branches = 4;
    const twist = 1.15;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const scales = new Float32Array(count);

    const core = new THREE.Color("#ffdcb4");
    const arm = new THREE.Color("#3f63ff");
    const pink = new THREE.Color("#ff6fb8");
    const violet = new THREE.Color("#a35cff");
    const color = new THREE.Color();

    const scatter = (r) => Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * (0.12 + r * 0.09);

    for (let i = 0; i < count; i++) {
        const r = Math.pow(Math.random(), 1.3) * radius;
        const angle = ((i % branches) / branches) * Math.PI * 2 + r * twist;

        positions[i * 3] = Math.cos(angle) * r + scatter(r);
        positions[i * 3 + 1] = scatter(r) * 0.35;
        positions[i * 3 + 2] = Math.sin(angle) * r + scatter(r);

        color.copy(core).lerp(arm, Math.min(1, r / (radius * 0.45)));

        const roll = Math.random();

        if (roll < 0.22) {
            color.lerp(violet, 0.7);
        } else if (roll < 0.3 && r > 2) {
            color.lerp(pink, 0.65);
        }

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        scales[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uSize: { value: 64 * pixelRatio }
        },
        vertexShader: `
            attribute float aScale;
            uniform float uSize;
            varying vec3 vColor;
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mv;
                gl_PointSize = uSize * (0.3 + aScale) / -mv.z;
                vColor = color;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            void main() {
                float d = length(gl_PointCoord - 0.5);
                float strength = pow(1.0 - smoothstep(0.0, 0.5, d), 2.4);
                gl_FragColor = vec4(vColor * strength, strength);
            }
        `,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const galaxy = new THREE.Group();
    galaxy.add(new THREE.Points(geometry, material));

    /* Soft glow at the core */
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 128;
    const glowCtx = glowCanvas.getContext("2d");
    const gradient = glowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255, 226, 190, 0.55)");
    gradient.addColorStop(0.25, "rgba(255, 190, 140, 0.18)");
    gradient.addColorStop(1, "rgba(255, 160, 120, 0)");
    glowCtx.fillStyle = gradient;
    glowCtx.fillRect(0, 0, 128, 128);

    const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(glowCanvas),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    }));
    coreGlow.scale.setScalar(3);
    galaxy.add(coreGlow);

    galaxy.rotation.x = 0.62;
    galaxy.rotation.z = -0.28;
    scene.add(galaxy);

    function layout() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const wide = width > 900;

        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        galaxy.position.set(wide ? 1.6 : 0.2, wide ? 0.2 : 1.2, 0);
        galaxy.scale.setScalar(wide ? 1.9 : 1.4);
    }

    layout();
    window.addEventListener("resize", layout);

    let scrollProgress = 0;

    function readScroll() {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        scrollProgress = max > 0 ? window.scrollY / max : 0;
    }

    readScroll();
    window.addEventListener("scroll", readScroll, { passive: true });

    let spin = 0;
    let smoothScroll = scrollProgress;
    let lastTime = performance.now();

    function frame(time) {
        const dt = Math.min(0.05, (time - lastTime) / 1000);
        lastTime = time;

        spin += dt * 0.025;
        smoothScroll += (scrollProgress - smoothScroll) * 0.06;

        galaxy.rotation.y = spin + smoothScroll * 1.4;
        camera.position.y = 3.4 - smoothScroll * 2.6;
        camera.position.z = 8.5 - smoothScroll * 1.5;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);

        if (!reduceMotion) {
            requestAnimationFrame(frame);
        }
    }

    requestAnimationFrame(frame);
})();


/* ---------- hero Earth (Three.js) ---------- */

(async function heroEarth() {
    const visual = document.querySelector("#hero-visual");
    const earthCanvas = document.querySelector("#hero-earth");

    if (!visual || !earthCanvas) {
        return;
    }

    let THREE;

    try {
        THREE = await import("https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js");
    } catch (error) {
        return;
    }

    let renderer;

    try {
        renderer = new THREE.WebGLRenderer({ canvas: earthCanvas, antialias: true, alpha: true });
    } catch (error) {
        return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 12.5);

    const loader = new THREE.TextureLoader();
    const remote = "https://unpkg.com/three-globe/example/img/";

    function texture(name, apply) {
        loader.load("assets/img/" + name, apply, undefined, () => loader.load(remote + name, apply));
    }

    const material = new THREE.MeshStandardMaterial({
        color: 0x1d3150,
        roughness: 0.85,
        emissive: 0xffc98a,
        emissiveIntensity: 0
    });

    const earth = new THREE.Mesh(new THREE.SphereGeometry(2.2, 96, 64), material);
    earth.rotation.z = 0.41;
    scene.add(earth);

    texture("earth-blue-marble.jpg", (map) => {
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 8;
        material.map = map;
        material.color.set(0xffffff);
        material.needsUpdate = true;
        visual.classList.add("is-live");
    });

    texture("earth-topology.png", (map) => {
        material.bumpMap = map;
        material.bumpScale = 3;
        material.needsUpdate = true;
    });

    texture("earth-night.jpg", (map) => {
        map.colorSpace = THREE.SRGBColorSpace;
        material.emissiveMap = map;
        material.emissiveIntensity = 0.9;
        material.needsUpdate = true;
    });

    const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(2.32, 96, 64),
        new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vView;
                void main() {
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    vNormal = normalize(normalMatrix * normal);
                    vView = normalize(-mv.xyz);
                    gl_Position = projectionMatrix * mv;
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vView;
                void main() {
                    float f = pow(1.0 - abs(dot(vNormal, vView)), 2.4) * 1.9;
                    gl_FragColor = vec4(vec3(0.38, 0.66, 1.0) * f, f);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    scene.add(atmosphere);

    const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(3.05, 0.006, 8, 200),
        new THREE.MeshBasicMaterial({ color: 0x9fc3ff, transparent: true, opacity: 0.35 })
    );
    orbit.rotation.x = Math.PI / 2.35;
    orbit.rotation.y = 0.25;
    scene.add(orbit);

    const satellite = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    scene.add(satellite);

    scene.add(new THREE.AmbientLight(0x3a4a70, 0.5));

    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(-6, 3, 5);
    scene.add(sun);

    function resize() {
        const size = earthCanvas.clientWidth;
        renderer.setSize(size, size, false);
    }

    resize();
    window.addEventListener("resize", resize);

    let pointerX = 0;
    let pointerY = 0;

    window.addEventListener("pointermove", (event) => {
        pointerX = (event.clientX / window.innerWidth - 0.5) * 0.3;
        pointerY = (event.clientY / window.innerHeight - 0.5) * 0.2;
    });

    const tilt = new THREE.Euler();

    /* Drag to spin: horizontal turns the Earth, vertical tilts it.
       Releasing keeps some momentum, then the slow auto-spin resumes. */
    const globe = new THREE.Group();
    scene.remove(earth);
    globe.add(earth);
    scene.add(globe);

    const drag = { active: false, id: null, x: 0, y: 0, vx: 0, vy: 0 };
    let spin = 0;
    let pitch = 0;

    earthCanvas.addEventListener("pointerdown", (event) => {
        drag.active = true;
        drag.id = event.pointerId;
        drag.x = event.clientX;
        drag.y = event.clientY;
        drag.vx = 0;
        drag.vy = 0;
        earthCanvas.classList.add("is-dragging");
        visual.classList.add("was-dragged");

        try {
            earthCanvas.setPointerCapture(event.pointerId);
        } catch (error) {
            /* Capture is optional. */
        }
    });

    earthCanvas.addEventListener("pointermove", (event) => {
        if (!drag.active || event.pointerId !== drag.id) {
            return;
        }

        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;

        drag.x = event.clientX;
        drag.y = event.clientY;
        drag.vx = dx * 0.008;
        drag.vy = dy * 0.006;

        spin += drag.vx;
        pitch = Math.max(-0.7, Math.min(0.7, pitch + drag.vy));

        if (reduceMotion) {
            globe.rotation.set(pitch, spin, 0);
            renderer.render(scene, camera);
        }
    });

    ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => {
        earthCanvas.addEventListener(type, () => {
            drag.active = false;
            earthCanvas.classList.remove("is-dragging");
        });
    });

    let lastTime = performance.now();

    function frame(time) {
        const t = time / 1000;
        const dt = Math.min(0.05, (time - lastTime) / 1000);
        lastTime = time;

        if (!drag.active) {
            spin += drag.vx + dt * 0.08;
            pitch = Math.max(-0.7, Math.min(0.7, pitch + drag.vy));
            drag.vx *= 0.94;
            drag.vy *= 0.9;
            pitch *= 0.985;
        }

        globe.rotation.set(pitch, spin, 0);
        tilt.set(orbit.rotation.x, orbit.rotation.y, 0);

        const angle = t * 0.45;
        const position = new THREE.Vector3(Math.cos(angle) * 3.05, Math.sin(angle) * 3.05, 0).applyEuler(tilt);
        satellite.position.copy(position);

        scene.rotation.x += (pointerY - scene.rotation.x) * 0.05;
        scene.rotation.y += (pointerX - scene.rotation.y) * 0.05;

        renderer.render(scene, camera);

        if (!reduceMotion) {
            requestAnimationFrame(frame);
        }
    }

    requestAnimationFrame(frame);
})();


/* ---------- counters ---------- */

(function counters() {
    if (reduceMotion || !("IntersectionObserver" in window)) {
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }

            const element = entry.target;
            const target = Number(element.dataset.count);
            const suffix = element.dataset.suffix || "";
            const start = performance.now();

            observer.unobserve(element);

            (function tick(now) {
                const progress = Math.min(1, (now - start) / 1200);
                const eased = 1 - Math.pow(1 - progress, 3);
                element.textContent = Math.round(target * eased) + (element.dataset.suffix || suffix);

                if (progress < 1) {
                    requestAnimationFrame(tick);
                }
            })(start);
        });
    }, { threshold: 0.6 });

    document.querySelectorAll("[data-count]").forEach((element) => observer.observe(element));
})();


/* ---------- 3D tilt on project images ---------- */

if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll(".media").forEach((media) => {
        media.addEventListener("pointermove", (event) => {
            const rect = media.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;
            media.style.transform = `perspective(900px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
        });

        media.addEventListener("pointerleave", () => {
            media.style.transform = "";
        });
    });
}


/* ---------- copy buttons ---------- */

document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", () => {
        const target = document.getElementById(button.dataset.copy);
        const text = target.textContent.trim();

        const done = () => {
            button.textContent = currentLanguage === "fr" ? "Copié ✓" : "Copied ✓";

            setTimeout(() => {
                button.textContent = currentLanguage === "fr" ? button.dataset.fr : button.dataset.en;
            }, 1600);
        };

        const selectText = () => {
            const range = document.createRange();
            range.selectNodeContents(target);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        };

        try {
            navigator.clipboard.writeText(text).then(done, selectText);
        } catch (error) {
            selectText();
        }
    });
});
