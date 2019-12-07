'use strict';

// Controls
const KEYSACTIONS = {
    "KeyW":'acceleration',
    "ArrowUp":'acceleration',
    "KeyS":'braking',
    "ArrowDown":'braking',
    "KeyA":'left',
    "ArrowLeft":'left',
    "KeyD":'right',
    "ArrowRight":'right',
    "KeyP":'reset'
};
const actions = {};

function keyup(e) {
    if(KEYSACTIONS[e.code]) {
        actions[KEYSACTIONS[e.code]] = false;
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}
function keydown(e) {
    const active = document.activeElement;
    const textInput = active.tagName == "INPUT" && active.type == "text";
    if(KEYSACTIONS[e.code] && !textInput) {
        actions[KEYSACTIONS[e.code]] = true;
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}

window.addEventListener('keydown', keydown);
window.addEventListener('keyup', keyup);

// Gameplay and Menu
class Gameplay {

    constructor (conf, circuit, player, camera,
                 particlesManager, htmlelements, leaderboard) {
        this.circuit = circuit;
        this.player = player;
        this.driver = player;
        this.camera = camera;
        this.particlesManager = particlesManager;
        this.htmlelements = htmlelements;
        this.leaderboard = leaderboard;

        // Init car position
        this._circuitMargin = conf.circuit.margin;
        this.initCarPosition();

        // Init camera position
        this.camera.position.set(0, 0, 300);
        this.cameraLookAt = new THREE.Vector3(0,0,0);
        this.lerpSlow = conf.misc.lerpSlow;
        this.lerpFast = conf.misc.lerpFast;
        this.cameraLerp = this.lerpSlow;

        // driving parameter        
        this.steeringIncrement = conf.carPhysics.steeringIncrement;
        this.steeringClamp = conf.carPhysics.steeringClamp;
        this.vehicleSteering = 0;
        this.maxEngineForce = conf.carPhysics.maxEngineForce;
        this.maxBreakingForce = conf.carPhysics.maxBreakingForce;
        this.maxSpeed = conf.carPhysics.maxSpeed;
        this.maxReverseSpeed = conf.carPhysics.maxReverseSpeed;

        // Time
        this.clock = new THREE.Clock(false)
        this.laptime = 0;
        
        this.started = false;
        this.validtime = true;

        // Circuit checkpoints
        this.checkpoints = [this.circuit.slMesh,
                            this.circuit.cp1Mesh,
                            this.circuit.cp2Mesh];
        this.nextcp = 0;

        // Init leaderboard
        this.leaderboard.drivers.push(this.player);
        
        // reset
        this.justReset = false;

        // menu
        this.onMenu = true;
        this.player.makeUnvisible();
    }

    initCarPosition () {
        // compute nose position && alignement vector
        const slv = new THREE.Vector3().subVectors(...this.circuit.startingLinePoints);
        slv.multiplyScalar(-1/2);

        const slvt = new THREE.Vector3().crossVectors(new THREE.Vector3(0,0,1), slv);
        slvt.normalize();
        slvt.multiplyScalar(this._circuitMargin);
        
        const nosePoint = this.circuit.startingLinePoints[0].clone();
        nosePoint.add(slv);
        if (this.circuit.clockwise) {
            nosePoint.add(slvt);
            slvt.multiplyScalar(-1);
        }
        this.player.car.setAtStartingPosition(nosePoint, slvt);
    }

    reset () {
        this.initCarPosition();

        this.clock = new THREE.Clock(false);
        this.laptime = 0;
        
        this.started = false;
        this.validtime = true;
        this.nextcp = 0;

        // driver & leaderboard times
        this.driver.setToBest();
        this.leaderboard.reset();
        this.leaderboard.setLast(true);

        // particles
        this.particlesManager.reset()

        // actions
        actions['acceleration'] = false;
        actions['braking'] = false;
        actions['left'] = false;
        actions['right'] = false;
        actions['reset'] = false;

        this.justReset = true;
    }

    update () {

        if (this.onMenu) {
            return;
        }

        // Reset everything
        if (actions.reset) {
            this.reset();
        } else if (this.justReset) {
            // win 1 frame to avoid starting timer too soon after reset. 
            this.justReset = !(actions.acceleration || actions.braking);
        }

        // timer
        if (this.started && !this.clock.running) {
            this.clock.start();
        }
        this.laptime += this.clock.getDelta();

        // Print speed
        let speed = this.player.car.vehiclePhysics.getCurrentSpeedKmHour();
        let speedtext = "0 km/h";
        if (speed > 1) {
            speedtext = Math.floor(speed) + " km/h";
        } else if (speed < -1) {
            speedtext = "(r) " + Math.floor(-speed) + " km/h";
        }
        this.htmlelements.speed.innerHTML = speedtext;

        // Update engine force
        let breakingForce = 3;
        let engineForce = 0;
        let wheelOffside = 0;
        let nextcpcrossed = false;
        for (var i = 0; i < this.player.car.WHEELSNUMBER; i++) {
            // Check Ground under each wheel
            // must use raycaster from threejs because ammojs doesn't work
            let raycaster = new THREE.Raycaster(this.player.car.wheelMeshes[i].position, 
                                                new THREE.Vector3(0,0,-1), 0, 5);
            let intercir = raycaster.intersectObject(this.circuit.mesh);
            if (intercir.length == 0) {
                breakingForce = 60;
                wheelOffside += 1;

                // Particles
                this.particlesManager.add(this.player.car.createParticleMarkGrass(i, speed));
            }

            if (actions.acceleration) {
                if (speed < -1) {
                    breakingForce = this.maxBreakingForce;
                } else if (speed < this.maxSpeed) {
                    engineForce = this.maxEngineForce;
                } else {
                    engineForce = 0;
                }
            }
    
            if (actions.braking) {
                if (speed > 1) {
                    breakingForce = this.maxBreakingForce;
                } else if (speed > this.maxReverseSpeed) {
                    engineForce = -this.maxEngineForce;
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

        // Update steering force
        if (actions.left) {
            if (this.vehicleSteering < this.steeringClamp)
                this.vehicleSteering += this.steeringIncrement;
        }
        else {
            if (actions.right) {
                if (this.vehicleSteering > -this.steeringClamp)
                    this.vehicleSteering -= this.steeringIncrement;
            }
            else {
                this.vehicleSteering = 0;
            }
        }
        this.player.car.vehiclePhysics.setSteeringValue(this.vehicleSteering, this.player.car.FRONTLEFT);
        this.player.car.vehiclePhysics.setSteeringValue(this.vehicleSteering, this.player.car.FRONTRIGHT);

        // Update leaderboard
        this.leaderboard.updateDisplay(this._get_sector_id(), this.laptime, this.validtime);

        // Apply the rules
        if (nextcpcrossed) {
            // update driver's time
            if (this.started && this.validtime) {
                this.driver.endSector(this._get_sector_id(), this.laptime);
            }

            // startline
            if (this.nextcp == 0) {
                if (!this.started) {
                    this.started = true;
                } else {
                    this.laptime = 0;
                    this.validtime = true;
                    this.leaderboard.reset();
                }
            }

            this.nextcp += 1;
            if (this.nextcp >= 3) this.nextcp = 0;
        }

        if (this.started && wheelOffside == this.player.car.WHEELSNUMBER) {
            const ic = new THREE.Color(0xffffff).sub(this.player.car.currentColor);
            this.player.car.chassisMesh.material.color.copy(ic);
            this.validtime = false;
            this.driver.setToBest();
        } else {
            this.player.car.chassisMesh.material.color.copy(this.player.car.currentColor);
        }
        
        // Update car position
        this.player.car.updatePosition(speed, false);
        
        // Update camera Position (and lerp factor after 1st movement)
        if (this.cameraLerp == this.lerpSlow && (actions.acceleration || actions.braking)) {
            this.cameraLerp = this.lerpFast;
        }
        let t = new THREE.Vector3();
        this.player.car.cameraPosition.getWorldPosition(t);
        this.camera.position.lerp(t, this.cameraLerp);
        this.cameraLookAt.lerp(this.player.car.chassisMesh.position, this.cameraLerp);
        
        this.camera.up.lerp(new THREE.Vector3(0,0,1), this.lerpFast);
        this.camera.lookAt(this.cameraLookAt);

        // Update particles
        this.particlesManager.update();
    }

    _get_sector_id () {
        let sector_id = this.nextcp - 1;
        if (sector_id < 0) sector_id = 2;
        return sector_id;
    }

    displayMenu () {
        this.reset();

        this.camera.position.set(0, 0, 300);
        this.cameraLookAt = new THREE.Vector3(0,0,0);
        this.camera.up = new THREE.Vector3(0,1,0);
        this.camera.lookAt(this.cameraLookAt);
        this.cameraLerp = this.lerpSlow;

        this.onMenu = true;
        this.player.makeUnvisible();
    }

    hideMenu () {
        this.onMenu = false;
        this.player.makeVisible();
    }

    setCameraLerpFast () {
        this.cameraLerp = this.lerpFast;
    }

    reloadCircuit (newCircuit) {
        this.circuit = newCircuit;
        this.checkpoints = [this.circuit.slMesh,
                            this.circuit.cp1Mesh,
                            this.circuit.cp2Mesh];
        this.driver.resetTime();
        this.reset();
    }

}