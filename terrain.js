'use strict';

class Terrain {
    constructor (conf) {
        // Three
        const map = new THREE.BoxBufferGeometry(conf.Xsize, conf.Ysize, conf.Zsize);
        const mapMaterial = new THREE.MeshLambertMaterial({color: 0xffffff});
        mapMaterial.color.setHSL(0.38, 0.50, 0.25);
        this.mesh = new THREE.Mesh(map, mapMaterial);
        this.mesh.receiveShadow = true;

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