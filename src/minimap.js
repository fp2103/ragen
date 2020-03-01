
class Minimap {

    constructor (conf, canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: false, 
                                                 alpha: true, precision: "lowp"});
        this.scene = new THREE.Scene();

        // Create the Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0,0,350);
    }

    render () {
        if (resizeRendererToDisplaySize(this.renderer)) {
            this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
            this.camera.updateProjectionMatrix();
        }
        this.renderer.render(this.scene, this.camera);
    }
}