
class MainView {

    constructor () {
        this.canvas = document.getElementById("mainc");
        this.renderer = new THREE.WebGLRenderer({canvas: this.canvas, antialias: true,
                                                 gammaInput: true, gammaOutput: true});
        this.scene = new THREE.Scene();

        // Create the Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

        // Add the lights and sky
        this.scene.background = new THREE.Color(0x87CEEB);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
		hemiLight.color.setHSL(0.6, 1, 0.6);
		hemiLight.groundColor.setHSL(0.38, 0.50, 0.25);
		hemiLight.position.set(0, 0, 400);
        this.scene.add(hemiLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.color.setHSL(0.1, 1, 0.95);
        dirLight.position.set(0, 50, 100);
        this.scene.add(dirLight);
    }

    render () {
        this.renderer.render(this.scene, this.camera);
    }
}