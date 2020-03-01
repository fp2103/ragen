
function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
}

class MainVue {

    constructor (conf, canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true,
                                                 gammaInput: true, gammaOutput: true});
        this.renderer.shadowMap.enabled = true;
        this.scene = new THREE.Scene();

        // Create the Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        // Add the lights and sky
        this.scene.background = new THREE.Color(conf.sky);
        this.scene.fog = new THREE.Fog(this.scene.background, 1, 2000);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
		hemiLight.color.setHSL(0.6, 1, 0.6);
		hemiLight.groundColor.setHSL(0.095, 1, 0.75);
		hemiLight.position.set(0, 0, 500);
        this.scene.add(hemiLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.color.setHSL(0.1, 1, 0.95);
        dirLight.position.set(10, 10, 500);
        this.scene.add(dirLight);
    }

    render () {
        if (resizeRendererToDisplaySize(this.renderer)) {
            this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
            this.camera.updateProjectionMatrix();
        }
        this.renderer.render(this.scene, this.camera);
    }
}