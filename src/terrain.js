
class Terrain {
    constructor () {
        const SIDE = 1000;
        const HEIGHT = 1;

        // Three
        const map = new THREE.BoxBufferGeometry(SIDE, SIDE, HEIGHT);
        const mapMaterial = new THREE.MeshLambertMaterial();
        mapMaterial.color.setHSL(0.38, 0.50, 0.25);
        this.mesh = new THREE.Mesh(map, mapMaterial);

        // Ammo
        const ground = new Ammo.btBoxShape(new Ammo.btVector3(SIDE * 0.5, SIDE * 0.5, HEIGHT * 0.5));
        const mass = 0;

        let t = new Ammo.btTransform();
        t.setIdentity();
        t.setOrigin(new Ammo.btVector3(0, 0, 0));
        t.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
        let motionState = new Ammo.btDefaultMotionState(t);

        let localInertia = new Ammo.btVector3(0, 0, 0);
        let rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, ground, localInertia);
        this.body = new Ammo.btRigidBody(rbInfo);
        
        this.body.setFriction(1);
    }
}