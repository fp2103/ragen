'use strict';

class Terrain {
    constructor (conf) {
        // Three
        const map = new THREE.BoxBufferGeometry(conf.Xsize, conf.Ysize, conf.Zsize);
        const mapMaterial = new THREE.MeshBasicMaterial({color: conf.color});
        this.mesh = new THREE.Mesh(map, mapMaterial);

        // Ammo
        const ground = new Ammo.btBoxShape(new Ammo.btVector3(conf.Xsize * 0.5, conf.Ysize * 0.5, conf.Zsize * 0.5));
        const mass = 0;

        let t = new Ammo.btTransform();
        t.setIdentity();
        t.setOrigin(new Ammo.btVector3(0, 0, 0));
        t.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
        let motionState = new Ammo.btDefaultMotionState(t);

        let localInertia = new Ammo.btVector3(0, 0, 0);
		//ground.calculateLocalInertia(mass, localInertia);

        let rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, ground, localInertia);
        this.body = new Ammo.btRigidBody(rbInfo);
        
        this.body.setFriction(1);
    }
}