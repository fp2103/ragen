
// MAIN Configuration
const FPS = 50;
const PARTICLES_LIMIT = 50;

const DEFAULT_NAME = "anon";
const DEFAULT_COLOR = 0x00ffff;

// Global constant
const SMALL_GAP = 0.1;
const VERY_SMALL_GAP = 0.01;

// ----- Main -----

// TODO WEBGL check


async function main () {

    // Views/Scenes
    const mainView = new MainView();
    const minimapView = new MinimapView();

    // Physics
    const physics = await new Promise(resolve => { Ammo().then(resolve(new Physics())); });

    // 3D object factories
    const carFactory = new CarFactory(mainView, minimapView, physics);
    const circuitFactory = new CircuitFactory(mainView, minimapView, physics);
    const particlesManager = new ParticlesManager(mainView.scene, PARTICLES_LIMIT);

    // Player
    const driver = new Driver(0, DEFAULT_NAME, carFactory.createCar(DEFAULT_COLOR, true));

    // Controls
    const controls = new Controls();

    // Game main
    const gameplay = new Gameplay(driver, controls, mainView.camera, particlesManager);

    // Inputs
    const client = new Client(gameplay, circuitFactory, carFactory, driver);
    const menu = new Menu(gameplay, circuitFactory, driver, client); 
 
    // init the menu & a circuit
    menu.showMenu();
    const seed = document.getElementById("menu_seed").value;
    if (seed) {
        menu.loadTrack(seed, "menu");
    } else {
        menu.onRandomMenu();
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
            mainView.render();
            minimapView.render();
            df -= 1; 
        }
    }
    tick();

}
main();


/* TODO:
- podium scene
- car color random
- responsive
- touch controls
- menu improvement:
    - arrow zone
    - session id details
    - controls info
    - about section
    - design
- scene improvment
    - slide traces
    - background
    - car
- sound
*/

