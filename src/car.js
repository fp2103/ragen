
class CarFactory {

    constructor (mainView, minimapView, physics) {
        this.mainScene = mainView.scene;
        this.minimapScene = minimapView.scene;
        this.phyWorld = physics.world;

        // Geometry properties
        const CAR_WIDTH = 1.8;
        const CAR_LENGTH = 4;
        const WHEEL_RADIUS = CAR_WIDTH/5;
        this.size = {width: CAR_WIDTH,
                     length: CAR_LENGTH,
                     height: CAR_WIDTH/2,
                     wheelRadius: WHEEL_RADIUS};
        
        // Load Main Geometry
        // Build car shape around origin
        const w = this.size.width/2;
        const l = this.size.length/2;
        const h = this.size.height/2;
        const carVertices = [
            new THREE.Vector3(-w, -l, -h),
            new THREE.Vector3(0, l, -h),
            new THREE.Vector3(w, -l, -h),
        
            new THREE.Vector3(w, -l, -h),
            new THREE.Vector3(0, w-l, h),
            new THREE.Vector3(-w, -l, -h),
        
            new THREE.Vector3(-w, -l, -h),
            new THREE.Vector3(0, w-l, h),
            new THREE.Vector3(0, l, -h),
        
            new THREE.Vector3(0, l, -h),
            new THREE.Vector3(0, w-l, h),
            new THREE.Vector3(w, -l, -h),
        ];
        const mainGeo = new THREE.BufferGeometry().setFromPoints(carVertices);
        mainGeo.computeVertexNormals();

        const shadowVertices = [
            new THREE.Vector3(w, -l, 0),
            new THREE.Vector3(0, l, 0),
            new THREE.Vector3(-w, -l, 0)];
        const shadowGeo = new THREE.BufferGeometry().setFromPoints(shadowVertices);
        shadowGeo.computeVertexNormals();
        shadowGeo.scale(1.07, 1.07, 1.07);

        this.geomteries = {
            mainGeo: mainGeo,
            edges: new THREE.EdgesGeometry(mainGeo),
            particles: new THREE.PlaneBufferGeometry(1,1),
            wheelGeo: new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_RADIUS/1.5, 10, 1),
            wheelGeoIndicator: new THREE.BoxGeometry(1.2*WHEEL_RADIUS/1.5, WHEEL_RADIUS, 0.15*WHEEL_RADIUS),
            wheelGeoIndicator2: undefined,
            minimapGeo: new THREE.PlaneBufferGeometry(30,30),
            minimapGeoInner: new THREE.PlaneBufferGeometry(20,20),
            shadowGeo: shadowGeo
        };
        this.geomteries.wheelGeo.rotateZ(Math.PI/2);
        this.geomteries.wheelGeoIndicator2 = this.geomteries.wheelGeoIndicator.clone();
        this.geomteries.wheelGeoIndicator2.rotateX(Math.PI/2);

        this.materials = {
            grass_particles_mat: new THREE.MeshBasicMaterial({color: 0x87B982}),
            edgeMat: new THREE.LineBasicMaterial({color: 0x000000}),
            wheelMat: new THREE.MeshBasicMaterial({color: 0x000000}),
            wheelMatIndicator: new THREE.MeshBasicMaterial({color: 0xDCDCDC}),
            shadowMat: new THREE.MeshPhongMaterial({color: 0x000000, opacity: 0.2, transparent: true}),
            chassisMat: (params) => { return new THREE.MeshLambertMaterial(params); }
        };
    }

    createCar (color, mainPlayer) {
        const car = new Car(this.geomteries, this.materials, this.size, color, mainPlayer);
        car.initMainView();
        car.initMinimapView();
        if (mainPlayer) {
            car.chassisMesh.applyMatrix4(new THREE.Matrix4().makeScale(1.01, 1.01, 1.01));
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
        this.mainScene.add(...mainMeshes);
        this.minimapScene.add(minimapMesh);
    }

    unvisible_callback (mainMeshes, minimapMesh) {
        this.mainScene.remove(...mainMeshes);
        this.minimapScene.remove(minimapMesh);
    }

    createGhost () {
        const mats = Object.assign({}, this.materials);
        mats.wheelMat = new THREE.MeshPhongMaterial({color: 0x000000, opacity: 0.3, transparent: true});
        mats.wheelMatIndicator = new THREE.MeshPhongMaterial({color: 0xDCDCDC, opacity: 0.1, transparent: true});
        mats.chassisMat = (p) => { return new THREE.MeshPhongMaterial({color: p.color, opacity: 0.3, transparent: true}); }
        const car = new Car(this.geomteries, mats, this.size, 0xFFFFFF, false);
        car.initMainView();
        car.shadowMesh = new THREE.Object3D();
        car.outerMinimapColor = 0x0;
        car.initMinimapView();
        car.visible_cb = this.visible_callback.bind(this);
        car.unvisible_cb = this.unvisible_callback.bind(this);
        return car;
    }
}

