/* =========================================================
   DODGE GAME — realistic 3D version
   Gameplay runs on a 2D 800x600 field; the scene is rendered
   with Three.js on a WebGL canvas placed under the 2D canvas,
   which is used as a transparent HUD.

   Relies on script.js + games.js globals (canvas, ctx, tr,
   rand, pick, clampValue, gameAudio, roundRectPath, ...).

   Credits
   - Sounds: Kenney "Space Shooter Redux" (CC0)
   - Earth textures: NASA Blue Marble (via three-globe), stored in assets/img
   - Nebula photo: Unsplash
========================================================= */

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";
const EARTH_PATH = "assets/img/";
const NEBULA_URL = "assets/img/nebula.jpg";

/* Used when the page is opened as a file (file://), where local textures can't reach WebGL. */
const EARTH_REMOTE = "https://unpkg.com/three-globe/example/img/";
const NEBULA_REMOTE = "https://images.unsplash.com/photo-1464802686167-b939a6910659?auto=format&fit=crop&w=2048&q=80";


function loadTextureWithFallback(loader, local, remote, onLoad) {
    loader.load(local, onLoad, undefined, () => loader.load(remote, onLoad));
}


function startDodge() {

    activeGame = "dodge";
    gameTitle.textContent = "Dodge Game";
    refreshGameHelp();

    showGameButtons({ left: true, right: true, fire: true, bomb: true, restart: true });
    setupGameCanvas();

    const W = GAME_W;
    const H = GAME_H;
    const PLAYER_SPEED = 380;
    const HIGH_SCORE_KEY = "sabinaDodgeHighScore";

    /* Game units → world units. */
    const SX = 0.036;
    const SZ = 0.075;

    const bag = createListenerBag();
    const sound = addSoundButton(bag);

    const stage = document.querySelector(".game-stage-wrap");
    const glCanvas = document.createElement("canvas");

    glCanvas.className = "game-gl-canvas";
    stage.classList.add("is-3d");
    stage.prepend(glCanvas);

    let THREE = null;
    let renderer = null;
    let scene = null;
    let camera = null;
    let raycaster = null;
    let groundPlane = null;
    let gfx = null;
    let loadError = false;
    let disposed = false;

    const CAMERA_POSITION = [0, 30, 31];
    const CAMERA_TARGET = [0, 0, -16];


    /* -----------------------------------------------------
       DEFINITIONS
    ----------------------------------------------------- */

    const ENEMIES = {
        scout: { size: 46, hp: 1, speed: [170, 230], score: 100, damage: 18, drop: 0.07 },
        fighter: { size: 58, hp: 2, speed: [80, 110], score: 150, damage: 22, drop: 0.14, shoots: "aimed", wave: true },
        kamikaze: { size: 50, hp: 2, speed: [130, 160], score: 200, damage: 28, drop: 0.12, homing: true },
        heavy: { size: 82, hp: 6, speed: [50, 66], score: 320, damage: 35, drop: 0.4, shoots: "spread" },
        meteorBig: { size: 84, hp: 4, speed: [70, 110], score: 80, damage: 28, drop: 0.1, meteor: true, splits: "meteorMed" },
        meteorMed: { size: 46, hp: 2, speed: [100, 150], score: 50, damage: 18, drop: 0.04, meteor: true, splits: "meteorSmall" },
        meteorSmall: { size: 28, hp: 1, speed: [130, 180], score: 30, damage: 10, drop: 0.02, meteor: true }
    };

    const POWER_UPS = {
        weapon: { color: 0x58b4ff, css: "88, 180, 255", label: () => tr("ARME +1", "WEAPON +1"), name: () => tr("Arme", "Weapon") },
        shield: { color: 0x5dffa0, css: "93, 255, 160", label: () => tr("BOUCLIER", "SHIELD"), name: () => tr("Bouclier", "Shield") },
        heal: { color: 0xff4d5e, css: "255, 77, 94", label: () => "+25 HP", name: () => tr("Soin", "Heal") },
        bomb: { color: 0xffa040, css: "255, 160, 64", label: () => tr("+1 BOMBE", "+1 BOMB"), name: () => tr("Bombe", "Bomb") },
        gold: { color: 0xffd84a, css: "255, 216, 74", label: () => "+500", name: () => "+500" }
    };

    const WEAPON_PATTERNS = {
        1: [[0, 0]],
        2: [[-12, 0], [12, 0]],
        3: [[0, 0], [-14, -0.13], [14, 0.13]],
        4: [[-9, 0], [9, 0], [-20, -0.2], [20, 0.2]]
    };


    /* -----------------------------------------------------
       STATE
    ----------------------------------------------------- */

    let state = "loading";
    let time = 0;
    let last = performance.now();
    let frameId = null;
    let overTime = 0;

    let player = { x: W / 2, y: 470, w: 66, h: 50, tilt: 0 };
    let bullets = [];
    let enemyShots = [];
    let enemies = [];
    let boss = null;
    let powerUps = [];
    let particles = [];
    let texts = [];

    let score = 0;
    let level = 1;
    let kills = 0;
    let levelStartKills = 0;
    let nextLevelAt = 14;
    let combo = 0;
    let comboTimer = 0;
    let bombs = 2;
    let weapon = 1;
    let hp = 100;
    let shieldTime = 0;
    let invulnerable = 0;
    let fireCooldown = 0;
    let spawnTimer = 1;
    let shake = 0;
    let flash = 0;
    let banner = null;
    let dyingTimer = 0;
    let newRecord = false;

    let highScore = Number(safeGet(HIGH_SCORE_KEY, "0")) || 0;

    const input = {
        left: false,
        right: false,
        up: false,
        down: false,
        fire: false,
        touchLeft: false,
        touchRight: false,
        touchFire: false,
        pointerId: null,
        target: null
    };

    const PAUSE_BUTTON = { x: W - 128, y: 16, w: 112, h: 36 };


    function worldX(x) {
        return (x - W / 2) * SX;
    }


    function worldZ(y) {
        return (y - H) * SZ;
    }


    /* =====================================================
       GRAPHICS — textures, materials, models
    ===================================================== */

    function canvasTexture(width, height, draw) {
        const textureCanvas = document.createElement("canvas");

        textureCanvas.width = width;
        textureCanvas.height = height;
        draw(textureCanvas.getContext("2d"), width, height);

        const texture = new THREE.CanvasTexture(textureCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        return texture;
    }


    function radialTexture(stops) {
        return canvasTexture(128, 128, (c, w, h) => {
            const gradient = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
            stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
            c.fillStyle = gradient;
            c.fillRect(0, 0, w, h);
        });
    }


    function fireTexture() {
        return canvasTexture(128, 128, (c, w, h) => {
            for (let i = 0; i < 26; i++) {
                const x = w / 2 + rand(-26, 26);
                const y = h / 2 + rand(-26, 26);
                const r = rand(18, 40);
                const gradient = c.createRadialGradient(x, y, 0, x, y, r);

                gradient.addColorStop(0, "rgba(255, 255, 255, 0.45)");
                gradient.addColorStop(0.4, "rgba(255, 220, 160, 0.25)");
                gradient.addColorStop(1, "rgba(255, 150, 60, 0)");

                c.fillStyle = gradient;
                c.fillRect(0, 0, w, h);
            }
        });
    }


    function smokeTexture() {
        return canvasTexture(128, 128, (c, w, h) => {
            for (let i = 0; i < 30; i++) {
                const x = w / 2 + rand(-30, 30);
                const y = h / 2 + rand(-30, 30);
                const r = rand(14, 34);
                const gradient = c.createRadialGradient(x, y, 0, x, y, r);
                const shade = Math.round(rand(150, 220));

                gradient.addColorStop(0, `rgba(${shade}, ${shade}, ${shade}, 0.22)`);
                gradient.addColorStop(1, `rgba(${shade}, ${shade}, ${shade}, 0)`);

                c.fillStyle = gradient;
                c.fillRect(0, 0, w, h);
            }
        });
    }


    function boltTexture(core, edge) {
        return canvasTexture(32, 256, (c, w, h) => {
            const across = c.createLinearGradient(0, 0, w, 0);
            across.addColorStop(0, "rgba(0, 0, 0, 0)");
            across.addColorStop(0.3, edge);
            across.addColorStop(0.5, core);
            across.addColorStop(0.7, edge);
            across.addColorStop(1, "rgba(0, 0, 0, 0)");

            c.fillStyle = across;
            c.fillRect(0, 0, w, h);

            c.globalCompositeOperation = "destination-in";

            const along = c.createLinearGradient(0, 0, 0, h);
            along.addColorStop(0, "rgba(0, 0, 0, 0)");
            along.addColorStop(0.15, "rgba(0, 0, 0, 1)");
            along.addColorStop(0.85, "rgba(0, 0, 0, 1)");
            along.addColorStop(1, "rgba(0, 0, 0, 0)");

            c.fillStyle = along;
            c.fillRect(0, 0, w, h);
        });
    }


    function rockTexture() {
        return canvasTexture(512, 256, (c, w, h) => {
            c.fillStyle = "#6d655d";
            c.fillRect(0, 0, w, h);

            for (let i = 0; i < 2600; i++) {
                const shade = Math.round(rand(40, 150));
                c.fillStyle = `rgba(${shade}, ${shade - 6}, ${shade - 12}, ${rand(0.08, 0.3)})`;
                c.beginPath();
                c.arc(rand(0, w), rand(0, h), rand(1, 7), 0, Math.PI * 2);
                c.fill();
            }

            for (let i = 0; i < 40; i++) {
                const x = rand(0, w);
                const y = rand(0, h);
                const r = rand(4, 16);

                c.fillStyle = "rgba(25, 22, 20, 0.45)";
                c.beginPath();
                c.arc(x, y, r, 0, Math.PI * 2);
                c.fill();

                c.strokeStyle = "rgba(200, 190, 175, 0.25)";
                c.lineWidth = 2;
                c.beginPath();
                c.arc(x - 1, y - 1, r, Math.PI * 0.9, Math.PI * 1.7);
                c.stroke();
            }
        });
    }


    function hash3(x, y, z) {
        const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
        return s - Math.floor(s);
    }


    function noise3(x, y, z) {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const zi = Math.floor(z);
        const xf = x - xi;
        const yf = y - yi;
        const zf = z - zi;
        const u = xf * xf * (3 - 2 * xf);
        const v = yf * yf * (3 - 2 * yf);
        const w = zf * zf * (3 - 2 * zf);
        const lerp = (a, b, t) => a + (b - a) * t;
        const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);

        return lerp(
            lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
            lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
            w
        ) * 2 - 1;
    }


    function rockGeometry(seed, widthSegments = 40, heightSegments = 28) {
        const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
        const position = geometry.attributes.position;
        const stretch = [rand(0.8, 1.25), rand(0.7, 1.05), rand(0.8, 1.25)];

        for (let i = 0; i < position.count; i++) {
            const x = position.getX(i);
            const y = position.getY(i);
            const z = position.getZ(i);

            const n =
                noise3(x * 1.3 + seed, y * 1.3 + seed * 2, z * 1.3) * 0.34 +
                noise3(x * 3.2, y * 3.2 + seed, z * 3.2) * 0.13 +
                noise3(x * 7.5 + seed, y * 7.5, z * 7.5) * 0.04;

            const r = 1 + n;

            position.setXYZ(i, x * r * stretch[0], y * r * stretch[1], z * r * stretch[2]);
        }

        geometry.computeVertexNormals();

        return geometry;
    }


    function fresnelMaterial(color, power, intensity) {
        return new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: new THREE.Color(color) },
                power: { value: power },
                intensity: { value: intensity },
                opacity: { value: 1 }
            },
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
                uniform vec3 glowColor;
                uniform float power;
                uniform float intensity;
                uniform float opacity;
                varying vec3 vNormal;
                varying vec3 vView;
                void main() {
                    float f = pow(1.0 - abs(dot(vNormal, vView)), power) * intensity * opacity;
                    gl_FragColor = vec4(glowColor * f, f);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
    }


    function metal(color, metalness = 0.75, roughness = 0.35) {
        return new THREE.MeshStandardMaterial({ color, metalness, roughness });
    }


    function lightMaterial(color) {
        return new THREE.MeshBasicMaterial({ color, toneMapped: false });
    }


    /* Glow materials are shared per colour/opacity so bullets don't leak materials. */
    function glowSprite(color, scale, opacity = 1, unique = false) {
        const key = `${color}-${opacity}`;
        let material = unique ? null : gfx.glowMaterials[key];

        if (!material) {
            material = new THREE.SpriteMaterial({
                map: gfx.textures.glow,
                color,
                opacity,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

            if (!unique) {
                gfx.glowMaterials[key] = material;
            }
        }

        const glow = new THREE.Sprite(material);
        glow.scale.setScalar(scale);

        return glow;
    }


    function rotatedX(geometry) {
        geometry.rotateX(-Math.PI / 2);
        return geometry;
    }


    /* Scales a model so its largest horizontal size equals 2 units. */
    function normalizeModel(model) {
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);

        const span = Math.max(size.x, size.z);
        const wrapper = new THREE.Group();

        model.scale.multiplyScalar(2 / span);
        wrapper.add(model);

        return wrapper;
    }


    function buildPlayerShip() {
        const ship = new THREE.Group();
        const hull = metal(0xc3ccd8, 0.82, 0.26);
        const dark = metal(0x2a313b, 0.6, 0.45);
        const accent = lightMaterial(0x4fb6ff);

        const body = new THREE.Mesh(rotatedX(new THREE.CylinderGeometry(0.28, 0.5, 3, 18)), hull);
        ship.add(body);

        const nose = new THREE.Mesh(rotatedX(new THREE.ConeGeometry(0.28, 1.3, 18)), hull);
        nose.position.z = -2.15;
        ship.add(nose);

        const canopy = new THREE.Mesh(
            new THREE.SphereGeometry(0.3, 20, 14),
            new THREE.MeshStandardMaterial({ color: 0x0b1f3a, metalness: 0.9, roughness: 0.06, emissive: 0x0a3d7a, emissiveIntensity: 0.7 })
        );
        canopy.scale.set(0.9, 0.7, 2.2);
        canopy.position.set(0, 0.32, -0.7);
        ship.add(canopy);

        const wingShape = new THREE.Shape();
        wingShape.moveTo(0.3, -0.9);
        wingShape.lineTo(2.5, 0.9);
        wingShape.lineTo(2.6, 1.45);
        wingShape.lineTo(0.4, 1.2);
        wingShape.closePath();

        const wingGeometry = new THREE.ExtrudeGeometry(wingShape, {
            depth: 0.1,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.03,
            bevelSegments: 1
        });
        wingGeometry.rotateX(Math.PI / 2);

        const panelShape = new THREE.Shape();
        panelShape.moveTo(0.9, 0.0);
        panelShape.lineTo(2.1, 0.95);
        panelShape.lineTo(2.1, 1.2);
        panelShape.lineTo(0.9, 1.05);
        panelShape.closePath();

        const panelGeometry = new THREE.ShapeGeometry(panelShape);
        panelGeometry.rotateX(Math.PI / 2);

        [-1, 1].forEach((side) => {
            const wing = new THREE.Mesh(wingGeometry, hull);
            wing.scale.x = side;
            ship.add(wing);

            const panel = new THREE.Mesh(panelGeometry, dark);
            panel.scale.x = side;
            panel.position.y = 0.075;
            ship.add(panel);

            const gun = new THREE.Mesh(rotatedX(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 8)), dark);
            gun.position.set(side * 2.5, 0.02, 0.4);
            ship.add(gun);

            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lightMaterial(0xff3b30));
            tip.position.set(side * 2.6, 0.08, 1.45);
            ship.add(tip);

            const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.02, 0.07), accent);
            stripe.position.set(side * 1.35, 0.09, 0.35);
            stripe.rotation.y = side * -0.69;
            ship.add(stripe);

            const engine = new THREE.Mesh(rotatedX(new THREE.CylinderGeometry(0.22, 0.27, 1.3, 16)), dark);
            engine.position.set(side * 0.58, -0.02, 1.05);
            ship.add(engine);

            const nozzle = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), lightMaterial(0xbfe8ff));
            nozzle.position.set(side * 0.58, -0.02, 1.71);
            ship.add(nozzle);
        });

        const flames = [-1, 1].map((side) => {
            const flame = new THREE.Mesh(gfx.geometries.flame, gfx.materials.flameBlue);
            flame.position.set(side * 0.58, 0, 1.72);
            ship.add(flame);
            return flame;
        });

        const glows = [-1, 1].map((side) => {
            const glow = glowSprite(0x58b4ff, 1.3);
            glow.position.set(side * 0.58, 0, 1.9);
            ship.add(glow);
            return glow;
        });

        const wrapper = normalizeModel(ship);
        wrapper.userData = { flames, glows };

        return wrapper;
    }


    function enemyEngines(group, positions, color = 0xff5a2a) {
        positions.forEach(([x, z, size]) => {
            const flame = new THREE.Mesh(gfx.geometries.flame, gfx.materials.flameRed);
            flame.position.set(x, 0, z);
            flame.scale.setScalar(size);
            group.add(flame);

            const glow = glowSprite(color, size * 1.4);
            glow.position.set(x, 0, z + 0.2);
            group.add(glow);
        });
    }


    function buildScout() {
        const ship = new THREE.Group();
        const hull = metal(0x6a707a, 0.75, 0.32);
        const red = lightMaterial(0xff2a1a);

        const body = new THREE.Mesh(rotatedX(new THREE.ConeGeometry(0.42, 2.4, 6)), hull);
        body.position.z = -0.2;
        ship.add(body);

        const wingShape = new THREE.Shape();
        wingShape.moveTo(0.2, -0.4);
        wingShape.lineTo(1.4, 0.9);
        wingShape.lineTo(0.3, 0.7);
        wingShape.closePath();

        const wingGeometry = new THREE.ExtrudeGeometry(wingShape, { depth: 0.08, bevelEnabled: false });
        wingGeometry.rotateX(Math.PI / 2);

        [-1, 1].forEach((side) => {
            const wing = new THREE.Mesh(wingGeometry, hull);
            wing.scale.x = side;
            ship.add(wing);

            const light = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.06), red);
            light.position.set(side * 0.75, 0.06, 0.3);
            light.rotation.y = side * -0.85;
            ship.add(light);
        });

        enemyEngines(ship, [[0, 1.0, 0.8]]);

        ship.rotation.y = Math.PI;
        return normalizeModel(ship);
    }


    function buildFighter() {
        const ship = new THREE.Group();
        const hull = metal(0x60666f, 0.75, 0.34);
        const dark = metal(0x1c1f24, 0.6, 0.5);
        const red = lightMaterial(0xff2a1a);

        const body = new THREE.Mesh(rotatedX(new THREE.CylinderGeometry(0.35, 0.55, 2.6, 6)), hull);
        ship.add(body);

        const nose = new THREE.Mesh(rotatedX(new THREE.ConeGeometry(0.35, 0.9, 6)), hull);
        nose.position.z = -1.75;
        ship.add(nose);

        const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), lightMaterial(0xff6040));
        cockpit.scale.set(0.8, 0.5, 1.6);
        cockpit.position.set(0, 0.3, -0.6);
        ship.add(cockpit);

        const wingShape = new THREE.Shape();
        wingShape.moveTo(0.3, 0.6);
        wingShape.lineTo(2.2, -0.6);
        wingShape.lineTo(2.3, 0.2);
        wingShape.lineTo(0.4, 1.3);
        wingShape.closePath();

        const wingGeometry = new THREE.ExtrudeGeometry(wingShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
        wingGeometry.rotateX(Math.PI / 2);

        [-1, 1].forEach((side) => {
            const wing = new THREE.Mesh(wingGeometry, hull);
            wing.scale.x = side;
            ship.add(wing);

            const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.9), dark);
            fin.position.set(side * 2.2, 0.25, -0.1);
            ship.add(fin);

            const light = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.03, 0.08), red);
            light.position.set(side * 1.25, 0.1, 0.45);
            light.rotation.y = side * 0.55;
            ship.add(light);

            const gun = new THREE.Mesh(rotatedX(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8)), dark);
            gun.position.set(side * 0.7, -0.05, -1.2);
            ship.add(gun);
        });

        enemyEngines(ship, [[-0.35, 1.4, 0.75], [0.35, 1.4, 0.75]]);

        ship.rotation.y = Math.PI;
        return normalizeModel(ship);
    }


    function buildKamikaze() {
        const ship = new THREE.Group();
        const hull = metal(0x2c3036, 0.8, 0.3);

        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({
            color: 0x401010,
            emissive: 0xff2a10,
            emissiveIntensity: 1.6,
            roughness: 0.4
        }));
        ship.add(core);

        const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), hull);
        shell.scale.set(1, 0.6, 1);
        ship.add(shell);

        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 6), hull);
            spike.position.set(Math.cos(angle) * 0.95, 0, Math.sin(angle) * 0.95);
            spike.rotation.z = -Math.PI / 2;
            spike.rotation.y = -angle;
            ship.add(spike);
        }

        ship.add(glowSprite(0xff3a1a, 2.4, 0.8));
        gfx.coreMaterials.push(core.material);

        return normalizeModel(ship);
    }


    function buildHeavy() {
        const ship = new THREE.Group();
        const hull = metal(0x70767f, 0.7, 0.38);
        const dark = metal(0x23262c, 0.6, 0.55);
        const red = lightMaterial(0xff3020);
        const amber = lightMaterial(0xffb060);

        const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.55, 6), hull);
        body.scale.z = 1.35;
        ship.add(body);

        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.2), dark);
        bridge.position.set(0, 0.45, 0.2);
        ship.add(bridge);

        [-1, 1].forEach((side) => {
            const pod = new THREE.Mesh(rotatedX(new THREE.CylinderGeometry(0.38, 0.42, 2.6, 12)), dark);
            pod.position.set(side * 1.75, 0, 0);
            ship.add(pod);

            for (let i = 0; i < 4; i++) {
                const light = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.12), amber);
                light.position.set(side * 0.9, 0.3, -0.9 + i * 0.5);
                ship.add(light);
            }
        });

        const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.1), red);
        stripe.position.set(0, 0.3, -1.1);
        ship.add(stripe);

        enemyEngines(ship, [[-1.75, 1.4, 0.9], [0, 1.6, 1.1], [1.75, 1.4, 0.9]]);

        ship.rotation.y = Math.PI;
        return normalizeModel(ship);
    }


    function buildBoss() {
        const ship = new THREE.Group();
        const hull = metal(0x5a606a, 0.75, 0.35);
        const dark = metal(0x202329, 0.6, 0.5);
        const red = lightMaterial(0xff2a1a);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.42, 16, 64), hull);
        ring.rotation.x = Math.PI / 2;
        ship.add(ring);

        const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 0.5, 48), dark);
        ship.add(disc);

        const dome = new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), hull);
        dome.position.y = 0.2;
        ship.add(dome);

        const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), new THREE.MeshStandardMaterial({
            color: 0x300808,
            emissive: 0xff2010,
            emissiveIntensity: 2.2
        }));
        core.position.y = 0.9;
        ship.add(core);

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;

            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.4, 8), dark);
            spike.position.set(Math.cos(angle) * 3.3, 0, Math.sin(angle) * 3.3);
            spike.rotation.z = -Math.PI / 2;
            spike.rotation.y = -angle;
            ship.add(spike);

            const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), red);
            light.position.set(Math.cos(angle + 0.39) * 2.6, 0.42, Math.sin(angle + 0.39) * 2.6);
            ship.add(light);
        }

        ship.add(glowSprite(0xff2a10, 3.5, 0.7));
        gfx.coreMaterials.push(core.material);

        return normalizeModel(ship);
    }


    function buildPowerUp(type) {
        const def = POWER_UPS[type];
        const group = new THREE.Group();

        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({
            color: def.color,
            emissive: def.color,
            emissiveIntensity: 0.9,
            metalness: 0.3,
            roughness: 0.15
        }));
        crystal.scale.y = 1.35;
        group.add(crystal);

        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.03, 8, 40), lightMaterial(def.color));
        halo.rotation.x = Math.PI / 2;
        group.add(halo);

        group.add(glowSprite(def.color, 2.4, 0.85));
        group.userData = { crystal, halo };

        return group;
    }


    function buildStation() {
        const station = new THREE.Group();
        const hull = metal(0x8a929e, 0.7, 0.45);
        const dark = metal(0x2e343c, 0.6, 0.55);

        const core = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 26, 20), hull);
        station.add(core);

        [5, -6].forEach((y, index) => {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(7 - index, 0.55, 12, 64), dark);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = y;
            station.add(ring);

            for (let i = 0; i < 4; i++) {
                const spoke = new THREE.Mesh(new THREE.BoxGeometry(14 - index * 2, 0.4, 0.4), hull);
                spoke.position.y = y;
                spoke.rotation.y = (i / 4) * Math.PI;
                station.add(spoke);
            }
        });

        for (let i = 0; i < 6; i++) {
            const module = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 2.4), i % 2 ? hull : dark);
            const angle = (i / 6) * Math.PI * 2;
            module.position.set(Math.cos(angle) * 3.4, rand(-9, 9), Math.sin(angle) * 3.4);
            module.rotation.y = -angle;
            station.add(module);
        }

        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9, 6), hull);
        antenna.position.y = 17;
        station.add(antenna);

        const windows = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.14, 0.04), lightMaterial(0xffc777), 260);
        const dummy = new THREE.Object3D();

        for (let i = 0; i < 260; i++) {
            const angle = rand(0, Math.PI * 2);
            const y = rand(-12, 12);

            dummy.position.set(Math.cos(angle) * 2.23, y, Math.sin(angle) * 2.23);
            dummy.lookAt(Math.cos(angle) * 5, y, Math.sin(angle) * 5);
            dummy.updateMatrix();
            windows.setMatrixAt(i, dummy.matrix);
        }

        station.add(windows);

        const beacon = glowSprite(0xff3030, 2.2, 1, true);
        beacon.position.y = 21.6;
        station.add(beacon);

        station.userData.beacon = beacon;

        return station;
    }


    function buildPlanet(loader) {
        const planet = new THREE.Group();

        const earthMaterial = new THREE.MeshStandardMaterial({
            color: 0x1d3150,
            roughness: 0.85,
            metalness: 0,
            emissive: 0xffc98a,
            emissiveIntensity: 0
        });

        const earth = new THREE.Mesh(new THREE.SphereGeometry(140, 96, 64), earthMaterial);
        earth.rotation.z = 0.35;
        planet.add(earth);

        const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(144, 96, 64), fresnelMaterial(0x5fa8ff, 2.6, 1.8));
        planet.add(atmosphere);

        loadTextureWithFallback(loader, EARTH_PATH + "earth-blue-marble.jpg", EARTH_REMOTE + "earth-blue-marble.jpg", (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = 4;
            earthMaterial.map = texture;
            earthMaterial.color.set(0xffffff);
            earthMaterial.needsUpdate = true;
        });

        loadTextureWithFallback(loader, EARTH_PATH + "earth-topology.png", EARTH_REMOTE + "earth-topology.png", (texture) => {
            earthMaterial.bumpMap = texture;
            earthMaterial.bumpScale = 4;
            earthMaterial.needsUpdate = true;
        });

        loadTextureWithFallback(loader, EARTH_PATH + "earth-night.jpg", EARTH_REMOTE + "earth-night.jpg", (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            earthMaterial.emissiveMap = texture;
            earthMaterial.emissiveIntensity = 0.55;
            earthMaterial.needsUpdate = true;
        });

        planet.userData.earth = earth;

        return planet;
    }


    function createGraphics() {
        const textures = {
            glow: radialTexture([[0, "rgba(255,255,255,1)"], [0.25, "rgba(255,255,255,0.55)"], [1, "rgba(255,255,255,0)"]]),
            fire: fireTexture(),
            smoke: smokeTexture(),
            boltBlue: boltTexture("rgba(255,255,255,1)", "rgba(80,180,255,0.9)"),
            boltRed: boltTexture("rgba(255,240,230,1)", "rgba(255,50,30,0.9)"),
            rock: rockTexture()
        };

        const additive = (map, color = 0xffffff) => new THREE.MeshBasicMaterial({
            map,
            color,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false
        });

        const geometries = {
            playerBolt: rotatedX(new THREE.PlaneGeometry(0.5, 2.8)),
            enemyBolt: rotatedX(new THREE.PlaneGeometry(0.55, 2)),
            flame: rotatedX(new THREE.PlaneGeometry(0.42, 1.6)).translate(0, 0, 0.8),
            ring: rotatedX(new THREE.RingGeometry(0.92, 1, 64)),
            shield: new THREE.SphereGeometry(1, 32, 24),
            rocks: Array.from({ length: 6 }, (_, i) => rockGeometry(i * 7.3 + 1)),
            debris: Array.from({ length: 3 }, (_, i) => rockGeometry(i * 3.1 + 50, 10, 7))
        };

        const materials = {
            playerBolt: additive(textures.boltBlue),
            enemyBolt: additive(textures.boltRed),
            flameBlue: additive(textures.boltBlue, 0x9fd8ff),
            flameRed: additive(textures.boltRed, 0xffb080),
            rock: new THREE.MeshStandardMaterial({
                map: textures.rock,
                bumpMap: textures.rock,
                bumpScale: 1.2,
                roughness: 0.95,
                metalness: 0.05
            }),
            shield: fresnelMaterial(0x5dffd0, 2.2, 1.6)
        };

        return { textures, geometries, materials, models: {}, glowMaterials: {}, coreMaterials: [] };
    }


    /* =====================================================
       SCENE
    ===================================================== */

    const backdrop = {
        rocks: [],
        dust: null,
        station: null,
        planet: null,
        lights: []
    };


    async function initScene() {
        try {
            THREE = await import(THREE_URL);
        } catch (error) {
            loadError = true;
            return;
        }

        if (disposed) {
            return;
        }

        try {
            renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: "high-performance" });
        } catch (error) {
            loadError = true;
            return;
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(W, H, false);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x02040a);

        camera = new THREE.PerspectiveCamera(30, W / H, 0.5, 3000);
        camera.position.set(...CAMERA_POSITION);
        camera.lookAt(...CAMERA_TARGET);

        raycaster = new THREE.Raycaster();
        groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        gfx = createGraphics();

        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin("anonymous");

        /* Lights */
        scene.add(new THREE.AmbientLight(0x6070a0, 0.35));
        scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x2a2030, 1.1));

        const sun = new THREE.DirectionalLight(0xfff1dd, 3.2);
        sun.position.set(-60, 70, -20);
        scene.add(sun);

        const fill = new THREE.DirectionalLight(0x8aa4dd, 1.7);
        fill.position.set(20, 25, 40);
        scene.add(fill);

        for (let i = 0; i < 3; i++) {
            const light = new THREE.PointLight(0xff9a50, 0, 30, 2);
            light.position.y = 2;
            scene.add(light);
            backdrop.lights.push(light);
        }

        /* Nebula sky + reflections */
        const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x03050b, side: THREE.BackSide, depthWrite: false });
        const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 32), skyMaterial);
        scene.add(sky);

        loadTextureWithFallback(loader, NEBULA_URL, NEBULA_REMOTE, (texture) => {
            if (disposed) {
                return;
            }

            texture.colorSpace = THREE.SRGBColorSpace;
            texture.mapping = THREE.EquirectangularReflectionMapping;

            const pmrem = new THREE.PMREMGenerator(renderer);
            scene.environment = pmrem.fromEquirectangular(texture).texture;
            scene.environmentIntensity = 0.7;
            pmrem.dispose();
        });

        /* Nebula clouds: large soft sprites far away */
        [
            [-260, -420, -700, 900, 0x5a2a8a, 0.55],
            [320, -520, -650, 800, 0x1d4a9a, 0.5],
            [-80, -700, -500, 700, 0x7a2a5a, 0.35],
            [150, -260, -820, 1000, 0x2a3a8a, 0.45],
            [-420, -560, -380, 600, 0x1a5a8a, 0.35]
        ].forEach(([x, y, z, size, color, opacity]) => {
            const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
                map: gfx.textures.smoke,
                color,
                opacity,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                rotation: rand(0, Math.PI * 2)
            }));

            cloud.position.set(x, y, z);
            cloud.scale.setScalar(size);
            scene.add(cloud);
        });

        /* Stars */
        const starCount = 2600;
        const starPositions = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(1200);
            const brightness = rand(0.4, 1);
            const warm = Math.random() < 0.2;

            starPositions.set([v.x, v.y, v.z], i * 3);
            starColors.set([brightness, brightness * (warm ? 0.85 : 0.95), brightness * (warm ? 0.7 : 1)], i * 3);
        }

        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
        starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

        scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({
            size: 1.7,
            sizeAttenuation: false,
            vertexColors: true,
            transparent: true,
            depthWrite: false
        })));

        /* Planet + sun glare */
        backdrop.planet = buildPlanet(loader);
        backdrop.planet.position.set(215, -290, -320);
        scene.add(backdrop.planet);

        const glare = glowSprite(0xfff0d0, 160, 0.9);
        glare.position.set(-10, -60, -460);
        scene.add(glare);

        const glareCore = glowSprite(0xffffff, 50, 1);
        glareCore.position.copy(glare.position);
        scene.add(glareCore);

        /* Space station */
        backdrop.station = buildStation();
        backdrop.station.position.set(34, -14, -115);
        backdrop.station.rotation.z = 0.18;
        scene.add(backdrop.station);

        /* Background asteroid field */
        const farRock = gfx.materials.rock.clone();
        farRock.color.set(0xa0a0a8);

        for (let i = 0; i < 30; i++) {
            const nearSide = i < 12;
            const side = nearSide ? (i % 2 ? 1 : -1) : (Math.random() < 0.8 ? -1 : 1);
            const rock = new THREE.Mesh(pick(gfx.geometries.rocks), nearSide ? gfx.materials.rock : farRock);

            rock.position.set(
                nearSide ? side * rand(27, 40) : side * rand(30, 120),
                nearSide ? rand(-8, -3) : rand(-60, -20),
                nearSide ? rand(-90, 15) : rand(-220, -40)
            );

            rock.scale.setScalar(nearSide ? rand(1.4, 3.2) : rand(2, 7));
            rock.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
            rock.userData = { speed: rand(5, 13), spin: [rand(-0.4, 0.4), rand(-0.4, 0.4)] };

            scene.add(rock);
            backdrop.rocks.push(rock);
        }

        /* Space dust for a sense of speed */
        const dustCount = 500;
        const dustPositions = new Float32Array(dustCount * 3);

        for (let i = 0; i < dustCount; i++) {
            dustPositions.set([rand(-40, 40), rand(-20, 8), rand(-100, 20)], i * 3);
        }

        const dustGeometry = new THREE.BufferGeometry();
        dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));

        backdrop.dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
            color: 0xaabbdd,
            size: 0.09,
            transparent: true,
            opacity: 0.6,
            depthWrite: false
        }));

        scene.add(backdrop.dust);

        /* Models */
        gfx.models.player = buildPlayerShip();
        gfx.models.scout = buildScout();
        gfx.models.fighter = buildFighter();
        gfx.models.kamikaze = buildKamikaze();
        gfx.models.heavy = buildHeavy();
        gfx.models.boss = buildBoss();

        player.obj = gfx.models.player;
        player.obj.scale.setScalar(1.7);
        scene.add(player.obj);

        player.shield = new THREE.Mesh(gfx.geometries.shield, gfx.materials.shield);
        player.shield.visible = false;
        scene.add(player.shield);

        state = "ready";
        resetGame();
        player.y = 470;
    }


    function cloneModel(name) {
        return gfx.models[name].clone(true);
    }


    function attach(item, obj) {
        item.obj = obj;
        scene.add(obj);
        return item;
    }


    function detach(item) {
        if (item.obj) {
            scene.remove(item.obj);

            if (item.ownMaterial) {
                item.obj.material.dispose();
            }

            item.obj = null;
        }
    }


    function prune(list, keep) {
        return list.filter((item) => {
            if (keep(item)) {
                return true;
            }

            detach(item);
            return false;
        });
    }


    /* =====================================================
       GAME LOGIC
    ===================================================== */

    function resetGame() {
        [...bullets, ...enemyShots, ...enemies, ...powerUps, ...particles].forEach(detach);

        if (boss) {
            detach(boss);
        }

        player.x = W / 2;
        player.y = H - 90;
        player.tilt = 0;

        bullets = [];
        enemyShots = [];
        enemies = [];
        boss = null;
        powerUps = [];
        particles = [];
        texts = [];

        score = 0;
        level = 1;
        kills = 0;
        levelStartKills = 0;
        nextLevelAt = 14;
        combo = 0;
        comboTimer = 0;
        bombs = 2;
        weapon = 1;
        hp = 100;
        shieldTime = 0;
        invulnerable = 0;
        fireCooldown = 0;
        spawnTimer = 1;
        shake = 0;
        flash = 0;
        dyingTimer = 0;
        newRecord = false;

        if (player.obj) {
            player.obj.visible = true;
        }

        showBanner(tr("NIVEAU 1", "LEVEL 1"), tr("Bonne chance !", "Good luck!"), 2.2);
    }


    function startGame() {
        if (state === "loading") {
            return;
        }

        resetGame();
        state = "playing";
        last = performance.now();
    }


    function showBanner(text, subtitle, duration) {
        banner = { text, subtitle, time: duration, duration };
    }


    function comboMultiplier() {
        return Math.min(5, 1 + Math.floor(combo / 5));
    }


    function floatingText(gx, gy, text, color, size = 16) {
        texts.push({ wx: worldX(gx), wz: worldZ(gy), text, color, size, life: 0.9, max: 0.9, rise: 0 });
    }


    function pickEnemyType() {
        const pool = ["scout", "scout", "meteorBig", "meteorMed"];

        if (level >= 2) pool.push("fighter", "fighter");
        if (level >= 3) pool.push("kamikaze");
        if (level >= 4) pool.push("heavy");
        if (level >= 6) pool.push("heavy", "fighter", "kamikaze");

        return pick(pool);
    }


    function spawnEnemy(type, options = {}) {
        const def = ENEMIES[type];
        const size = def.size;
        const speedBoost = 1 + (level - 1) * 0.06;
        const hpBonus = def.meteor ? 0 : Math.floor((level - 1) / 4);
        const x = options.x ?? rand(size / 2 + 10, W - size / 2 - 10);

        let obj;

        if (def.meteor) {
            obj = new THREE.Mesh(pick(gfx.geometries.rocks), gfx.materials.rock);
            obj.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
        } else {
            obj = cloneModel(type);
        }

        const baseScale = (size * SX) / (def.meteor ? 1.7 : 1.25);
        obj.scale.setScalar(baseScale);

        enemies.push(attach({
            type,
            def,
            x,
            baseX: x,
            y: options.y ?? -size,
            w: size,
            h: size,
            radius: size * 0.42,
            baseScale,
            vx: options.vx ?? (def.meteor ? rand(-40, 40) : 0),
            vy: options.vy ?? rand(def.speed[0], def.speed[1]) * speedBoost,
            hp: def.hp + hpBonus,
            maxHp: def.hp + hpBonus,
            spin: def.meteor ? [rand(-1.6, 1.6), rand(-1.2, 1.2)] : [0, 0],
            rx: rand(0, 6),
            ry: rand(0, 6),
            phase: rand(0, Math.PI * 2),
            shootTimer: rand(1, 2.2),
            hitFlash: 0,
            dead: false
        }, obj));
    }


    function spawnWave() {
        if (level >= 3 && Math.random() < 0.14) {
            const centerX = rand(140, W - 140);
            const speed = 190 * (1 + (level - 1) * 0.05);

            for (let i = -2; i <= 2; i++) {
                spawnEnemy("scout", { x: centerX + i * 48, y: -40 - Math.abs(i) * 38, vy: speed });
            }

            return;
        }

        spawnEnemy(pickEnemyType());
    }


    function spawnBoss() {
        const maxHp = 45 + level * 9;
        const obj = cloneModel("boss");

        obj.scale.setScalar((150 * SX) / 1.3);

        boss = attach({
            x: W / 2,
            y: -90,
            radius: 66,
            hp: maxHp,
            maxHp,
            rotation: 0,
            attackTimer: 2,
            pattern: 0,
            entering: true,
            hitFlash: 0
        }, obj);
    }


    function dropPowerUp(x, y) {
        const weights = [
            ["weapon", weapon < 4 ? 26 : 0],
            ["shield", 18],
            ["heal", hp < 60 ? 30 : 12],
            ["bomb", bombs < 3 ? 12 : 0],
            ["gold", 20]
        ];

        const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
        let roll = Math.random() * total;

        for (const [type, weight] of weights) {
            roll -= weight;

            if (roll <= 0) {
                powerUps.push(attach({ type, x, y, vy: 105, t: rand(0, 6) }, buildPowerUp(type)));
                return;
            }
        }
    }


    function shoot() {
        WEAPON_PATTERNS[weapon].forEach(([dx, angle]) => {
            const obj = new THREE.Mesh(gfx.geometries.playerBolt, gfx.materials.playerBolt);
            obj.add(glowSprite(0x58b4ff, 1.2, 0.6));

            bullets.push(attach({
                x: player.x + dx,
                y: player.y - player.h / 2,
                vx: Math.sin(angle) * 720,
                vy: -Math.cos(angle) * 720
            }, obj));
        });

        fireCooldown = weapon >= 4 ? 0.14 : 0.17;

        gameAudio.play("sfx_laser1", 0.1);
    }


    function enemyFire(x, y, angle, speed) {
        const obj = new THREE.Mesh(gfx.geometries.enemyBolt, gfx.materials.enemyBolt);
        obj.add(glowSprite(0xff3a20, 1.3, 0.7));

        enemyShots.push(attach({
            x,
            y,
            vx: Math.sin(angle) * speed,
            vy: Math.cos(angle) * speed
        }, obj));
    }


    /* -----------------------------------------------------
       PARTICLES (world space)
    ----------------------------------------------------- */

    function addSprite(kind, x, y, z, options) {
        const material = new THREE.SpriteMaterial({
            map: options.map,
            color: options.color,
            transparent: true,
            opacity: options.opacity ?? 1,
            blending: options.normal ? THREE.NormalBlending : THREE.AdditiveBlending,
            depthWrite: false,
            rotation: rand(0, Math.PI * 2)
        });

        const sprite = new THREE.Sprite(material);
        sprite.position.set(x, y, z);
        sprite.scale.setScalar(options.from);

        particles.push(attach({
            kind,
            vx: options.vx || 0,
            vy: options.vy || 0,
            vz: options.vz || 0,
            from: options.from,
            to: options.to,
            alpha: options.opacity ?? 1,
            spin: options.spin || 0,
            life: options.life,
            max: options.life,
            ownMaterial: true
        }, sprite));
    }


    function addRing(x, z, radius, color, life) {
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false
        });

        const ring = new THREE.Mesh(gfx.geometries.ring, material);
        ring.position.set(x, 0.3, z);

        particles.push(attach({
            kind: "ring",
            from: 0.3,
            to: radius,
            alpha: 1,
            life,
            max: life,
            ownMaterial: true
        }, ring));
    }


    function addDebris(x, z, scale) {
        for (let i = 0; i < 7; i++) {
            const chunk = new THREE.Mesh(pick(gfx.geometries.debris), gfx.materials.rock);
            const angle = rand(0, Math.PI * 2);
            const speed = rand(3, 9) * scale;

            chunk.position.set(x, 0, z);
            chunk.scale.setScalar(rand(0.12, 0.3) * scale);

            particles.push(attach({
                kind: "debris",
                vx: Math.cos(angle) * speed,
                vy: rand(1, 5),
                vz: Math.sin(angle) * speed,
                spin: rand(-6, 6),
                life: rand(0.8, 1.4),
                max: 1.4
            }, chunk));
        }
    }


    let lightIndex = 0;

    function explosionLight(x, z, strength) {
        const light = backdrop.lights[lightIndex % backdrop.lights.length];
        lightIndex += 1;

        light.position.set(x, 2.5, z);
        light.intensity = 140 * strength;
    }


    function explode(gx, gy, scale = 1, tint = "fire", rocky = false) {
        const x = worldX(gx);
        const z = worldZ(gy);
        const blue = tint === "blue";

        addSprite("flash", x, 0.5, z, { map: gfx.textures.glow, color: 0xffffff, from: 2 * scale, to: 8 * scale, life: 0.25 });

        for (let i = 0; i < Math.round(7 * scale) + 3; i++) {
            addSprite("fire", x + rand(-0.4, 0.4) * scale, rand(0, 0.8), z + rand(-0.4, 0.4) * scale, {
                map: gfx.textures.fire,
                color: blue ? pick([0x9fd8ff, 0x58b4ff, 0xffffff]) : pick([0xffb347, 0xff7a2a, 0xffd27a, 0xff5a2a]),
                from: rand(0.9, 1.6) * scale,
                to: rand(3.2, 5) * scale,
                vx: rand(-1.5, 1.5) * scale,
                vz: rand(-1.5, 1.5) * scale,
                vy: rand(0, 1.2),
                spin: rand(-2, 2),
                life: rand(0.35, 0.7)
            });
        }

        for (let i = 0; i < Math.round(5 * scale) + 2; i++) {
            addSprite("smoke", x + rand(-0.5, 0.5) * scale, rand(0.2, 1), z + rand(-0.5, 0.5) * scale, {
                map: gfx.textures.smoke,
                color: rocky ? 0x6b6258 : 0x4a4a52,
                normal: true,
                opacity: 0.55,
                from: rand(1, 1.6) * scale,
                to: rand(3.5, 5) * scale,
                vx: rand(-0.8, 0.8),
                vz: rand(-0.8, 0.8),
                vy: rand(0.3, 1),
                spin: rand(-0.8, 0.8),
                life: rand(1, 1.6)
            });
        }

        for (let i = 0; i < Math.round(14 * scale) + 6; i++) {
            const angle = rand(0, Math.PI * 2);
            const speed = rand(6, 16) * Math.sqrt(scale);

            addSprite("spark", x, 0.4, z, {
                map: gfx.textures.glow,
                color: blue ? 0xbfe8ff : pick([0xffe0a0, 0xffa050, 0xffffff]),
                from: rand(0.15, 0.3),
                to: 0.05,
                vx: Math.cos(angle) * speed,
                vz: Math.sin(angle) * speed,
                vy: rand(-1, 4),
                life: rand(0.3, 0.7)
            });
        }

        if (rocky) {
            addDebris(x, z, scale);
        }

        addRing(x, z, 3.2 * scale, blue ? 0x8fd0ff : 0xffb070, 0.45);
        explosionLight(x, z, scale);
    }


    function hitSpark(gx, gy, color) {
        addSprite("flash", worldX(gx), 0.4, worldZ(gy), { map: gfx.textures.glow, color, from: 0.6, to: 1.6, life: 0.14 });
    }


    /* -----------------------------------------------------
       ACTIONS
    ----------------------------------------------------- */

    function useBomb() {
        if (state !== "playing" || bombs <= 0) {
            return;
        }

        bombs -= 1;
        flash = 1;
        shake = 1.2;

        enemyShots.forEach(detach);
        enemyShots = [];

        addRing(worldX(player.x), worldZ(player.y), 40, 0xffc070, 0.8);
        explosionLight(worldX(player.x), worldZ(player.y), 2);

        enemies.forEach((enemy) => damageEnemy(enemy, 8));

        if (boss) {
            damageBoss(15);
        }

        gameAudio.play("sfx_twoTone", 0.4, 0.6);
    }


    function togglePause() {
        if (state === "playing") {
            state = "paused";
        } else if (state === "paused") {
            state = "playing";
            last = performance.now();
        }
    }


    function damageEnemy(enemy, amount) {
        if (enemy.dead) {
            return;
        }

        enemy.hp -= amount;
        enemy.hitFlash = 0.1;

        if (enemy.hp <= 0) {
            killEnemy(enemy);
        }
    }


    function killEnemy(enemy) {
        enemy.dead = true;

        combo += 1;
        comboTimer = 2.4;

        const points = enemy.def.score * comboMultiplier();

        score += points;
        kills += 1;

        explode(enemy.x, enemy.y, enemy.w / 60, "fire", enemy.def.meteor);
        floatingText(enemy.x, enemy.y, `+${points}`, "#ffe6a8");
        gameAudio.play("sfx_laser2", 0.22, 0.5);

        if (enemy.def.splits) {
            [-1, 1].forEach((side) => {
                spawnEnemy(enemy.def.splits, {
                    x: enemy.x + side * 10,
                    y: enemy.y,
                    vx: side * rand(60, 110),
                    vy: enemy.vy * 0.9 + 20
                });
            });
        }

        if (Math.random() < enemy.def.drop) {
            dropPowerUp(enemy.x, enemy.y);
        }

        if (!boss && kills >= nextLevelAt) {
            levelUp();
        }
    }


    function damageBoss(amount) {
        boss.hp -= amount;
        boss.hitFlash = 0.08;

        if (boss.hp <= 0) {
            killBoss();
        }
    }


    function killBoss() {
        const { x, y } = boss;
        const points = 2500 * comboMultiplier();

        for (let i = 0; i < 6; i++) {
            explode(x + rand(-60, 60), y + rand(-60, 60), rand(1.3, 2.3));
        }

        score += points;
        kills += 1;

        detach(boss);
        boss = null;

        shake = 1.8;
        flash = 0.6;

        floatingText(x, y, `+${points}`, "#ffd36b", 26);

        for (let i = 0; i < 3; i++) {
            dropPowerUp(x + (i - 1) * 50, y);
        }

        gameAudio.play("sfx_laser2", 0.4, 0.35);

        levelUp();
        showBanner(tr("BOSS VAINCU !", "BOSS DEFEATED!"), tr(`Niveau ${level}`, `Level ${level}`), 2.6);
    }


    function levelUp() {
        level += 1;
        levelStartKills = kills;
        nextLevelAt = kills + 12 + level * 2;
        hp = Math.min(100, hp + 10);

        gameAudio.play("sfx_twoTone", 0.3);

        if (level % 5 === 0) {
            spawnBoss();
            showBanner("BOSS", tr("Détruisez le vaisseau mère !", "Destroy the mothership!"), 2.6);
        } else {
            showBanner(
                tr(`NIVEAU ${level}`, `LEVEL ${level}`),
                tr("+10 HP • Les ennemis accélèrent", "+10 HP • Enemies speed up"),
                2.2
            );
        }
    }


    function applyPowerUp(item) {
        const def = POWER_UPS[item.type];

        if (item.type === "weapon") weapon = Math.min(4, weapon + 1);
        if (item.type === "shield") shieldTime = 7;
        if (item.type === "heal") hp = Math.min(100, hp + 25);
        if (item.type === "bomb") bombs = Math.min(3, bombs + 1);
        if (item.type === "gold") score += 500;

        floatingText(item.x, item.y - 16, def.label(), `rgb(${def.css})`, 15);
        addRing(worldX(item.x), worldZ(item.y), 2, def.color, 0.4);
        gameAudio.play("sfx_shieldUp", 0.3);
    }


    function hurtPlayer(damage) {
        if (state !== "playing" || invulnerable > 0) {
            return;
        }

        if (shieldTime > 0) {
            shake = Math.max(shake, 0.3);
            addRing(worldX(player.x), worldZ(player.y), 2.2, 0x5dffd0, 0.3);
            gameAudio.play("sfx_zap", 0.25);
            return;
        }

        hp -= damage;
        invulnerable = 1.1;
        shake = 1;
        combo = 0;
        weapon = Math.max(1, weapon - 1);

        hitSpark(player.x, player.y, 0xff6040);
        floatingText(player.x, player.y - 40, `-${damage}`, "#ff8b8b", 17);
        gameAudio.play("sfx_shieldDown", 0.35);

        if (hp <= 0) {
            hp = 0;
            state = "dying";
            dyingTimer = 1.6;

            explode(player.x, player.y, 2.6, "blue");
            explode(player.x, player.y, 1.6, "fire");
            player.obj.visible = false;
            player.shield.visible = false;
            gameAudio.play("sfx_lose", 0.4);
        }
    }


    /* -----------------------------------------------------
       INPUT
    ----------------------------------------------------- */

    function setDirection(code, pressed) {
        if (code === "ArrowLeft" || code === "KeyA") input.left = pressed;
        if (code === "ArrowRight" || code === "KeyD") input.right = pressed;
        if (code === "ArrowUp" || code === "KeyW") input.up = pressed;
        if (code === "ArrowDown" || code === "KeyS") input.down = pressed;
        if (code === "Space") input.fire = pressed;
    }


    function canStart() {
        return state === "ready" || (state === "over" && overTime > 0.8);
    }


    function screenToGame(point) {
        const ndc = new THREE.Vector2((point.x / W) * 2 - 1, -(point.y / H) * 2 + 1);
        const hit = new THREE.Vector3();

        camera.position.set(...CAMERA_POSITION);
        raycaster.setFromCamera(ndc, camera);

        if (!raycaster.ray.intersectPlane(groundPlane, hit)) {
            return null;
        }

        return { x: hit.x / SX + W / 2, y: hit.z / SZ + H };
    }


    bag.on(window, "keydown", (event) => {
        const key = event.key.toLowerCase();

        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
            event.preventDefault();
        }

        if ((event.code === "Space" || event.code === "Enter") && (state === "ready" || state === "over")) {
            if (!event.repeat && canStart()) {
                startGame();
            }

            return;
        }

        setDirection(event.code, true);

        if (key === "x" || key === "b") useBomb();
        if (key === "p") togglePause();
        if (key === "r") startGame();

        if (key === "m") {
            gameAudio.toggle();
            sound.update();
        }
    });


    bag.on(window, "keyup", (event) => {
        if (event.code === "Space") {
            event.preventDefault();
        }

        setDirection(event.code, false);
    });


    bag.on(canvas, "pointerdown", (event) => {
        event.preventDefault();

        const point = canvasPoint(event);
        const onPause =
            point.x >= PAUSE_BUTTON.x && point.x <= PAUSE_BUTTON.x + PAUSE_BUTTON.w &&
            point.y >= PAUSE_BUTTON.y && point.y <= PAUSE_BUTTON.y + PAUSE_BUTTON.h;

        if (onPause && (state === "playing" || state === "paused")) {
            togglePause();
            return;
        }

        if (canStart()) {
            startGame();
        } else if (state === "paused") {
            togglePause();
        }

        if (state === "playing") {
            input.pointerId = event.pointerId;
            input.target = screenToGame(point);

            try {
                canvas.setPointerCapture(event.pointerId);
            } catch (error) {
                /* Pointer capture is optional. */
            }
        }
    });


    bag.on(canvas, "pointermove", (event) => {
        if (event.pointerId === input.pointerId) {
            input.target = screenToGame(canvasPoint(event));
        }
    });


    ["pointerup", "pointercancel"].forEach((type) => {
        bag.on(canvas, type, (event) => {
            if (event.pointerId === input.pointerId) {
                input.pointerId = null;
                input.target = null;
            }
        });
    });


    function holdButton(button, property) {
        bag.on(button, "pointerdown", (event) => {
            event.preventDefault();
            input[property] = true;

            if (property === "touchFire" && canStart()) {
                startGame();
            }
        });

        ["pointerup", "pointerleave", "pointercancel"].forEach((type) => {
            bag.on(button, type, () => {
                input[property] = false;
            });
        });
    }


    holdButton(leftButton, "touchLeft");
    holdButton(rightButton, "touchRight");
    holdButton(fireButton, "touchFire");

    bag.on(bombButton, "pointerdown", (event) => {
        event.preventDefault();
        useBomb();
    });

    bag.on(restartButton, "click", () => {
        startGame();
        restartButton.blur();
    });

    bag.on(document, "visibilitychange", () => {
        if (document.hidden && state === "playing") {
            togglePause();
        }
    });


    /* -----------------------------------------------------
       UPDATE
    ----------------------------------------------------- */

    function updatePlayer(dt) {
        let steer = 0;

        if (input.target) {
            const dx = input.target.x - player.x;
            const dy = input.target.y - 50 - player.y;
            const distance = Math.hypot(dx, dy);
            const step = Math.min(distance, 640 * dt);

            if (distance > 1) {
                player.x += (dx / distance) * step;
                player.y += (dy / distance) * step;
            }

            steer = clampValue(dx / 60, -1, 1);
        } else {
            const dx = (input.right || input.touchRight ? 1 : 0) - (input.left || input.touchLeft ? 1 : 0);
            const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
            const length = Math.hypot(dx, dy) || 1;

            player.x += (dx / length) * PLAYER_SPEED * dt;
            player.y += (dy / length) * PLAYER_SPEED * dt;

            steer = dx;
        }

        player.x = clampValue(player.x, player.w / 2 + 4, W - player.w / 2 - 4);
        player.y = clampValue(player.y, H * 0.3, H - 50);
        player.tilt += (steer * 0.26 - player.tilt) * Math.min(1, dt * 8);

        fireCooldown -= dt;

        if ((input.fire || input.touchFire || input.target) && fireCooldown <= 0) {
            shoot();
        }

        invulnerable = Math.max(0, invulnerable - dt);
        shieldTime = Math.max(0, shieldTime - dt);
        comboTimer -= dt;

        if (comboTimer <= 0) {
            combo = 0;
        }

        if (!boss) {
            spawnTimer -= dt;

            if (spawnTimer <= 0) {
                spawnWave();
                spawnTimer = Math.max(0.32, 1.15 - level * 0.07) * rand(0.7, 1.3);
            }
        }
    }


    function updateEnemy(enemy, dt) {
        const def = enemy.def;

        if (def.wave) {
            enemy.baseX += enemy.vx * dt;
            enemy.x = enemy.baseX + Math.sin(time * 2.2 + enemy.phase) * 55;
        } else {
            enemy.x += enemy.vx * dt;
        }

        if (def.homing && state === "playing") {
            enemy.vx = clampValue(enemy.vx + Math.sign(player.x - enemy.x) * 260 * dt, -170, 170);
            enemy.vy += 30 * dt;
        }

        if (def.meteor && (enemy.x < enemy.w / 2 || enemy.x > W - enemy.w / 2)) {
            enemy.vx = Math.abs(enemy.vx) * (enemy.x < W / 2 ? 1 : -1);
        }

        enemy.y += enemy.vy * dt;
        enemy.hitFlash -= dt;
        enemy.rx += enemy.spin[0] * dt;
        enemy.ry += enemy.spin[1] * dt;

        if (def.shoots && state === "playing" && enemy.y > 30 && enemy.y < H * 0.65) {
            enemy.shootTimer -= dt;

            if (enemy.shootTimer <= 0) {
                const muzzleY = enemy.y + enemy.h / 2;

                if (def.shoots === "aimed") {
                    enemyFire(enemy.x, muzzleY, Math.atan2(player.x - enemy.x, player.y - enemy.y), 250 + level * 8);
                } else {
                    [-0.3, 0, 0.3].forEach((angle) => enemyFire(enemy.x, muzzleY, angle, 210 + level * 6));
                }

                enemy.shootTimer = rand(1.5, 2.6) / (1 + level * 0.06);
            }
        }

        if (enemy.y > H + enemy.h * 2) {
            enemy.dead = true;
        }
    }


    function updateBoss(dt) {
        boss.rotation += dt * 0.9;
        boss.hitFlash -= dt;

        if (boss.entering) {
            boss.y += 70 * dt;

            if (boss.y >= 190) {
                boss.entering = false;
            }

            return;
        }

        boss.x = W / 2 + Math.sin(time * 0.7) * (W / 2 - 110);
        boss.y = 190 + Math.sin(time * 1.3) * 18;

        if (state !== "playing") {
            return;
        }

        boss.attackTimer -= dt;

        if (boss.attackTimer <= 0) {
            const pattern = boss.pattern % 3;

            if (pattern === 0) {
                for (let i = 0; i < 14; i++) {
                    enemyFire(boss.x, boss.y, (i / 14) * Math.PI * 2 + boss.rotation, 190);
                }
            } else if (pattern === 1) {
                const aim = Math.atan2(player.x - boss.x, player.y - boss.y);

                [-0.18, 0, 0.18].forEach((offset) => enemyFire(boss.x, boss.y + 50, aim + offset, 280));
            } else {
                for (let i = 0; i < 10; i++) {
                    enemyFire(boss.x, boss.y, (i / 10) * Math.PI * 2 - boss.rotation, 160);
                }

                spawnEnemy("scout", { x: boss.x - 70, y: boss.y });
                spawnEnemy("scout", { x: boss.x + 70, y: boss.y });
            }

            boss.pattern += 1;
            boss.attackTimer = Math.max(0.9, 1.8 - level * 0.04);
            gameAudio.play("sfx_laser2", 0.12, 0.8);
        }
    }


    function updateParticles(dt) {
        const drag = Math.pow(0.12, dt);

        particles.forEach((particle) => {
            const obj = particle.obj;
            const progress = 1 - particle.life / particle.max;

            particle.life -= dt;

            if (particle.kind === "debris") {
                particle.vy -= 9 * dt;
                obj.position.x += particle.vx * dt;
                obj.position.y += particle.vy * dt;
                obj.position.z += particle.vz * dt;
                obj.rotation.x += particle.spin * dt;
                obj.rotation.y += particle.spin * 0.7 * dt;
                return;
            }

            if (particle.kind === "ring") {
                obj.scale.setScalar(particle.from + (particle.to - particle.from) * (1 - Math.pow(1 - progress, 3)));
                obj.material.opacity = Math.max(0, 1 - progress);
                return;
            }

            obj.position.x += particle.vx * dt;
            obj.position.y += particle.vy * dt;
            obj.position.z += particle.vz * dt;

            particle.vx *= drag;
            particle.vz *= drag;

            const eased = 1 - Math.pow(1 - progress, 2);
            obj.scale.setScalar(particle.from + (particle.to - particle.from) * eased);
            obj.material.rotation += particle.spin * dt;
            obj.material.opacity = particle.alpha * Math.max(0, 1 - progress) * (particle.kind === "fire" ? 1.2 - progress * 0.4 : 1);
        });

        particles = prune(particles, (particle) => particle.life > 0);

        backdrop.lights.forEach((light) => {
            light.intensity *= Math.pow(0.002, dt);
        });
    }


    function handleCollisions() {
        bullets.forEach((bullet) => {
            for (const enemy of enemies) {
                if (!enemy.dead && Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < enemy.radius + 4) {
                    bullet.dead = true;
                    hitSpark(bullet.x, bullet.y, 0x9fd8ff);
                    damageEnemy(enemy, 1);
                    return;
                }
            }

            if (boss && !boss.entering && Math.hypot(bullet.x - boss.x, bullet.y - boss.y) < boss.radius) {
                bullet.dead = true;
                hitSpark(bullet.x, bullet.y, 0x9fd8ff);
                damageBoss(1);
            }
        });

        if (state !== "playing") {
            return;
        }

        const playerRadius = 22;

        enemyShots.forEach((shot) => {
            if (!shot.dead && Math.hypot(shot.x - player.x, shot.y - player.y) < playerRadius + 4) {
                shot.dead = true;
                hurtPlayer(12 + level);
            }
        });

        enemies.forEach((enemy) => {
            if (!enemy.dead && Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.radius + playerRadius) {
                hurtPlayer(enemy.def.damage);
                damageEnemy(enemy, enemy.def.meteor ? 99 : 3);
            }
        });

        if (boss && Math.hypot(boss.x - player.x, boss.y - player.y) < boss.radius + playerRadius) {
            hurtPlayer(40);
        }

        powerUps.forEach((item) => {
            if (!item.taken && Math.hypot(item.x - player.x, item.y - player.y) < 40) {
                item.taken = true;
                applyPowerUp(item);
            }
        });
    }


    function updateWorld(dt) {
        [...bullets, ...enemyShots].forEach((shot) => {
            shot.x += shot.vx * dt;
            shot.y += shot.vy * dt;
        });

        enemies.forEach((enemy) => updateEnemy(enemy, dt));

        if (boss) {
            updateBoss(dt);
        }

        powerUps.forEach((item) => {
            item.t += dt;
            item.y += item.vy * dt;
            item.x += Math.sin(item.t * 3) * 22 * dt;
        });

        texts.forEach((text) => {
            text.rise += 42 * dt;
            text.life -= dt;
        });

        handleCollisions();

        bullets = prune(bullets, (b) => !b.dead && b.y > -120 && b.x > -60 && b.x < W + 60);
        enemyShots = prune(enemyShots, (s) => !s.dead && s.y > -120 && s.y < H + 60 && s.x > -80 && s.x < W + 80);
        enemies = prune(enemies, (e) => !e.dead);
        powerUps = prune(powerUps, (p) => !p.taken && p.y < H + 40);
        texts = texts.filter((t) => t.life > 0);
    }


    function updateBackdrop(dt) {
        const boost = state === "playing" ? 1 + level * 0.05 : 1;

        backdrop.rocks.forEach((rock) => {
            rock.position.z += rock.userData.speed * boost * dt;
            rock.rotation.x += rock.userData.spin[0] * dt;
            rock.rotation.y += rock.userData.spin[1] * dt;

            if (rock.position.z > 25) {
                rock.position.z = -200;
            }
        });

        const dust = backdrop.dust.geometry.attributes.position;

        for (let i = 0; i < dust.count; i++) {
            let z = dust.getZ(i) + 32 * boost * dt;

            if (z > 20) {
                z -= 120;
            }

            dust.setZ(i, z);
        }

        dust.needsUpdate = true;

        backdrop.planet.userData.earth.rotation.y += dt * 0.008;
        backdrop.station.rotation.y += dt * 0.05;
        backdrop.station.userData.beacon.material.opacity = Math.sin(time * 4) > 0.6 ? 1 : 0.15;
    }


    function update(dt) {
        time += dt;

        if (state === "loading") {
            return;
        }

        updateBackdrop(dt);

        if (state === "ready" || state === "paused") {
            return;
        }

        if (banner) {
            banner.time -= dt;

            if (banner.time <= 0) {
                banner = null;
            }
        }

        shake = Math.max(0, shake - dt * 2.5);
        flash = Math.max(0, flash - dt * 1.8);

        if (state === "playing") {
            updatePlayer(dt);
        }

        if (state === "dying") {
            dyingTimer -= dt;

            if (dyingTimer <= 0) {
                state = "over";
                overTime = 0;

                if (score > highScore) {
                    highScore = score;
                    newRecord = true;
                    safeSet(HIGH_SCORE_KEY, String(highScore));
                }
            }
        }

        if (state === "over") {
            overTime += dt;
        }

        updateWorld(dt);
        updateParticles(dt);
    }


    /* -----------------------------------------------------
       SYNC 3D SCENE
    ----------------------------------------------------- */

    /* Far objects get a gentle size boost so they stay readable. */
    function depthBoost(z) {
        const dy = CAMERA_POSITION[1];
        const dz = CAMERA_POSITION[2] - z;
        const reference = Math.hypot(dy, CAMERA_POSITION[2] - worldZ(H - 90));

        return Math.max(1, Math.pow(Math.hypot(dy, dz) / reference, 0.75));
    }


    function headingFromVelocity(vx, vy) {
        return Math.atan2(vx * SX, vy * SZ);
    }


    function syncScene() {
        const p = player.obj;
        const idle = state === "ready";
        const py = idle ? 390 + Math.sin(time * 2) * 10 : player.y;

        p.position.set(worldX(player.x), idle ? 0.3 + Math.sin(time * 1.6) * 0.15 : 0, worldZ(py));
        p.rotation.z = -player.tilt * 2.2 + (idle ? Math.sin(time * 1.3) * 0.08 : 0);
        p.rotation.y = -player.tilt * 0.4;
        p.visible = state !== "dying" && state !== "over" && !(invulnerable > 0 && Math.floor(time * 16) % 2 === 0);

        const thrust = 1 + (input.up ? 0.35 : 0) + Math.sin(time * 40) * 0.12;

        p.userData.flames.forEach((flame) => {
            flame.scale.set(1, 1, thrust);
        });

        p.userData.glows.forEach((glow) => {
            glow.scale.setScalar(1.1 + Math.sin(time * 33) * 0.15);
        });

        player.shield.visible = p.visible && shieldTime > 0 && (shieldTime > 1.5 || Math.floor(time * 10) % 2 === 0);
        player.shield.position.copy(p.position);
        player.shield.scale.setScalar(2.4 + Math.sin(time * 6) * 0.06);

        bullets.forEach((bullet) => {
            bullet.obj.position.set(worldX(bullet.x), 0.25, worldZ(bullet.y));
            bullet.obj.rotation.y = headingFromVelocity(bullet.vx, bullet.vy);
        });

        enemyShots.forEach((shot) => {
            shot.obj.position.set(worldX(shot.x), 0.25, worldZ(shot.y));
            shot.obj.rotation.y = headingFromVelocity(shot.vx, shot.vy);
        });

        enemies.forEach((enemy) => {
            const obj = enemy.obj;
            const pulse = enemy.hitFlash > 0 ? 1.14 : 1;

            obj.position.set(worldX(enemy.x), 0, worldZ(enemy.y));
            obj.scale.setScalar(enemy.baseScale * pulse * depthBoost(obj.position.z));

            if (enemy.def.meteor) {
                obj.rotation.x = enemy.rx;
                obj.rotation.y = enemy.ry;
            } else if (enemy.def.homing) {
                obj.rotation.y = headingFromVelocity(enemy.vx, enemy.vy);
                obj.rotation.z = Math.sin(time * 8) * 0.15;
            } else if (enemy.def.wave) {
                obj.rotation.z = Math.cos(time * 2.2 + enemy.phase) * 0.4;
            }

        });

        gfx.coreMaterials.forEach((material) => {
            material.emissiveIntensity = 1.8 + Math.sin(time * 10) * 0.7;
        });

        if (boss) {
            boss.obj.position.set(worldX(boss.x), 0.5, worldZ(boss.y));
            boss.obj.rotation.y = boss.rotation;
            boss.obj.rotation.z = Math.sin(time * 1.1) * 0.08;
            boss.obj.scale.setScalar(((150 * SX) / 1.3) * (boss.hitFlash > 0 ? 1.05 : 1) * depthBoost(boss.obj.position.z));
        }

        powerUps.forEach((item) => {
            item.obj.position.set(worldX(item.x), 0.6 + Math.sin(item.t * 3) * 0.15, worldZ(item.y));
            item.obj.scale.setScalar(1.3 * depthBoost(item.obj.position.z));
            item.obj.userData.crystal.rotation.y = item.t * 2.4;
            item.obj.userData.halo.rotation.z = item.t;
        });

        const shakeAmount = shake * 0.35;

        camera.position.set(
            CAMERA_POSITION[0] + rand(-shakeAmount, shakeAmount) + worldX(player.x) * 0.08,
            CAMERA_POSITION[1] + rand(-shakeAmount, shakeAmount),
            CAMERA_POSITION[2]
        );
        camera.lookAt(CAMERA_TARGET[0] + worldX(player.x) * 0.08, CAMERA_TARGET[1], CAMERA_TARGET[2]);
    }


    /* -----------------------------------------------------
       HUD (2D canvas on top)
    ----------------------------------------------------- */

    const projected = { x: 0, y: 0 };

    function project(x, y, z) {
        const v = new THREE.Vector3(x, y, z).project(camera);

        projected.x = (v.x + 1) / 2 * W;
        projected.y = (1 - v.y) / 2 * H;

        return projected;
    }


    function hudPanel(x, y, w, h) {
        roundRectPath(x, y, w, h, 12);
        ctx.fillStyle = "rgba(6, 14, 28, 0.62)";
        ctx.fill();
        ctx.strokeStyle = "rgba(120, 180, 255, 0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }


    function heartIcon(cx, cy, size, color) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + size * 0.55);
        ctx.bezierCurveTo(cx - size * 1.2, cy - size * 0.2, cx - size * 0.55, cy - size * 1.05, cx, cy - size * 0.4);
        ctx.bezierCurveTo(cx + size * 0.55, cy - size * 1.05, cx + size * 1.2, cy - size * 0.2, cx, cy + size * 0.55);
        ctx.fillStyle = color;
        ctx.fill();
    }


    function starIcon(cx, cy, size, color) {
        ctx.beginPath();

        for (let i = 0; i < 10; i++) {
            const r = i % 2 ? size * 0.45 : size;
            const angle = -Math.PI / 2 + (i * Math.PI) / 5;
            ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        }

        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }


    function chevronIcon(cx, cy, size, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        [-0.35, 0.35].forEach((offset) => {
            ctx.beginPath();
            ctx.moveTo(cx - size, cy + size * 0.5 + offset * size * 1.6);
            ctx.lineTo(cx, cy - size * 0.3 + offset * size * 1.6);
            ctx.lineTo(cx + size, cy + size * 0.5 + offset * size * 1.6);
            ctx.stroke();
        });
    }


    function hudBar(x, y, width, height, ratio, colorA, colorB) {
        roundRectPath(x, y, width, height, height / 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.fill();

        if (ratio > 0) {
            const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
            gradient.addColorStop(0, colorA);
            gradient.addColorStop(1, colorB);

            roundRectPath(x, y, Math.max(height, width * ratio), height, height / 2);
            ctx.fillStyle = gradient;
            ctx.fill();
        }
    }


    function hudRow(y, label, value) {
        ctx.fillStyle = "#e6eef8";
        ctx.font = `800 13px ${UI_FONT}`;
        ctx.textAlign = "left";
        ctx.fillText(label, 50, y);

        ctx.textAlign = "right";
        ctx.fillText(value, 238, y);
    }


    function drawHud() {
        ctx.save();
        ctx.textBaseline = "middle";

        hudPanel(16, 16, 236, 100);

        heartIcon(32, 37, 8, "#ff4d5e");
        hudRow(37, "HP", String(Math.ceil(hp)));
        hudBar(80, 32, 120, 9, hp / 100, "#ff3048", "#ff7a7a");

        starIcon(32, 66, 9, "#ffd84a");
        hudRow(66, "SCORE", String(score));

        chevronIcon(32, 95, 7, "#58b4ff");
        hudRow(95, tr("NIVEAU", "LEVEL"), String(level));

        if (!boss) {
            hudBar(108, 92, 92, 5, (kills - levelStartKills) / (nextLevelAt - levelStartKills), "#3d8bff", "#9fd8ff");
        }

        /* Pause button */
        hudPanel(PAUSE_BUTTON.x, PAUSE_BUTTON.y, PAUSE_BUTTON.w, PAUSE_BUTTON.h);
        ctx.fillStyle = "#e6eef8";
        ctx.fillRect(PAUSE_BUTTON.x + 18, PAUSE_BUTTON.y + 11, 4, 14);
        ctx.fillRect(PAUSE_BUTTON.x + 26, PAUSE_BUTTON.y + 11, 4, 14);
        ctx.font = `800 13px ${UI_FONT}`;
        ctx.textAlign = "left";
        ctx.fillText(state === "paused" ? tr("REPRENDRE", "RESUME") : "PAUSE", PAUSE_BUTTON.x + 40, PAUSE_BUTTON.y + 18.5);

        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(230, 238, 248, 0.75)";
        ctx.font = `700 12px ${UI_FONT}`;
        ctx.fillText(`${tr("RECORD", "BEST")} ${Math.max(highScore, score)}`, W - 16, 68);

        /* Bombs + weapon */
        hudPanel(16, H - 56, 236, 40);

        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(230, 238, 248, 0.8)";
        ctx.font = `800 11px ${UI_FONT}`;
        ctx.fillText(tr("BOMBES", "BOMBS"), 30, H - 36);
        ctx.fillText(tr("ARME", "WEAPON"), 146, H - 36);

        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(92 + i * 16, H - 36, 5.5, 0, Math.PI * 2);
            ctx.fillStyle = i < bombs ? "#ffa040" : "rgba(255, 255, 255, 0.15)";
            ctx.fill();
        }

        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = i < weapon ? "#58b4ff" : "rgba(255, 255, 255, 0.15)";
            ctx.fillRect(196 + i * 12, H - 41, 8, 10);
        }

        const multiplier = comboMultiplier();

        if (multiplier > 1 && state === "playing") {
            ctx.textAlign = "center";
            ctx.fillStyle = "#ffd36b";
            ctx.font = `800 ${20 + Math.sin(time * 10) * 1.5}px ${UI_FONT}`;
            ctx.fillText(`COMBO x${multiplier}`, W / 2, 30);
        }

        if (boss) {
            const y = multiplier > 1 ? 58 : 30;

            ctx.textAlign = "center";
            ctx.fillStyle = "#ffb3b3";
            ctx.font = `800 12px ${UI_FONT}`;
            ctx.fillText(tr("VAISSEAU MÈRE", "MOTHERSHIP"), W / 2, y);
            hudBar(W / 2 - 150, y + 12, 300, 8, boss.hp / boss.maxHp, "#ff2a1a", "#ff8a6a");
        }

        texts.forEach((text) => {
            const point = project(text.wx, 1, text.wz);

            ctx.globalAlpha = clampValue((text.life / text.max) * 1.5, 0, 1);
            ctx.fillStyle = text.color;
            ctx.font = `800 ${text.size}px ${UI_FONT}`;
            ctx.textAlign = "center";
            ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
            ctx.shadowBlur = 6;
            ctx.fillText(text.text, point.x, point.y - 20 - text.rise);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        });

        ctx.restore();
    }


    function drawBanner() {
        if (!banner) {
            return;
        }

        const elapsed = banner.duration - banner.time;
        const alpha = Math.min(1, elapsed * 3, banner.time * 2);

        ctx.save();
        ctx.globalAlpha = clampValue(alpha, 0, 1);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(88, 180, 255, 0.9)";
        ctx.shadowBlur = 24;
        ctx.font = `800 46px ${UI_FONT}`;
        ctx.fillText(banner.text, W / 2, H * 0.36);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#c7d0dc";
        ctx.font = `600 16px ${UI_FONT}`;
        ctx.fillText(banner.subtitle, W / 2, H * 0.36 + 42);
        ctx.restore();
    }


    function centeredLines(lines) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        lines.forEach(([text, y, font, color]) => {
            ctx.font = font;
            ctx.fillStyle = color;
            ctx.fillText(text, W / 2, y);
        });
    }


    function drawOverlay() {
        if (state === "playing" || state === "dying") {
            return;
        }

        const blink = Math.floor(time * 2) % 2 === 0;

        if (state === "loading") {
            ctx.fillStyle = "#02040a";
            ctx.fillRect(0, 0, W, H);

            centeredLines(loadError
                ? [
                    [tr("Impossible de lancer la 3D", "Unable to start 3D"), H / 2 - 12, `800 22px ${UI_FONT}`, "#ffffff"],
                    [tr("WebGL ou la connexion est indisponible.", "WebGL or the network is unavailable."), H / 2 + 20, `600 14px ${UI_FONT}`, "#8e99a8"]
                ]
                : [
                    [tr("Chargement de la scène 3D…", "Loading 3D scene…"), H / 2, `800 20px ${UI_FONT}`, blink ? "#ffffff" : "#9fb9da"]
                ]);
            return;
        }

        const veil = ctx.createLinearGradient(0, 0, 0, H);
        veil.addColorStop(0, "rgba(2, 5, 12, 0.75)");
        veil.addColorStop(0.55, "rgba(2, 5, 12, 0.35)");
        veil.addColorStop(1, "rgba(2, 5, 12, 0.8)");

        ctx.fillStyle = veil;
        ctx.fillRect(0, 0, W, H);

        if (state === "ready") {
            ctx.save();
            ctx.shadowColor = "rgba(88, 180, 255, 0.9)";
            ctx.shadowBlur = 28;
            centeredLines([["DODGE GAME", 112, `800 58px ${UI_FONT}`, "#ffffff"]]);
            ctx.restore();

            centeredLines([
                [tr("Survivez aux vagues d'ennemis et battez votre record", "Survive the enemy waves and beat your high score"), 160, `600 16px ${UI_FONT}`, "#c7d0dc"],
                [tr("Flèches / ZQSD : se déplacer   •   Espace : tirer", "Arrows / WASD: move   •   Space: fire"), 420, `600 14px ${UI_FONT}`, "#e6eef8"],
                [tr("X : bombe   •   P : pause   •   M : son   •   Mobile : glissez le doigt", "X: bomb   •   P: pause   •   M: sound   •   Mobile: drag your finger"), 444, `600 14px ${UI_FONT}`, "#c7d0dc"],
                [`${tr("RECORD", "BEST")} ${highScore}`, 570, `800 13px ${UI_FONT}`, "#ffd36b"]
            ]);

            const types = Object.keys(POWER_UPS);

            types.forEach((type, index) => {
                const def = POWER_UPS[type];
                const x = W / 2 - 200 + index * 100;

                ctx.beginPath();
                ctx.arc(x - 26, 486, 6, 0, Math.PI * 2);
                ctx.fillStyle = `rgb(${def.css})`;
                ctx.shadowColor = `rgb(${def.css})`;
                ctx.shadowBlur = 12;
                ctx.fill();
                ctx.shadowBlur = 0;

                ctx.textAlign = "left";
                ctx.fillStyle = "#c7d0dc";
                ctx.font = `700 13px ${UI_FONT}`;
                ctx.fillText(def.name(), x - 14, 487);
            });

            if (blink) {
                centeredLines([[tr("ESPACE OU TOUCHER POUR JOUER", "PRESS SPACE OR TAP TO PLAY"), 532, `800 16px ${UI_FONT}`, "#7fc4ff"]]);
            }

            return;
        }

        if (state === "paused") {
            centeredLines([
                ["PAUSE", H / 2 - 16, `800 46px ${UI_FONT}`, "#ffffff"],
                [tr("P ou toucher pour reprendre", "P or tap to resume"), H / 2 + 30, `600 15px ${UI_FONT}`, "#c7d0dc"]
            ]);
            return;
        }

        if (state === "over") {
            const lines = [
                ["GAME OVER", 170, `800 56px ${UI_FONT}`, "#ff8b8b"],
                [`SCORE  ${score}`, 248, `800 24px ${UI_FONT}`, "#ffffff"],
                [`${tr("RECORD", "BEST")}  ${highScore}`, 284, `800 16px ${UI_FONT}`, "#ffd36b"],
                [tr(`Niveau atteint : ${level}`, `Level reached: ${level}`), 318, `600 15px ${UI_FONT}`, "#c7d0dc"]
            ];

            if (newRecord) {
                lines.push([tr("NOUVEAU RECORD !", "NEW HIGH SCORE!"), 366, `800 22px ${UI_FONT}`, blink ? "#ffd36b" : "#ffffff"]);
            }

            if (overTime > 0.8 && blink) {
                lines.push([tr("ESPACE, R OU TOUCHER POUR REJOUER", "SPACE, R OR TAP TO PLAY AGAIN"), 450, `800 16px ${UI_FONT}`, "#7fc4ff"]);
            }

            centeredLines(lines);
        }
    }


    function draw() {
        ctx.clearRect(0, 0, W, H);

        if (renderer && state !== "loading") {
            syncScene();
            renderer.render(scene, camera);
        }

        if (state === "playing" || state === "paused" || state === "dying") {
            drawHud();
            drawBanner();
        }

        drawOverlay();

        if (flash > 0) {
            ctx.fillStyle = `rgba(255, 244, 220, ${flash * 0.55})`;
            ctx.fillRect(0, 0, W, H);
        }
    }


    function frame(now) {
        const dt = clampValue((now - last) / 1000, 0, 0.05);
        last = now;

        update(dt);
        draw();

        frameId = requestAnimationFrame(frame);
    }


    initScene();
    frameId = requestAnimationFrame(frame);


    return () => {
        disposed = true;

        cancelAnimationFrame(frameId);
        bag.clear();
        sound.remove();

        Object.keys(input).forEach((key) => {
            input[key] = typeof input[key] === "boolean" ? false : null;
        });

        if (scene) {
            if (gfx) {
                Object.values(gfx.models).forEach((model) => scene.add(model));
            }

            scene.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }

                if (object.material) {
                    [].concat(object.material).forEach((material) => {
                        Object.values(material).forEach((value) => {
                            if (value && value.isTexture) {
                                value.dispose();
                            }
                        });

                        material.dispose();
                    });
                }
            });

            if (scene.environment) {
                scene.environment.dispose();
            }
        }

        if (renderer) {
            renderer.dispose();
            renderer.forceContextLoss();
        }

        glCanvas.remove();
        stage.classList.remove("is-3d");
        ctx.clearRect(0, 0, W, H);
    };
}
