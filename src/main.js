
// Configuration
const GAMECONF = {
    mainvue: {
        sky: 0x87CEEB
    },

    terrain: {
        Xsize: 1000,
        Ysize: 1000,
        Zsize: 1,
        colorHSL: [0.38, 0.50, 0.25]
    },

    circuit: {
        minPoints: 15,
        maxPoints: 30,
        minX: -300,
        maxX: 300,
        minY: -200,
        maxY: 200,
        width: 12.5,
        margin: 0.5,
        pointResolution: 200,
        Z: 0.6,
        colorHSL: [0.1, 0.06, 0.33],
        colorMargin: 0xffffff,
        colorCP: 0x0000ff,
        colorMinimap: 0x0000FF
    },

    car: {
        width: 1.8,
        length: 4,
        cameraPosition: new THREE.Vector3(0, -5, 3.5),
        Zinit: 2,
        defaultColor: 0x00ffff,
        colorOuterMinimap: 0xffff00,
        colorGrassParticle: 0x87B982
    },

    carPhysics: {
        mass: 800,
        suspensionStiffness: 100,
        suspensionRestLength: 0.4,
        maxSuspensionTravelCm: 10,
        rollInfluence: 0.02,
        friction: 8,
        steeringIncrement: .04,
        steeringClamp: .4,
        maxEngineForce: 3000,
        maxBreakingForce: 100,
        maxSpeed: 250,
        maxReverseSpeed: -30,
        defaultDrag: 3,
        grassDrag: 60
    },

    misc: {
        lerpFast: 0.15,
        lerpSlow: 0.02
    },

    menu: {
        trackidRandSize: 6,
        sessionRandSize: 4
    },

    multi: {
        server: "http://localhost:3000",
        posRefreshRate: 50
    }
}

// Constants
var DISABLE_DEACTIVATION = 4;
var SMALL_GAP = 0.1;
var VERY_SMALL_GAP = 0.01;
var FPS = 50;

// HTML Constants
const HTMLELEMENTS = {
    main_canvas: document.getElementById("mainc"),

    // game elements
    game_elements: document.getElementById("game_elements"),
    speed: document.getElementById('speed'),
    seed: document.getElementById("seed"),
    go: document.getElementById("go"),
    random: document.getElementById("random"),
    minimap_canvas: document.getElementById("minimapc"),
    leaderboard: document.getElementById("leaderboard"),
    score_message: document.getElementById("score_message"),

    // menu elements
    menu_seed: document.getElementById("menu_seed"),
    menu: document.getElementById("menu"),
    menu_button: document.getElementById("menu_button"),
    menu_go: document.getElementById("menu_go"),
    menu_random: document.getElementById("menu_random"),
    name: document.getElementById("name"),
    color: document.getElementById("color"),

    // multi menu elements
    session_id_input: document.getElementsByName("session_id")[0],
    session_id_list: document.getElementById("session_id"),
    session_random: document.getElementById("session_random"),
    session_go: document.getElementById("session_go"),
    session_tobelisted: document.getElementById("session_tobelisted"),

    // Session info elements
    session_span: document.getElementById("session_span"),
    remaining_time: document.getElementById("remaining_time")
}

// ---------- Main --------------

let physics, gameplay, menu, client, currCircuit;

// Generate Seed
function generateRandomSeed (size) {
    const ascii = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let seed = "";
    for (var i = 0; i < size; i++) {
        let j = Math.floor(Math.random() * (ascii.length));
        seed += ascii.charAt(j);
    }
    return seed; 
}

// TODO check WEBGL...


// Stats element
const container = document.querySelector('#container');
const stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.bottom = '0px';
//container.appendChild( stats.domElement );


// Main Vue
const mainVue = new MainVue(GAMECONF.mainvue, HTMLELEMENTS.main_canvas);

// Minimap Vue
const minimap = new Minimap(undefined, HTMLELEMENTS.minimap_canvas);

function initCircuit (seed) {
    HTMLELEMENTS.seed.value = seed;
    HTMLELEMENTS.menu_seed.value = seed;

    if (currCircuit != undefined) {
        mainVue.scene.remove(currCircuit.mesh);
        minimap.scene.remove(currCircuit.minimapMesh);
        physics.world.removeCollisionObject(currCircuit.body);
    }

    const newCircuit = new Circuit(GAMECONF.circuit, new Math.seedrandom(seed));
    mainVue.scene.add(newCircuit.mesh);
    minimap.scene.add(newCircuit.minimapMesh);
    physics.world.addRigidBody(newCircuit.body);

    currCircuit = newCircuit;
    return newCircuit;
}

function driverVuesCallback (visible, mainVueMeshes, minimapMesh) {
    if (visible) {
        for (var i = 0; i < mainVueMeshes.length; i++) {
            mainVue.scene.add(mainVueMeshes[i]);
        }
        minimap.scene.add(minimapMesh);
    } else {
        for (var i = 0; i < mainVueMeshes.length; i++) {
            mainVue.scene.remove(mainVueMeshes[i]);
        }
        minimap.scene.remove(minimapMesh);
    }
}

// Initialization
Ammo().then(init);
function init() {
    // Physics
    physics = new Physics();
    
    // Terrain
    const terrain = new Terrain(GAMECONF.terrain);
    mainVue.scene.add(terrain.mesh);
    physics.world.addRigidBody(terrain.body);

    // Circuit
    const seed = generateRandomSeed(GAMECONF.menu.trackidRandSize)
    const circuit = initCircuit(seed);

    // Car
    const car = new Car(GAMECONF.car);
    car.initVue(mainVue.scene);
    minimap.scene.add(car.minimapMesh);
    car.initPhysics(physics.world, GAMECONF.carPhysics);

    // Particles
    const particlesManager = new ParticlesManager(mainVue.scene, 50);

    // Driver
    const driver = new Driver(HTMLELEMENTS.name.value, car, driverVuesCallback, 0);

    // Leaderboard
    const leaderboard = new Leaderboard(HTMLELEMENTS.leaderboard, HTMLELEMENTS.score_message, driver);

    // Gameplay
    gameplay = new Gameplay(GAMECONF, circuit, driver, mainVue.camera, 
                            particlesManager, HTMLELEMENTS, leaderboard);

    // Multiplayer client
    const htmlSessionElements = {session_span: HTMLELEMENTS.session_span,
                                 remaining_time: HTMLELEMENTS.remaining_time}
    client = new Client(GAMECONF.multi, GAMECONF.car, gameplay, initCircuit,
                        htmlSessionElements, driver, leaderboard,
                        [mainVue.scene, minimap.scene]);

    // Menu
    menu = new Menu(HTMLELEMENTS, GAMECONF.menu, driver, gameplay, generateRandomSeed, initCircuit, seed, client);
}


// GAME LOOP
const clock = new THREE.Clock();
let df = 0;
function tick() {
    requestAnimationFrame(tick);

    df += clock.getDelta() * FPS;    
    if (df > FPS) { df = 1; }
    while (df >= 1) {
        physics.world.stepSimulation(1/FPS, 1);
        gameplay.update();
        mainVue.render();
        minimap.render();
        df -= 1; 
    }
    stats.update();
}
tick();

// todo clean code (= small code (especially js way...))
/*
TODO: 
- wheels turning on other cars
- podium screen
- loading screen + wait 2 seconds before moving camera...
- session share
- responsive
- prettify (code&game): car, loading screen, trees, stands, sound...
*/
