'use strict';

class Physics {
    constructor () {
        const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
		const dispatcher = new Ammo.btCollisionDispatcher( collisionConfiguration );
		const broadphase = new Ammo.btDbvtBroadphase();
        const solver = new Ammo.btSequentialImpulseConstraintSolver();
        
		this.world = new Ammo.btDiscreteDynamicsWorld( dispatcher, broadphase, solver, collisionConfiguration );
        this.world.setGravity( new Ammo.btVector3( 0, 0, -10 ) );
    }
}