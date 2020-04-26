
// Gameplay and Menu
class Gameplay {

    constructor (player, controls, camera, particlesManager) {
        this.player = player;
        this.controls = controls;
        this.camera = camera;
        this.particlesManager = particlesManager;

        this.leaderboard = new Leaderboard(player);
        this.speedHtml = document.getElementById('speed');
        this.gameElementsHtml = document.getElementById('game_elements'); 
        this.otherDrivers = new Map();

        // Init camera position
        this.UP_Z = new THREE.Vector3(0, 0, 1);
        this.LERP_SLOW = 0.02;
        this.LERP_FAST = 0.15;
        this.cameraLookAt = new THREE.Vector3(0,0,0);
        this.cameraLerp = this.LERP_SLOW;
        this.cameraStartDate = undefined;

        // driving parameter        
        this.STEERING_INCREMENT = 0.04;
        this.STEERING_CLAMP = 0.4;
        this.vehicleSteering = 0;
        this.MAX_ENGINE_FORCE = 3000;
        this.MAX_BREAKING_FORCE = 100;
        this.MAX_SPEED = 250;
        this.MAX_REVERSE_SPEED = -30;
        this.DEFAULT_DRAG = 3;
        this.GRASS_DRAG = 60;
        this.DOWN_VECTOR = new THREE.Vector3(0, 0, -1);

        // Circuit
        this.circuit = undefined;
        this.startingPos = undefined;
        this.checkpoints = [undefined, undefined, undefined];

        // Rules
        this.started = false;
        this.nextcp = 0;
        
        // reset
        this.justReset = false;

        // Arcs status
        this.state = undefined;
    }

    /*
     * clear all
     * update
     * init state
     */
    setState (newState, newCircuit, newOtherDrivers) {
        // default html display
        this.gameElementsHtml.style.display = "none";
        this.speedHtml.style.display = "none";
        this.leaderboard.clearRows();

        // default Scene display
        this.clearPodiumScene();
        this.player.car.makeUnvisible();
        this.otherDrivers.forEach((v) => {v.car.makeUnvisible()});
        
        // Update circuit
        if (newCircuit != undefined) {
            // Reset best laptime
            if (this.circuit == undefined || newCircuit.id != this.circuit.id) {
                this.player.resetTime();
            }

            this.circuit = newCircuit;
            this.checkpoints = [this.circuit.slMesh,
                                this.circuit.cp1Mesh,
                                this.circuit.cp2Mesh];
            this.startingPos = this.circuit.getStartingPosition();
        }
        if (this.circuit == undefined) return;

        // Update other drivers
        if (newOtherDrivers != undefined) {
            this.otherDrivers.clear();
            newOtherDrivers.forEach(d => this.otherDrivers.set(d.id, d));
        }

        // Update state
        switch(newState) {
            case "spectator":
                this.gameElementsHtml.style.display = "block";
                this.leaderboard.setMode("spectator", this.otherDrivers.values());
            case "menu":
                this.otherDrivers.forEach((v) => {v.car.makeVisible()});
                break;
            case "solo":
            case "multi":
                this.gameElementsHtml.style.display = "block";
                this.speedHtml.style.display = "block";
                this.leaderboard.setMode(newState, this.otherDrivers.values());
                this.otherDrivers.forEach((v) => {v.car.makeVisible()});
                this.player.car.makeVisible();
                break;
            case "podium":
                this.initPodiumScene();
                break;
        }
        this.state = newState;
        this.resetCamera();
        this.reset();
    }

    update () {
        // Circuit promise not yet resolved, nothing to do
        if (this.circuit == undefined) return;

        switch(this.state) {
            case "spectator":
                this.leaderboard.update();
            case "menu":
                this.otherDrivers.forEach((v) => {v.car.updateLerpPosition()});
                break;
            case "multi":
                this.otherDrivers.forEach((v) => {v.car.updateLerpPosition()});
            case "solo":
                this.onPlay();
                this.leaderboard.update();
                this.particlesManager.update();
                break;
            case "podium":
                this.onPodiumScene();
                this.particlesManager.update();
                break;
        }
    }

    resetCamera () {
        this.camera.position.set(0, 0, 300);
        this.cameraLerp = this.LERP_SLOW;
        this.camera.up = new THREE.Vector3(0, 1, 0);
        this.cameraLookAt = new THREE.Vector3(0,0,0);
        this.camera.lookAt(this.cameraLookAt);
        this.cameraStartDate = Date.now();
    }

    reset () {
        this.player.car.setAtStartingPosition(this.startingPos.nosePoint, 
                                              this.startingPos.directionVector);
        
        this.started = false;
        this.nextcp = 0;

        this.leaderboard.resetTime();
        this.particlesManager.reset();
        this.controls.resetActions();

        this.justReset = true;
    }