class Car {

    constructor (geos, mats, size, color, mainPlayer) {
        this.WHEELSNUMBER = 4;
        this.FRONTLEFT = 0;
        this.FRONTRIGHT = 1;
        this.BACKLEFT = 2;
        this.BACKRIGHT = 3;

        this.geos = geos;
        this.mats = mats;

        // Geometry properties
        this._width = size.width;
        this._length = size.length;
        this._height = size.height;
        this._wheelRadius = size.wheelRadius;

        // Reset altitude
        this.Z_RESET = 0.6;

        // Meshes
        this.chassisMesh = undefined;
        this.cameraPosition = undefined;
        this.wheelMeshes = [undefined, undefined, undefined, undefined];
        this.independantWheels = mainPlayer;

        this.shadowMesh = undefined;
        this.shadowZ = 0.2+this._height/2;
        this.shadowY = 0.15;

        this.minimapMeshInner = undefined;
        this.minimapMesh = undefined;

        // Physics
        this.chassisBody = undefined;
        this.vehiclePhysics = undefined;
        this.DISABLE_DEACTIVATION = 4;

        // Colors
        this.currentColor = new THREE.Color(color);
        this.outerMinimapColor = mainPlayer ? 0xFFFF00: 0xFFFFFF; 

        // scene add/remove Callbacks
        this.visible_cb = undefined;
        this.unvisible_cb = undefined;
        this.visible = false;

        // Client setted position
        this.lerpPosition = undefined;
        this.lerpPosition_shadow = undefined;
        this.lerpQuaternion = undefined;
        this.wheelsRotation = undefined;
        this.newSteeringVal = 0;
        this.lastSteeringVal = 0;
        this.LERP_SPEED = 0.2;
        this.lerp_speed = 1;
    }

    initMainView () {
        const lineMesh = new THREE.LineSegments(this.geos.edges, this.mats.edgeMat);
        const material = this.mats.chassisMat({color: this.currentColor});
        this.chassisMesh = new THREE.Mesh(this.geos.mainGeo, material);
        this.chassisMesh.add(lineMesh);

        // Camera
        this.cameraPosition = new THREE.Object3D();
        this.cameraPosition.position.set(0, -5, 3.5);
        this.chassisMesh.add(this.cameraPosition);

        // Wheels
        const ww = (this._width/2);
        const wl = (this._length/2)*0.80;
        const wh = this.independantWheels ? -0.3 : -0.4;
        for (var i = 0; i < this.WHEELSNUMBER; i++) {
            let m = new THREE.Mesh(this.geos.wheelGeo, this.mats.wheelMat);
            m.add(new THREE.Mesh(this.geos.wheelGeoIndicator, this.mats.wheelMatIndicator));
            m.add(new THREE.Mesh(this.geos.wheelGeoIndicator2, this.mats.wheelMatIndicator));

            if (i == this.FRONTLEFT) m.position.set(-ww, wl, wh);
            if (i == this.FRONTRIGHT) m.position.set(ww, wl, wh);
            if (i == this.BACKLEFT) m.position.set(-ww, -wl, wh);
            if (i == this.BACKRIGHT) m.position.set(ww, -wl, wh);
            this.wheelMeshes[i] = m;
            if (!this.independantWheels) this.chassisMesh.add(m);
        }

        this.shadowMesh = new THREE.Mesh(this.geos.shadowGeo, this.mats.shadowMat);
    }

    initMinimapView () {
        this.minimapMesh = new THREE.Mesh(this.geos.minimapGeo, new THREE.MeshBasicMaterial({color: this.outerMinimapColor}));
        this.minimapMeshInner = new THREE.Mesh(this.geos.minimapGeoInner, new THREE.MeshBasicMaterial({color: this.currentColor}));

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

        if (this.independantWheels) {
            this.visible_cb([this.chassisMesh, this.shadowMesh, ...this.wheelMeshes], this.minimapMesh);
        } else {
            this.visible_cb([this.chassisMesh, this.shadowMesh], this.minimapMesh);
        }
        this.visible = true;
    }

    makeUnvisible () {
        if (!this.visible) return;

        if (this.independantWheels) {
            this.unvisible_cb([this.chassisMesh, this.shadowMesh, ...this.wheelMeshes], this.minimapMesh);
        } else {
            this.unvisible_cb([this.chassisMesh, this.shadowMesh], this.minimapMesh);
        }
        this.visible = false;
    }

