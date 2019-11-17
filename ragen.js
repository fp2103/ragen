'use strict';

// Configuration
const GAMECONF = {
    mainvue: {
        sky: 0x87CEEB
    },

    terrain: {
        Xsize: 1000,
        Ysize: 1000,
        Zsize: 1,
        color: 0x2f7f4d
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
        Z: 0.6
    },

    car: {
        width: 1.8,
        length: 4,
        cameraPosition: new THREE.Vector3(0, -5, 3.5),
        Zinit: 2
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
        maxReverseSpeed: -30
    },

    misc: {
        lerpFast: 0.15,
        lerpSlow: 0.03
    }
}

// Constants
var DISABLE_DEACTIVATION = 4;
var SMALL_GAP = 0.1;
var VERY_SMALL_GAP = 0.01;
var FPS = 50;

// HTML Constants
const HTMLELEMENTS = {
    speed: document.getElementById('speed'),
    sectors: [document.getElementById('laptime'), 
              document.getElementById('sector1'),
              document.getElementById('sector2')],
    seed: document.getElementById("seed"),
    menu_seed: document.getElementById("menu_seed"),
    main_canvas: document.getElementById("mainc"),
    minimap_canvas: document.getElementById("minimapc"),
    menu: document.getElementById("menu"),
    game_elements: document.getElementById("game_elements"),
    menu_button: document.getElementById("menu_button"),
    menu_go: document.getElementById("menu_go"),
    go: document.getElementById("go")
}

// ---------- Main --------------

let physics, gameplay, currCircuit;

// Generate Seed
var myseed = Math.random();

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
    const circuit = initCircuit(myseed);

    // Car
    const car = new Car(GAMECONF.car);
    car.initVue(mainVue.scene);
    minimap.scene.add(car.minimapMesh);
    car.initPhysics(physics.world, GAMECONF.carPhysics);

    // Particles
    const particlesManager = new ParticlesManager(mainVue.scene);

    // Gameplay
    gameplay = new Gameplay(GAMECONF, circuit, car, mainVue.camera,
                            particlesManager, HTMLELEMENTS, myseed, initCircuit);

}


// GAME LOOP
const clock = new THREE.Clock();
let dt = 0;
function tick() {
    requestAnimationFrame(tick);

    dt += clock.getDelta() * FPS;

    if (dt >= 1) {
        physics.world.stepSimulation(dt, 1);
        gameplay.update();
        stats.update();
        dt -= 1;
    }

    mainVue.render();
    minimap.render();
}
tick();

// todo clean code (= small code (especially js way...))
/*
TODO:
- menu
- eclairage
*/