    onPlay () {
        let actions = this.controls.actions;

        // on action Reset
        if (actions.reset) {
            this.reset();
        } else if (this.justReset) {
            // win 1 frame to avoid starting timer too soon after reset.
            this.justReset = !(actions.acceleration || actions.braking);
        }

        // Show speed
        let speed = this.player.car.vehiclePhysics.getCurrentSpeedKmHour();
        let speedtext = "0 km/h";
        if (speed > 1) {
            speedtext = Math.floor(speed) + " km/h";
        } else if (speed < -1) {
            speedtext = "(r) " + Math.floor(-speed) + " km/h";
        }
        this.speedHtml.innerHTML = speedtext;

        // Car controls: Update engine force
        let breakingForce = this.DEFAULT_DRAG;
        let engineForce = 0;
        let wheelOffside = 0;
        let nextcpcrossed = false;
        for (var i = 0; i < this.player.car.WHEELSNUMBER; i++) {
            // Check Ground under each wheel
            // must use raycaster from threejs because ammojs doesn't work
            let raycaster = new THREE.Raycaster(this.player.car.wheelMeshes[i].position, 
                                                this.DOWN_VECTOR, 0, 5);
            let intercir = raycaster.intersectObject(this.circuit.mesh);
            if (intercir.length == 0) {
                breakingForce = this.GRASS_DRAG;
                wheelOffside += 1;

                // Particles
                this.particlesManager.add(this.player.car.createParticleMarkGrass(i, speed));
            }

            if (actions.acceleration) {
                if (speed < -1) {
                    breakingForce = this.MAX_BREAKING_FORCE;
                } else if (speed < this.MAX_SPEED) {
                    engineForce = this.MAX_ENGINE_FORCE;
                } else {
                    engineForce = 0;
                }
            }
    
            if (actions.braking) {
                if (speed > 1) {
                    breakingForce = this.MAX_BREAKING_FORCE;
                } else if (speed > this.MAX_REVERSE_SPEED) {
                    engineForce = -this.MAX_ENGINE_FORCE;
                } else {
                    engineForce = 0;
                }
            }

            if (i == this.player.car.BACKLEFT || i == this.player.car.BACKRIGHT) {
                this.player.car.vehiclePhysics.applyEngineForce(engineForce, i);
                this.player.car.vehiclePhysics.setBrake(breakingForce, i);
            } else {
                this.player.car.vehiclePhysics.setBrake(breakingForce/3, i);
            }

            // verify next checkpoint crossed (with any wheel)
            let intercp = raycaster.intersectObject(this.checkpoints[this.nextcp]);
            if (!nextcpcrossed) {
                nextcpcrossed = intercp.length > 0 && !this.justReset;
            }
        }

        // Car controls: Update steering force
        if (actions.left) {
            if (this.vehicleSteering < this.STEERING_CLAMP)
                this.vehicleSteering += this.STEERING_INCREMENT;
        }
        else {
            if (actions.right) {
                if (this.vehicleSteering > -this.STEERING_CLAMP)
                    this.vehicleSteering -= this.STEERING_INCREMENT;
            }
            else {
                this.vehicleSteering = 0;
            }
        }
        this.player.car.vehiclePhysics.setSteeringValue(this.vehicleSteering, this.player.car.FRONTLEFT);
        this.player.car.vehiclePhysics.setSteeringValue(this.vehicleSteering, this.player.car.FRONTRIGHT);

        // Update time when crossing checkpoint
        if (nextcpcrossed) {
            if (!this.started) {
                this.leaderboard.clock.start();
                this.started = true;
            } else {
                const sector = this.nextcp == 0 ? 2 : this.nextcp-1;
                this.leaderboard.sectorEnd(sector)
            }

            this.nextcp += 1;
            if (this.nextcp >= 3) this.nextcp = 0;
        }

        // Outside of track: change color & disqualify!
        if (this.started && wheelOffside == this.player.car.WHEELSNUMBER) {
            const oppositeColor = new THREE.Color(0xffffff).sub(this.player.car.currentColor);
            this.player.car.chassisMesh.material.color.copy(oppositeColor);
            this.leaderboard.disqualify();
        } else {
            this.player.car.chassisMesh.material.color.copy(this.player.car.currentColor);
        }
        
        // Update car position
        this.player.car.updatePosition(speed, false);
        
        // Update camera Position (and lerp factor after 1st movement)
        if (this.cameraLerp == this.LERP_SLOW && (actions.acceleration || actions.braking)) {
            this.cameraLerp = this.LERP_FAST;
        }
        if (this.cameraLerp != this.LERP_SLOW || Date.now() - this.cameraStartDate >= 1000) {
            let t = new THREE.Vector3();
            this.player.car.cameraPosition.getWorldPosition(t);
            this.camera.position.lerp(t, this.cameraLerp);
            this.cameraLookAt.lerp(this.player.car.chassisMesh.position, this.cameraLerp);
            
            this.camera.up.lerp(this.UP_Z, this.LERP_FAST);
            this.camera.lookAt(this.cameraLookAt);
        }
    }

    addOtherDriver (driver) {
        this.otherDrivers.set(driver.id, driver);
        this.leaderboard.addDriver(driver);
    }

    delOtherDriver (driverid) {
        const del = this.otherDrivers.get(driverid);
        if (this.otherDrivers.delete(driverid)) del.car.makeUnvisible();
        this.leaderboard.delDriver(driverid);
    }

    initPodiumScene () {

    }

    onPodiumScene () {

    }

    clearPodiumScene () {

    }

}