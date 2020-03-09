
class Car {

    constructor (conf) {
        this.WHEELSNUMBER = 4;

        this._width = conf.width;
        this._length = conf.length;
        this._height = conf.width/2;

        this._zreset = conf.Zinit;

        this._wheelRadius = conf.width/5;

        this.cameraX = conf.cameraPosition.x;
        this.cameraY = conf.cameraPosition.y;
        this.cameraZ = conf.cameraPosition.z;

        this.chassisMesh = undefined;
        this.cameraPosition = undefined;
        this.wheelMeshes = [];
        this.FRONTLEFT = 0;
        this.FRONTRIGHT = 1;
        this.BACKLEFT = 2;
        this.BACKRIGHT = 3;

        this.chassisBody = undefined;
        this.vehiclePhysics = undefined;

        this.currentColor = new THREE.Color(conf.defaultColor);
        this.minimapOuterColor = new THREE.Color(conf.colorOuterMinimap);
        this.colorGrassParticle = conf.colorGrassParticle;
    }

    initVue (scene) {
        // Build car shape around origin
        const w = this._width/2;
        const l = this._length/2;
        const h = this._height/2;
        const carVertices = [
            new THREE.Vector3(w, -l, -h),
            new THREE.Vector3(0, l, -h),
            new THREE.Vector3(-w, -l, -h),
        
            new THREE.Vector3(-w, -l, -h),
            new THREE.Vector3(0, w-l, h),
            new THREE.Vector3(w, -l, -h),
        
            new THREE.Vector3(w, -l, -h),
            new THREE.Vector3(0, w-l, h),
            new THREE.Vector3(0, l, -h),
        
            new THREE.Vector3(0, l, -h),
            new THREE.Vector3(0, w-l, h),
            new THREE.Vector3(-w, -l, -h)
        ];

        const geo = new THREE.BufferGeometry().setFromPoints(carVertices);
        geo.computeVertexNormals();
        const edges = new THREE.EdgesGeometry(geo);
        const lineMesh = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({color: 0x000000}));

        const material = new THREE.MeshLambertMaterial({color : this.currentColor});
        this.chassisMesh = new THREE.Mesh(geo, material);
        //this.chassisMesh.castShadow = true;
        //this.chassisMesh.receiveShadow = true;
        this.chassisMesh.add(lineMesh);

        // Camera
        this.cameraPosition = new THREE.Object3D();
        this.cameraPosition.position.set(this.cameraX, this.cameraY, this.cameraZ);
        this.chassisMesh.add(this.cameraPosition);

        scene.add(this.chassisMesh);

        // Wheels
        const width = this._wheelRadius/1.5;
        const wheelGeo = new THREE.CylinderGeometry(this._wheelRadius, this._wheelRadius, width, 24, 1);
        wheelGeo.rotateZ(Math.PI/2);
        for (var i = 0; i < this.WHEELSNUMBER; i++) {
            let m = new THREE.Mesh(wheelGeo, new THREE.MeshBasicMaterial({color: 0x000000}));
            m.add(new THREE.Mesh(new THREE.BoxGeometry(width * 1.5, this._wheelRadius * 1.75, this._wheelRadius*.25),
                                 new THREE.MeshBasicMaterial({color: 0xfff000})));
            this.wheelMeshes[i] = m;
            scene.add(m);
        }

        // Minimap
        const minimapgeo = new THREE.PlaneBufferGeometry(30,30);
        this.minimapMesh = new THREE.Mesh(minimapgeo, new THREE.MeshBasicMaterial({color: this.minimapOuterColor}));

        const minimapgeoInner = new THREE.PlaneBufferGeometry(20,20);
        this.minimapMeshInner = new THREE.Mesh(minimapgeoInner, new THREE.MeshBasicMaterial({color: this.currentColor}));

