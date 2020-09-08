
// Gameplay and Menu
class Gameplay {

    constructor (player, controls, camera, particlesManager, podiumScene, ghost) {
        this.player = player;
        this.controls = controls;
        this.camera = camera;
        this.particlesManager = particlesManager;
        this.podiumScene = podiumScene;
        this.ghost = ghost;

        this.leaderboard = new Leaderboard(player);
        this.otherDrivers = new Map();

        this.htmlElements = {
            speed: document.getElementById("speed"),
            gameElements: document.getElementById("game_elements"),
            redAlert: document.getElementById("redalert"),
            minimap: document.getElementById("minimapc"),
            centeredMsg: document.getElementById("centered_msg"),
            resetButton: document.getElementById("reset")
        }
        this.SESSIONFULL = "Session is Full";
        this.CROSSSTARTLINE = "Cross the Start Line"

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
        this.GRASS_MAX_SPEED = 100;
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
        this.getSessionState_cb = undefined; 
    }

    /*
     * reset & update what's need to be updated
     * init new state
     */
    setState (newState, newCircuit, newOtherDrivers) {
        // Reset
        this.htmlElements.centeredMsg.textContent = "";
        this.htmlElements.redAlert.style.display = "none";
        this.particlesManager.reset();
        this.podiumScene.destroyScene();
        this.resetCamera();
         
        // Update circuit
        if (newCircuit != undefined) {
            // Reset best laptime
            if (this.circuit == undefined || newCircuit.id != this.circuit.id) {
                this.player.resetTime();
                this.ghost.clear();
            }

            this.circuit = newCircuit;
            this.checkpoints = [this.circuit.slMesh,
                                this.circuit.cp1Mesh,
                                this.circuit.cp2Mesh];
            this.startingPos = this.circuit.getStartingPosition(newState == "solo");
        }
        if (this.circuit == undefined) return;

        // Reset player gameplay
        this.reset();

        // Update other drivers
        if (newOtherDrivers != undefined) {
            this.otherDrivers.forEach((v) => {v.car.makeUnvisible()});
            this.otherDrivers.clear();
            newOtherDrivers.forEach(d => this.otherDrivers.set(d.id, d));
        }

        // Ghost
        if (newState != "solo") {
            this.ghost.hide();
        } else {
            this.ghost.show();
        }

        // Update state
        const sessionStatus = this.getSessionState_cb();
        switch(newState) {
            case "spectator":
                this.htmlElements.gameElements.style.display = "block";    
                this.htmlElements.speed.style.display = "none";
                this.htmlElements.minimap.style.display = "block";
                this.htmlElements.resetButton.style.display = "none";
                this.htmlElements.centeredMsg.textContent = this.SESSIONFULL;
                this.leaderboard.setMode("spectator", this.otherDrivers.values());
                this.player.car.makeUnvisible();
                this.otherDrivers.forEach((v) => {v.car.makeVisible()});
                break;
            case "menu":
                this.htmlElements.gameElements.style.display = "none";
                this.player.car.makeUnvisible();
                if (sessionStatus.connected && !sessionStatus.podium) {
                    this.otherDrivers.forEach((v) => {v.car.makeVisible()});
                } else {
                    this.otherDrivers.forEach((v) => {v.car.makeUnvisible()});
                }
                break;
            case "solo":
                this.otherDrivers.forEach((v) => {v.car.makeUnvisible()});
                this.otherDrivers.clear();
            case "multi":
                this.htmlElements.gameElements.style.display = "block";    
                this.htmlElements.speed.style.display = "block";
                this.htmlElements.minimap.style.display = "block";
                this.htmlElements.resetButton.style.display = "block";
                this.leaderboard.setMode(newState, this.otherDrivers.values());
                this.player.car.makeVisible();
                this.otherDrivers.forEach((v) => {v.car.makeVisible()});
                break;
            case "podium":
                this.htmlElements.gameElements.style.display = "block";    
                this.htmlElements.speed.style.display = "none";
                this.htmlElements.minimap.style.display = "none";
                this.htmlElements.resetButton.style.display = "none";
                this.initPodiumScene(sessionStatus);
                break;
        }
        this.state = newState;
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
                this.podiumScene.update();
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
                                              this.startingPos.directionVector,
                                              this.startingPos.sec3);
        
