'use strict';

class Particles {

    constructor (number, size, color, time) {
        // Object3D
        this.meshes = [];

        this.geo = new THREE.PlaneBufferGeometry(size.x, size.y);
        this.mat = new THREE.MeshBasicMaterial({color});

        for (var i = 0; i < number; i++) {
            this.meshes.push(new THREE.Mesh(this.geo, this.mat));
        }

        // Time
        this.clock = new THREE.Clock();
        this.maxTime = time;
    }

    alive () {
        return this.clock.getElapsedTime() < this.maxTime;
    }

    init_position (pos, quat) {
        for (var i = 0; i < this.meshes.length; i++) {
            this.meshes[i].position.set(pos.x, pos.y, pos.z);
            this.meshes[i].quaternion.set(quat.x, quat.y, quat.z, quat.w);
        }
    }

    update () {}

    dispose () {
        this.geo.dispose();
        this.mat.dispose();
    }
}

class ParticlesManager {

    constructor (scene) {
        this.scene = scene;
        
        this.list = [];
    }

    add (particles) {
        for (var i = 0; i < particles.meshes.length; i++) {
            this.scene.add(particles.meshes[i]);
        }
        this.list.push(particles);
    }

    update () {
        for (var i = 0; i < this.list.length; i++) {
            let ps = this.list[i];

            if (ps.alive()) {
                ps.update();
            } else {
                for (var j = 0; j < ps.meshes.length; j++) {
                    this.scene.remove(ps.meshes[j]);
                }
                ps.dispose();
            }
        }
    }
}