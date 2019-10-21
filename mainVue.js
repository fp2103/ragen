'use strict';

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
        this.renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true});
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(conf.sky);

        // Create the Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        
        // Create the Light
        const skyColor = 0xFFFFFF;
        const groundColor = 0x000000;
        const intensity = 1.5;
        const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
        this.scene.add(light);
        /*const ambientLight = new THREE.AmbientLight( 0x404040 );
		this.scene.add( ambientLight );*/
        
        /*const dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
        dirLight.position.set( 0, 0, -50 );
        this.scene.add( dirLight );*/
    }

    render () {
        if (resizeRendererToDisplaySize(this.renderer)) {
            this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
            this.camera.updateProjectionMatrix();
        }
        this.renderer.render(this.scene, this.camera);
    }
}