        this.minimapMesh.add(this.minimapMeshInner);
    }

    initPhysics (physicsWorld, conf) {
        // consider car as a box
        const boxShape = new Ammo.btBoxShape(new Ammo.btVector3((this._width/2)+SMALL_GAP,
                                                                (this._length/2)+SMALL_GAP,
                                                                (this._height/2)+SMALL_GAP));

        let t = new Ammo.btTransform();
        t.setIdentity();
        t.setOrigin(new Ammo.btVector3(0, 0, 0));
        t.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
        let motionState = new Ammo.btDefaultMotionState(t);

        let localInertia = new Ammo.btVector3(0, 0, 0);
		boxShape.calculateLocalInertia(conf.mass, localInertia);

        let rbInfo = new Ammo.btRigidBodyConstructionInfo(conf.mass, motionState, boxShape, localInertia);
        this.chassisBody = new Ammo.btRigidBody(rbInfo);
        this.chassisBody.setActivationState(DISABLE_DEACTIVATION);
        physicsWorld.addRigidBody(this.chassisBody);

        const tuning = new Ammo.btVehicleTuning();
        const rayCaster = new Ammo.btDefaultVehicleRaycaster(physicsWorld);
        this.vehiclePhysics = new Ammo.btRaycastVehicle(tuning, this.chassisBody, rayCaster);
        physicsWorld.addAction(this.vehiclePhysics);

        // wheels
        const wheelDirectionCS0 = new Ammo.btVector3(0, 0, -1);
        const wheelAxleCS = new Ammo.btVector3(1, 0, 0);

        const w = (this._width/2);
        const l = (this._length/2)*0.80;
        const h = -0.1;
        const flPos = new Ammo.btVector3(-w, l, h);
        const frPos = new Ammo.btVector3(w, l, h);
        const blPos = new Ammo.btVector3(-w, -l, h);
        const brPos = new Ammo.btVector3(w, -l, h);

        function initWheel(vehicle, isFront, pos, radius, f) {
            var wheelInfo = vehicle.addWheel(
                    pos,
                    wheelDirectionCS0,
                    wheelAxleCS,
                    conf.suspensionRestLength,
                    radius,
                    tuning,
                    isFront);
                    
            wheelInfo.set_m_maxSuspensionTravelCm(conf.maxSuspensionTravelCm);
            wheelInfo.set_m_suspensionStiffness(conf.suspensionStiffness);
            wheelInfo.set_m_wheelsDampingRelaxation(Math.sqrt(conf.suspensionStiffness));
            wheelInfo.set_m_wheelsDampingCompression(0.6*Math.sqrt(conf.suspensionStiffness));
            wheelInfo.set_m_rollInfluence(conf.rollInfluence);
            wheelInfo.set_m_frictionSlip(f);
        }

        // Front left
        initWheel(this.vehiclePhysics, true, flPos, this._wheelRadius, conf.friction);
        // Front Right
        initWheel(this.vehiclePhysics, true, frPos, this._wheelRadius, conf.friction);
        // Back Left
        initWheel(this.vehiclePhysics, false, blPos, this._wheelRadius, 5*conf.friction);
        // Back Right
        initWheel(this.vehiclePhysics, false, brPos, this._wheelRadius, 5*conf.friction);
    }

    setAtStartingPosition (nosePoint, alignementVector) {
        // Set the nose to the right point
        const mav = alignementVector.clone();
        mav.normalize();
        mav.multiplyScalar(-(this._length/2)-1);
        const initPoint = nosePoint.clone();
        initPoint.add(mav);
        
        // Align with the vector
        var angleToVert = alignementVector.angleTo(new THREE.Vector3(0,1,0));
        const orthoZ = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), alignementVector);
        let sign = 1;
        if (orthoZ.z < 0) {
            sign = -1;
        }
        angleToVert = sign*angleToVert;
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), angleToVert);

        // Modifiy Ammo body position
        let t = new Ammo.btTransform();
        t.setIdentity();
        t.setOrigin(new Ammo.btVector3(initPoint.x, initPoint.y, this._zreset));
        t.setRotation(new Ammo.btQuaternion(q.x, q.y, q.z, q.w));
        let motionState = new Ammo.btDefaultMotionState(t);
        this.chassisBody.setMotionState(motionState);
        this.chassisBody.setLinearVelocity(new Ammo.btVector3(0,0,0));
        this.chassisBody.setAngularVelocity(new Ammo.btVector3(0,0,0));
        this.chassisBody.setLinearVelocity(0);

        this.updatePosition(0, true);
    }

    updatePosition (speed, force) {
        const update = (speed < -1 || speed > 1) || force;

        if (update) {
            // Update chassis Position
            let tm = this.vehiclePhysics.getChassisWorldTransform();
            let p = tm.getOrigin();
            let q = tm.getRotation();
            this.chassisMesh.position.set(p.x(), p.y(), p.z());
            this.chassisMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());

            this.minimapMesh.position.set(p.x(), p.y(), p.z());
        }

        // Update wheels position
        for (var i = 0; i < this.WHEELSNUMBER; i++) {
            let tm = this.vehiclePhysics.getWheelTransformWS(i);
            let p = tm.getOrigin();
            let q = tm.getRotation();

            if (update) {
                this.wheelMeshes[i].position.set(p.x(), p.y(), p.z());
            }
            this.wheelMeshes[i].quaternion.set(q.x(), q.y(), q.z(), q.w());
        }
    }

    createParticleMarkGrass (idWheel, speed) {
        let pos = this.wheelMeshes[idWheel].position.clone();
        let y = ((1000*Math.abs(speed)/3600) * (1/FPS)) + SMALL_GAP;
        let part = new Particle(new THREE.Vector2(this._wheelRadius/1.5, y), this.colorGrassParticle, 2);
        
        pos.z -= this._wheelRadius;
        let rot = this.chassisMesh.rotation.clone();
        rot.x = 0;
        rot.y = 0;
        part.initPosition(pos, new THREE.Quaternion().setFromEuler(rot));
        return part;
    }

    updateColor (color) {
        this.currentColor = new THREE.Color(color);
        if (this.chassisMesh != undefined && this.minimapMeshInner != undefined) { 
            this.chassisMesh.material.color.copy(this.currentColor);
            this.minimapMeshInner.material.color.copy(this.currentColor);
        }
    }
}