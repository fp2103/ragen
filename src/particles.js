
class Particle {

    constructor (size, color, time) {
        // Object3D
        this.geo = new THREE.PlaneBufferGeometry(size.x, size.y);
        this.mat = new THREE.MeshBasicMaterial({color});
        this.mesh = new THREE.Mesh(this.geo, this.mat);

        // Time
        this.clock = new THREE.Clock();
        this.maxTime = time;
    }

    alive () {
        return this.clock.getElapsedTime() < this.maxTime;
    }

    initPosition (pos, quat) {
        this.mesh.position.set(pos.x, pos.y, pos.z);
        this.mesh.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    }

    update () {}

    dispose () {
        this.geo.dispose();
        this.mat.dispose();
    }
}

class ParticlesManager {

    constructor (scene, limit) {
        this.scene = scene;
        this.limit = limit;
        
        this.list = [];
    }

    add (particle) {
        while (this.list.length >= this.limit) {
            let p = this.list.pop();
            this.scene.remove(p.mesh);
            p.dispose();
        }

        this.scene.add(particle.mesh);
        this.list.unshift(particle);
    }
    
    reset () {
        while (this.list.length > 0) {
            let p = this.list.pop();
            this.scene.remove(p.mesh);
            p.dispose();
        }  
    }

    update () {
        const nlist = [];
        for (var i = 0; i < this.list.length; i++) {
            let p = this.list[i];

            if (p.alive()) {
                p.update();
                nlist.push(p);
            } else {
                this.scene.remove(p.mesh);
                p.dispose();
            }
        }
        this.list = nlist;
    }
}