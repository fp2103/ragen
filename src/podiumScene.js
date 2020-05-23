
const SPARKLE_GEO = new THREE.PlaneBufferGeometry(0.15, 0.15);
SPARKLE_GEO.rotateX(Math.PI/2);

class Sparkle extends Particle {

    constructor (initPos, angle) {
        const mat = new THREE.MeshBasicMaterial({color: Math.floor(Math.random()*16777215), side: THREE.DoubleSide});
        super(new THREE.Mesh(SPARKLE_GEO, mat), 2);
        this.mat = mat;

        this.lastt = Date.now();
        this.initPosition(initPos, new THREE.Quaternion());
        this.mesh.rotateZ(angle);
        
        this.initSpeed = new THREE.Vector3();
        this.initSpeed.x = Math.random()*2-1;
        this.initSpeed.y = Math.random()*2-1;
        this.initSpeed.z = Math.random()*5 + 3;
    }

    update() {
        let dt = Date.now() - this.lastt;
        dt = dt/1000;
        this.lastt = Date.now();

        const p = this.mesh.position;
        const x = p.x + dt * this.initSpeed.x;
        const y = p.y + dt * this.initSpeed.y;
        const z = p.z + (-10*dt*dt + dt*this.initSpeed.z);
        this.mesh.position.set(x, y, z);
    }

    dispose () {
        this.mat.dispose();
    }
}

class PodiumScene {
    constructor (view, particlesManager, mainDriverId) {
        this.scene = view.scene;
        this.camera = view.camera;
        this.particlesManager = particlesManager;
        this.mainDriverId = mainDriverId;
        
        this.visible = false;
        this.winners = undefined;

        // Configuration
        const SIZE = 6;
        this.HEIGHTS = [3, 2, 1.5];
        this.Z = this.HEIGHTS[0]/2 + 0.5;

        // Create boxes
        this.boxes = [];
        this.canvasl = [];
        this.textures = [];
        for (let h of this.HEIGHTS) {
            // Canvas
            const ctx = document.createElement('canvas').getContext('2d');
            ctx.canvas.width = 512;
            ctx.canvas.height = 512 / (SIZE/h);
            ctx.textAlign = "center";
            this.canvasl.push(ctx);

            // Texture
            const t = new THREE.CanvasTexture(ctx.canvas);
            t.minFilter = THREE.LinearFilter;
            t.wrapS = THREE.ClampToEdgeWrapping;
            t.wrapT = THREE.ClampToEdgeWrapping;
            this.textures.push(t);

            // Materials
            const tm = new THREE.MeshBasicMaterial({map: t});
            const om = new THREE.MeshLambertMaterial({color: 0xffffff});
            const faces = [om, om, om, tm, om, om];

            // Box mesh
            this.boxes.push(new THREE.Mesh(new THREE.BoxBufferGeometry(SIZE, SIZE, h), faces));
        }
        this.boxes[1].position.set(-SIZE, 0, (this.HEIGHTS[1]/2) - (this.HEIGHTS[0]/2));
        this.boxes[2].position.set(SIZE, 0, (this.HEIGHTS[2]/2) - (this.HEIGHTS[0]/2));
        
        this.podiumMesh = new THREE.Object3D();
        this.podiumMesh.add(...this.boxes);

        // Camera position
        this.cameraStart = new THREE.Object3D();
        this.cameraStart.position.set(9, -9, 6);
        this.podiumMesh.add(this.cameraStart);
        
        this.ROTATION_AXIS = new THREE.Vector3(0, 0, -1);
        this.ROTATION_MAX = Math.PI / 2;
        this.ROTATION_SPEED = 0.25;
        this.cumulativeRotation = 0;
        this.last_update = 0;

        // Particle update
        this.face_angle = 0;
        this.particle_starting_position = undefined;
        this.DEFAULT_PARTICLE_SP = new THREE.Vector3(0, SIZE/2, 0);
        this.PARTICLE_UPDATE = 500;
        this.NEW_PARTICLES = 15;
        this.since_last_part_update = this.PARTICLE_UPDATE+1;
    }

