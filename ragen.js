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
    }
}

// Constants
var DISABLE_DEACTIVATION = 4;
var SMALL_GAP = 0.1;
var VERY_SMALL_GAP = 0.01;

// ---------- Main --------------

// Generate Seed & print it
var seed = Math.random();
//var seed = 0.7673798246104175;
const seedp = document.getElementById("seed");
seedp.innerHTML = "SEED: " + seed;
const myrng = new Math.seedrandom(seed);

// TODO check WEBGL...


// Stats element
const container = document.querySelector('#container');
const stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.bottom = '0px';
//container.appendChild( stats.domElement );


// Main Vue
const mainVue = new MainVue(GAMECONF.mainvue, document.querySelector('#c'));
//const controls = new THREE.OrbitControls(mainVue.camera, mainVue.canvas);

// TODO Minimap Vue
const minimap = new Minimap(undefined, document.querySelector('#frontc'));

// Initialization
let physics, gameplay;
Ammo().then(init);
function init() {
    // Physics
    physics = new Physics();
    
    // Terrain
    const terrain = new Terrain(GAMECONF.terrain);
    mainVue.scene.add(terrain.mesh);
    physics.world.addRigidBody(terrain.body);

    // Circuit
    const circuit = new Circuit(GAMECONF.circuit, myrng);
    mainVue.scene.add(circuit.mesh);
    minimap.scene.add(circuit.minimapMesh);
    physics.world.addRigidBody(circuit.body);

    // Car
    const car = new Car(GAMECONF.car);
    car.initMainVue(mainVue.scene);
    minimap.scene.add(car.minimapMesh);
    car.initPhysics(physics.world, GAMECONF.carPhysics);

    // Gameplay
    gameplay = new Gameplay(GAMECONF, circuit, car, mainVue.camera);

}


// GAME LOOP
const physicsfps = 45;
const clock = new THREE.Clock();
let pdt = 0;
function tick() {
    requestAnimationFrame(tick);

    pdt += clock.getDelta();

    if (pdt > (1/physicsfps)) {
        physics.world.stepSimulation(pdt, 1);
        gameplay.update(document.querySelector('#speed'), document.querySelector('#time'));
        stats.update();
        pdt = pdt % (1/physicsfps);
    }

    mainVue.render();
    minimap.render();
    //controls.update();
}
tick();

// todo clean code (= small code (especially js way...))
