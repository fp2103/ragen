
// MAIN Configuration
const FPS = 50;
const PARTICLES_LIMIT = 50;

const DEFAULT_NAME = "anon";

// Global constant
const SMALL_GAP = 0.1;
const VERY_SMALL_GAP = 0.01;
const DEFAULT_EM = 16;

// ----- Main -----

// WEBGL Check
if (!WEBGL.isWebGLAvailable()) {
    const warning = WEBGL.getWebGLErrorMessage();
    document.getElementById("centered_msg").appendChild(warning);
    throw new Error(warning);
}

// DEBUG: Stats
const container = document.querySelector('#container');
const stats = new Stats();
stats.domElement.style.position = 'absolute';
//container.appendChild(stats.domElement);

// random generator utils
function generateRandomSeed (size) {
    const ascii = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let seed = "";
    for (var i = 0; i < size; i++) {
        let j = Math.floor(Math.random() * (ascii.length));
        seed += ascii.charAt(j);
    }
    return seed; 
}

// List to keep callbacks for css animation that require multiple framess
const cssAnimationNextFrameCbs = [];

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
    const podiumScene = new PodiumScene(mainView, particlesManager, 0);

    // Player
    let randomColor = Math.floor(Math.random()*16777215).toString(16);
    while (randomColor.length < 6) { randomColor = '0' + randomColor };
    randomColor = '#' + randomColor;
    document.getElementById("color").value = randomColor;
    const driver = new Driver(0, DEFAULT_NAME, carFactory.createCar(randomColor, true));
    const ghost = new Ghost(carFactory, driver);

    // Controls
    const controls = new Controls();

    // Game main
    const gameplay = new Gameplay(driver, controls, mainView.camera, particlesManager, podiumScene, ghost);

    // Inputs
    const client = new Client(gameplay, circuitFactory, carFactory, driver, podiumScene);
    const menu = new Menu(gameplay, circuitFactory, driver, client); 

    // Adapt view to display
    const responsive = new Responsive(mainView, minimapView, gameplay.leaderboard, client, controls);
 
    // init the menu / connect to given session
    const sid = menu.html.sessionIdInput.value;
    if (sid) {
        menu.quickButtonsDisable();
        client.onMenu = true;
        await new Promise(resolve => { client.connect(sid, resolve) });
    }
    mainView.canvas.style.display = "block";
    menu.showMenu();
    if (!sid) {
        menu.onRandomMenu();
        menu.onSoloButton();
    } else {
        menu.onMultiButton();
    }
 
    // GAME LOOP
    const clock = new THREE.Clock();
    let df = 0;
    function tick() {
        requestAnimationFrame(tick);
        
        df += clock.getDelta() * FPS;    
        if (df > FPS) { df = 1; }
        if (df >= 1) {
            while (cssAnimationNextFrameCbs.length > 0) {
                cssAnimationNextFrameCbs.pop()();
            }
            responsive.update();
            controls.tapUpdate();
            
            while (df >= 1) {
                physics.world.stepSimulation(1/FPS, 1);
                gameplay.update();
                mainView.render();
                df -= 1; 
            }
            minimapView.render();
        }
    }
    tick();

}
main();

/* IDEAs:
l- sound effect
n- DB to keep score and list of last played circuit + ghost
j- BOTs on multi (degeneration from best)
b- Physical tree
c- Transparent ghost on solo
h- Relief
k- Mode de jeu avec multi/bot (most lap, time attack, race)
i- vehicle physics++ + menu for modification in leaderboard (sandbox, no db entry)
e- multi camera angle
f- gate start (w. 3 lights on poles only for race mode + physical)
d- solo reset -> acceleration > 0 (depending on close to a turn + not coming from camera high)
m- solo racing line option (best bot)
a- when unvalid lap reset at start whatever the number of checkpoint
g- solo (option to add ghost or not)
*/