    setAtStartingPosition (nosePoint, alignementVector, sec3) {
        // Set the nose to the right point
        const mav = alignementVector.clone();
        mav.normalize();
        mav.multiplyScalar(-(this._length/2)-1);
        const initPoint = nosePoint.clone();
        if(!sec3) initPoint.add(mav);
        initPoint.z = this.Z_RESET;

        this.forceMeshToPosition(initPoint, alignementVector);
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

            this.shadowMesh.position.set(p.x(), p.y()-this.shadowY, p.z()-this.shadowZ);
            this.shadowMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());

            this.minimapMesh.position.set(p.x(), p.y(), p.z());
        }

        // Update wheels position
        for (var i = 0; i < this.WHEELSNUMBER; i++) {
            if (force) this.vehiclePhysics.updateWheelTransform(i); 
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
        const y = ((1000*Math.abs(speed)/3600) * (1/FPS)) + SMALL_GAP;
        
        const m = new THREE.Mesh(this.geos.particles, this.mats.grass_particles_mat);
        m.applyMatrix4(new THREE.Matrix4().makeScale(this._wheelRadius/1.5, y, 1));
        const part = new Particle(m, 2);
        
        let pos = this.wheelMeshes[idWheel].position.clone();
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

    getPositionToLerp () {
        let p = {x: this.chassisMesh.position.x,
            y: this.chassisMesh.position.y,
            z: this.chassisMesh.position.z};
        let q = {x: this.chassisMesh.quaternion.x,
            y: this.chassisMesh.quaternion.y,
            z: this.chassisMesh.quaternion.z,
            w: this.chassisMesh.quaternion.w};
        let s = this.vehiclePhysics.getCurrentSpeedKmHour()/3.6;
        let sv = this.vehiclePhysics.getSteeringValue(0);
        return {p: p, q: q, s: s, sv: sv};
    }

    setLerpPosition (pos, quat, speed, steeringVal) {
        this.lerpPosition = pos;
        if (pos != undefined) {
            this.lerpPosition_shadow = new THREE.Vector3(pos.x, pos.y-this.shadowY, pos.z-this.shadowZ);
        }
        if (quat != undefined) {
            this.lerpQuaternion = new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w);
        }
        let dd = speed*(1/FPS);
        this.wheelsRotation = dd/this._wheelRadius;
        this.newSteeringVal = steeringVal;
    }

    updateLerpPosition () {
        if (this.lerpPosition != undefined) {
            this.minimapMesh.position.lerp(this.lerpPosition, this.lerp_speed);
            
            this.chassisMesh.position.lerp(this.lerpPosition, this.lerp_speed);
            this.chassisMesh.quaternion.slerp(this.lerpQuaternion, this.lerp_speed);
            this.shadowMesh.position.lerp(this.lerpPosition_shadow, this.lerp_speed);
            this.shadowMesh.quaternion.slerp(this.lerpQuaternion, this.lerp_speed);

            // rotate the wheel at the speed of the car
            for (var i = 0; i < this.WHEELSNUMBER; i++) {
                this.wheelMeshes[i].rotateX(-this.wheelsRotation);
            }

            // steering
            let dsv = this.newSteeringVal - this.lastSteeringVal;
            this.lastSteeringVal = this.newSteeringVal;
            this.wheelMeshes[this.FRONTLEFT].rotateOnWorldAxis(new THREE.Vector3(0,0,1), dsv);
            this.wheelMeshes[this.FRONTRIGHT].rotateOnWorldAxis(new THREE.Vector3(0,0,1), dsv);

            // reset lerp speed
            this.lerp_speed = this.LERP_SPEED;
        }
    }

    forceMeshToPosition (point, dir) {
        let angle = dir.angleTo(new THREE.Vector3(0,1,0));
        const orthoZ = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), dir);
        let sign = 1;
        if (orthoZ.z < 0) sign = -1;
        angle = sign*angle;
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), angle);
        
        if (this.independantWheels) {
            // Modifiy Ammo body position and then mesh
            let t = new Ammo.btTransform();
            t.setIdentity();
            t.setOrigin(new Ammo.btVector3(point.x, point.y, point.z + this._height));
            t.setRotation(new Ammo.btQuaternion(q.x, q.y, q.z, q.w));
            let motionState = new Ammo.btDefaultMotionState(t);
            this.chassisBody.setMotionState(motionState);
            this.chassisBody.setLinearVelocity(new Ammo.btVector3(0,0,0));
            this.chassisBody.setAngularVelocity(new Ammo.btVector3(0,0,0));
            this.chassisBody.setLinearVelocity(0);

            this.updatePosition(0, true);
        } else {
            this.chassisMesh.position.set(point.x, point.y, point.z + this._height);
            this.chassisMesh.quaternion.set(q.x, q.y, q.z, q.w);
        }
    }
}