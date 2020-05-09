
// MAIN Configuration
const FPS = 50;
const PARTICLES_LIMIT = 50;

const DEFAULT_NAME = "anon";

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
    const podiumScene = new PodiumScene(mainView, particlesManager);

    // Player
    let randomColor = Math.floor(Math.random()*16777215).toString(16);
    while (randomColor.length < 6) { randomColor = '0' + randomColor };
    randomColor = '#' + randomColor;
    document.getElementById("color").value = randomColor;
    const driver = new Driver(0, DEFAULT_NAME, carFactory.createCar(randomColor, true));

    // Controls
    const controls = new Controls();

    // Game main
    const gameplay = new Gameplay(driver, controls, mainView.camera, particlesManager, podiumScene);

    // Inputs
    const client = new Client(gameplay, circuitFactory, carFactory, driver);
    const menu = new Menu(gameplay, circuitFactory, driver, client); 
 
    // init the menu / connect to given session
    const sid = menu.htmlSessionId.value;
    if (sid) {
        menu.quickButtonsDisable();
        client.onMenu = true;
        await new Promise(resolve => { client.connect(sid, resolve) });
    }
    document.getElementById("mainc").style.display = "block";
    menu.showMenu();
    if (!sid) menu.onRandomMenu();

    // GAME LOOP
    const clock = new THREE.Clock();
    let df = 0;
    function tick() {
        requestAnimationFrame(tick);
        responsive_update();

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
- responsive
- podium update name color on update user
- touch controls
- menu improvement:
    - arrow zone
    - session id details
    - controls & settings options
    - about section (=link to github + readme)
    - design
- leaderboard html prettify
    - animation when sorting driver
- scene improvment
    - slide traces
    - background objects
    - car design
- sound
*/