    fillCanvasCtx (ctx, player) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.fillStyle = "#9F9F9F";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (player != undefined) {
            const NAMEFONTSIZE = 40;
            const TIMEFONTSIZE = 30;
            ctx.fillStyle = `#${player.car.currentColor.getHexString()}`;
            ctx.font = `${NAMEFONTSIZE}px Arial`;
            ctx.fillText(player.name, ctx.canvas.width/2, NAMEFONTSIZE + 20);
            ctx.fillStyle = "black";
            ctx.font = `${TIMEFONTSIZE}px Arial`;
            ctx.fillText(convertTimeToString(player.bestLapTime, true), ctx.canvas.width/2, (TIMEFONTSIZE+20)*2);
        }
    }

    createScene (circuit, winners) {
        this.winners = winners;

        // Update textures
        for (let i = 0; i < 3; i++) {
            this.fillCanvasCtx(this.canvasl[i], winners[i]);
            this.textures[i].needsUpdate = true;
        }
        
        // Position podium
        const pos = circuit.getPodiumPosition();
        let angle = pos.d.angleTo(new THREE.Vector3(1,0,0));
        const orthoZ = new THREE.Vector3().crossVectors(new THREE.Vector3(1,0,0), pos.d);
        let sign = 1;
        if (orthoZ.z < 0) sign = -1;
        angle = sign*angle;
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), angle);

        this.podiumMesh.position.set(pos.p.x, pos.p.y, this.Z);
        this.podiumMesh.quaternion.set(q.x, q.y, q.z, q.w);
        this.podiumMesh.updateMatrixWorld();
        
        this.scene.add(this.podiumMesh);
        this.visible = true;

        // Place cars on boxes
        const dir = new THREE.Vector3().subVectors(...circuit.startingLinePoints);
        dir.multiplyScalar(-1);
        for (let i = 0; i < 3; i++) {
            if (winners[i] != undefined) {
                let t = new THREE.Vector3();
                this.boxes[i].getWorldPosition(t);
                t.z += this.HEIGHTS[i]/2;
                winners[i].car.forceMeshToPosition(t, dir);
                winners[i].car.makeVisible();
            }
        }

        // Set camera position
        let t = new THREE.Vector3();
        this.cameraStart.getWorldPosition(t);
        this.camera.position.set(t.x, t.y, t.z);
        this.camera.up = new THREE.Vector3(0, 0, 1);
        this.camera.lookAt(this.podiumMesh.position);
        this.ROTATION_AXIS = new THREE.Vector3(0, 0, -1);
        this.cumulativeRotation = 0;
        this.last_update = 0;

        // Particles starting pos
        this.face_angle = angle;
        this.particle_starting_position = undefined;
        for (let i = 0; i < 3; i++) {
            if (winners[i] != undefined && winners[i].id == this.mainDriverId) {
                let t = new THREE.Vector3();
                this.boxes[i].getWorldPosition(t);
                this.particle_starting_position = this.DEFAULT_PARTICLE_SP.clone();
                this.particle_starting_position.applyQuaternion(q);
                this.particle_starting_position.add(t);
            }
        }
        this.since_last_part_update = this.PARTICLE_UPDATE+1;
    }

    destroyScene () {
        if (this.visible) {
            this.scene.remove(this.podiumMesh);
        }
        this.visible = false;
        this.winners = undefined;
    }

    update () {
        // Delta time
        const dtime = this.last_update > 0 ? Date.now() - this.last_update : 0;
        this.last_update = Date.now();

        // Delta rotation
        const m = this.ROTATION_MAX;
        const l = this.cumulativeRotation % m;
        const ls = Math.floor(this.cumulativeRotation/m) % 2;
        this.cumulativeRotation = ls == 0 ? l : m+l;    
        this.cumulativeRotation += this.ROTATION_SPEED*dtime/1000;
        const r = this.cumulativeRotation % m;
        const rs = Math.floor(this.cumulativeRotation/m) % 2;

        const delta = rs == ls ? r - l : m - (l+r);
        
        this.camera.position.sub(this.podiumMesh.position);
        this.camera.position.applyAxisAngle(this.ROTATION_AXIS, delta);
        this.camera.position.add(this.podiumMesh.position);
        this.camera.lookAt(this.podiumMesh.position);

        if (rs != ls) this.ROTATION_AXIS.multiplyScalar(-1);

        // Particles update
        if (this.particle_starting_position != undefined) {
            if (this.since_last_part_update > this.PARTICLE_UPDATE) {
                for (let i = 0; i < this.NEW_PARTICLES; i++) {
                    this.particlesManager.add(new Sparkle(this.particle_starting_position, this.face_angle));
                }
                this.since_last_part_update = 0;
            } else {
                this.since_last_part_update += dtime;
            }
        }
        this.particlesManager.update();
    }

    updateDriver (id) {
        if (this.winners != undefined) {
            for (let i = 0; i < 3; i++) {
                const w = this.winners[i];
                if (w != undefined && w.id == id) {
                    this.fillCanvasCtx(this.canvasl[i], this.winners[i]);
                    this.textures[i].needsUpdate = true;
                }
            }
        }
    }
}