        this.started = false;
        this.nextcp = 0;

        this.ghost.reset();
        this.leaderboard.resetTime();
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
        this.htmlElements.speed.textContent = speedtext;

        // Car controls: Update engine force
        let wheelOffside = 0;
        let nextcpcrossed = false;
        for (var i = 0; i < this.player.car.WHEELSNUMBER; i++) {
            let breakingForce = this.DEFAULT_DRAG;
            let engineForce = 0;
            let maxspeed = this.MAX_SPEED;
            
            // Check Ground under each wheel
            // use raycaster from threejs because i didn't find with ammojs
            let raycaster = new THREE.Raycaster(this.player.car.wheelMeshes[i].position, 
                                                this.DOWN_VECTOR, 0, 5);
            let intercir = raycaster.intersectObject(this.circuit.mesh);
            if (intercir.length == 0) {
                breakingForce = this.GRASS_DRAG;
                maxspeed = this.GRASS_MAX_SPEED;
                wheelOffside += 1;

                // Particles
                this.particlesManager.add(this.player.car.createParticleMarkGrass(i, speed));
            }

            if (actions.acceleration) {
                if (speed < -1) {
                    breakingForce = this.MAX_BREAKING_FORCE;
                } else if (speed < maxspeed) {
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
            if (!nextcpcrossed) {
                let intercp = raycaster.intersectObject(this.checkpoints[this.nextcp]);
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
                this.htmlElements.centeredMsg.textContent = "";
            } else {
                const sector = this.nextcp == 0 ? 2 : this.nextcp-1;
                const personalBest = this.leaderboard.sectorEnd(sector)
                if (sector == 2) {
                    this.next_sp = 1;
                    this.ghost.endLap(personalBest);
                }
            }

            this.nextcp += 1;
            if (this.nextcp >= 3) this.nextcp = 0;
        }

        // Outside of track: change color & disqualify!
        if (this.started && wheelOffside == this.player.car.WHEELSNUMBER) {
            this.htmlElements.redAlert.style.display = "block";
            if(this.leaderboard.validtime) this.leaderboard.disqualify();
        } else {
            this.htmlElements.redAlert.style.display = "none";
        }

        // Ghost (for solo gameplay)
        if (this.state == "solo") this.ghost.update(this.leaderboard.laptime, this.leaderboard.validtime);
        
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

        // Cross the line line message
        if (!this.started && this.startingPos.sec3 && (actions.acceleration || actions.braking)) {
            this.htmlElements.centeredMsg.textContent = this.CROSSSTARTLINE;
        }
    }

    addOtherDriver (driver) {
        this.otherDrivers.set(driver.id, driver);
        if (this.state == "multi" || this.state == "spectator" || this.state == "menu") {
            this.leaderboard.addDriver(driver, true);
            driver.car.makeVisible();
        }
    }

    delOtherDriver (driverid) {
        const del = this.otherDrivers.get(driverid);
        if (this.otherDrivers.delete(driverid)) del.car.makeUnvisible();
        this.leaderboard.delDriver(driverid);
    }

    initPodiumScene (sessionStatus) {
        const drivers = Array.from(this.otherDrivers.values());
        if (!sessionStatus.spectator) {
            drivers.push(this.player);
        } else {
            this.htmlElements.centeredMsg.textContent = this.SESSIONFULL;
        }
        this.leaderboard.setMode("spectator", drivers);
        this.leaderboard.update();

        // Get first 3 drivers, use leaderboard list because it is sorted
        const winners = [undefined, undefined, undefined];
        for (let i = 0; i < this.leaderboard.drivers.length; i++) {
            if (i < 3 && this.leaderboard.drivers[i].bestLapTime != undefined) {
                winners[i] = this.leaderboard.drivers[i];
            } else { // hide rest of cars
                this.leaderboard.drivers[i].car.makeUnvisible();
            }
        }

        this.podiumScene.createScene(this.circuit, winners);
    }

}