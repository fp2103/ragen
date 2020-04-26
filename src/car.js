
class CarFactory {

    constructor (mainView, minimapView, physics) {
        this.mainScene = mainView.scene;
        this.minimapScene = minimapView.scene;
        this.phyWorld = physics.world;
    }

    createCar (color, mainPlayer) {
        const car = new Car(color, mainPlayer);
        car.initMainView(this.mainScene);
        car.initMinimapView(this.minimapScene);
        if (mainPlayer) {
            car.initPhysics(this.phyWorld, {mass: 800,
                                            suspensionStiffness: 100,
                                            suspensionRestLength: 0.4,
                                            maxSuspensionTravelCm: 10,
                                            rollInfluence: 0.02,
                                            friction: 8});
        }
        car.visible_cb = this.visible_callback.bind(this);
        car.unvisible_cb = this.unvisible_callback.bind(this);
        return car;
    }

    visible_callback (mainMeshes, minimapMesh) {
        for (var i = 0; i < mainMeshes.length; i++) {
            this.mainScene.add(mainMeshes[i]);
        }
        this.minimapScene.add(minimapMesh);
    }

    unvisible_callback (mainMeshes, minimapMesh) {
        for (var i = 0; i < mainMeshes.length; i++) {
            this.mainScene.remove(mainMeshes[i]);
        }
        this.minimapScene.remove(minimapMesh);
    }
}

class Car {

    constructor (color, mainPlayer) {
        this.mainPlayer = mainPlayer;

        this.WHEELSNUMBER = 4;
        this.FRONTLEFT = 0;
        this.FRONTRIGHT = 1;
        this.BACKLEFT = 2;
        this.BACKRIGHT = 3;

        const CAR_WIDTH = 1.8;
        const CAR_LENGTH = 4;
        this._width = CAR_WIDTH;
        this._length = CAR_LENGTH;
        this._height = CAR_WIDTH/2;
        this._zreset = 2;
        this._wheelRadius = CAR_WIDTH/5;

        this.chassisMesh = undefined;
        this.minimapMeshInner = undefined;
        this.cameraPosition = undefined;
        this.wheelMeshes = [undefined, undefined, undefined, undefined];

        this.minimapMesh = undefined;

        this.chassisBody = undefined;
        this.vehiclePhysics = undefined;
        this.DISABLE_DEACTIVATION = 4;

        this.currentColor = new THREE.Color(color);
        this.outerMinimapColor = this.mainPlayer ? 0xFFFF00: 0xFFFFFF; 
        this.COLOR_GRASS_PARTICLE = 0x87B982;

        this.visible_cb = undefined;
        this.unvisible_cb = undefined;
        this.visible = true;

        // Client setted position
        this.lerpPosition = undefined;
        this.lerpQuaternion = undefined;
        this.clientSpeed = undefined;
        this.clientSteeringVal = undefined;
        this.lastSteeringVal = 0;
    }

    initMainView (scene) {
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
        this.cameraPosition.position.set(0, -5, 3.5);
        this.chassisMesh.add(this.cameraPosition);

        // Wheels
        const ww = (this._width/2);
        const wl = (this._length/2)*0.80;
        const wh = -0.3;
        const width = this._wheelRadius/1.5;
        const wheelGeo = new THREE.CylinderGeometry(this._wheelRadius, this._wheelRadius, width, 24, 1);
        wheelGeo.rotateZ(Math.PI/2);
        for (var i = 0; i < this.WHEELSNUMBER; i++) {
            let m = new THREE.Mesh(wheelGeo, new THREE.MeshBasicMaterial({color: 0x000000}));
            m.add(new THREE.Mesh(new THREE.BoxGeometry(width * 1.5, this._wheelRadius * 1.75, this._wheelRadius*.25),
                                 new THREE.MeshBasicMaterial({color: 0xfff000})));
            if (i == this.FRONTLEFT) m.position.set(-ww, wl, wh);
            if (i == this.FRONTRIGHT) m.position.set(ww, wl, wh);
            if (i == this.BACKLEFT) m.position.set(-ww, -wl, wh);
            if (i == this.BACKRIGHT) m.position.set(ww, -wl, wh);
            this.wheelMeshes[i] = m;
            if (!this.mainPlayer) this.chassisMesh.add(m);
        }

        scene.add(this.chassisMesh);
    }

    initMinimapView (scene) {
        const minimapgeo = new THREE.PlaneBufferGeometry(30,30);
        this.minimapMesh = new THREE.Mesh(minimapgeo, new THREE.MeshBasicMaterial({color: this.outerMinimapColor}));

        const minimapgeoInner = new THREE.PlaneBufferGeometry(20,20);
        this.minimapMeshInner = new THREE.Mesh(minimapgeoInner, new THREE.MeshBasicMaterial({color: this.currentColor}));

        this.minimapMesh.add(this.minimapMeshInner);

        scene.add(this.minimapMesh);
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
        this.chassisBody.setActivationState(this.DISABLE_DEACTIVATION);
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

    makeVisible () {
        if (this.visible) return;

        if (this.mainPlayer) {
            this.visible_cb([this.chassisMesh, ...this.wheelMeshes], this.minimapMesh);
        } else {
            this.visible_cb([this.chassisMesh], this.minimapMesh);
        }
        this.visible = true;
    }

    makeUnvisible () {
        if (!this.visible) return;

        if (this.mainPlayer) {
            this.unvisible_cb([this.chassisMesh, ...this.wheelMeshes], this.minimapMesh);
        } else {
            this.unvisible_cb([this.chassisMesh], this.minimapMesh);
        }
        this.visible = false;
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
        let part = new Particle(new THREE.Vector2(this._wheelRadius/1.5, y), this.COLOR_GRASS_PARTICLE, 2);
        
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

    setLerpPosition (pos, quat, speed, steeringVal) {
        this.lerpPosition = pos;
        this.lerpQuaternion = quat;
        this.clientSpeed = speed;
        this.clientSteeringVal = steeringVal;
    }

    updateLerpPosition () {
        if (this.lerpPosition != undefined && this.lerpQuaternion != undefined
            && this.clientSpeed != undefined && this.clientSteeringVal != undefined) {
            this.minimapMesh.position.lerp(this.lerpPosition, 0.2);
            
            this.chassisMesh.position.lerp(this.lerpPosition, 0.2);
            this.chassisMesh.quaternion.set(this.lerpQuaternion.x,
                                            this.lerpQuaternion.y,
                                            this.lerpQuaternion.z,
                                            this.lerpQuaternion.w);

            // rotate the wheel at the speed of the car
            let dd = this.clientSpeed*(1/FPS);
            let rad = dd/this._wheelRadius;
            for (var i = 0; i < this.WHEELSNUMBER; i++) {
                this.wheelMeshes[i].rotateX(-rad);
            }

            let dsv = this.clientSteeringVal - this.lastSteeringVal;
            this.lastSteeringVal = this.clientSteeringVal;
            this.wheelMeshes[this.FRONTLEFT].rotateOnWorldAxis(new THREE.Vector3(0,0,1), dsv);
            this.wheelMeshes[this.FRONTRIGHT].rotateOnWorldAxis(new THREE.Vector3(0,0,1), dsv);
        }
    } 
}