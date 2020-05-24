
class MinimapView {

    constructor () {
        this.canvas = document.getElementById("minimapc");
        this.renderer = new THREE.WebGLRenderer({canvas: this.canvas, antialias: false, 
                                                 alpha: true, precision: "lowp", powerPreference: "low-power"});
        this.scene = new THREE.Scene();

        // Create the Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.set(0,0,350);
    }

    render () {
        this.renderer.render(this.scene, this.camera);
    }
}
