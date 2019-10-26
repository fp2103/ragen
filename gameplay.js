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
    if(KEYSACTIONS[e.code]) {
        actions[KEYSACTIONS[e.code]] = true;
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}

window.addEventListener('keydown', keydown);
window.addEventListener('keyup', keyup);

// Gameplay object

class Gameplay {

    constructor (conf, circuit, car, camera, particlesManager) {
        this.circuit = circuit;
        this.car = car;
        this.camera = camera;
        this.particlesManager = particlesManager;

        // Init car position
        this._circuitMargin = conf.circuit.margin;
        this.initCarPosition();

        // Init camera position
        this.camera.position.set(0, 0, 300);
        this.cameraLookAt = new THREE.Vector3(0,0,0);

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

        this.CHECKPOINTS = [this.circuit.slMesh,
                            this.circuit.cp1Mesh,
                            this.circuit.cp2Mesh];
        this.nextcp = 0;
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
        this.car.setAtStartingPosition(nosePoint, slvt);
    }

    update (speedhtml, sectorshtml) {

        // Reset everything
        if (actions.reset) {
            this.initCarPosition();

            this.clock = new THREE.Clock(false);
            this.laptime = 0;
            
            this.started = false;
            this.validtime = true;
            this.nextcp = 0;

            for (var i = 0; i < 3; i++) {
                sectorshtml[i].innerHTML = "-";
                sectorshtml[i].style.color = "black";
            }
        }

        if (this.started && !this.clock.running) {
            this.clock.start();
        }

        // Get & Print current laptime
        this.laptime += this.clock.getDelta();
        let min = Math.floor(this.laptime/60);
        let sec = Math.floor(this.laptime) % 60;
        let milli = Math.round((this.laptime - Math.floor(this.laptime)) * 1000)
        if (min < 10) min = "0" + min;
        if (sec < 10) sec = "0" + sec;
        if (milli < 10) milli = "00" + milli;
        else if (milli < 100) milli = "0" + milli;
        if (this.started) {
            sectorshtml[this.nextcp].innerHTML = min + ":" + sec + ":" + milli;
        }

        // Print speed
        let speed = this.car.vehiclePhysics.getCurrentSpeedKmHour();
        let speedtext = "0 km/h";
        if (speed > 1) {
            speedtext = Math.floor(speed) + " km/h";
        } else if (speed < -1) {
            speedtext = "(r) " + Math.floor(-speed) + " km/h";
        }
        speedhtml.innerHTML = speedtext;

        // Update engine force
        let breakingForce = 3;
        let engineForce = 0;
        let wheelOffside = 0;
        let nextcpcrossed = false;
        for (var i = 0; i < this.car.WHEELSNUMBER; i++) {
            // Check Ground under each wheel
            // must use raycaster from threejs because ammojs doesn't work
            let raycaster = new THREE.Raycaster(this.car.wheelMeshes[i].position, 
                                                new THREE.Vector3(0,0,-1), 0, 5);
            let intercir = raycaster.intersectObject(this.circuit.mesh);
            if (intercir.length == 0) {
                breakingForce = 60;
                wheelOffside += 1;

                // Particles
                this.particlesManager.add(this.car.createParticleMarkGrass(i, speed));
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

            if (i == this.car.BACKLEFT || i == this.car.BACKRIGHT) {
                this.car.vehiclePhysics.applyEngineForce(engineForce, i);
                this.car.vehiclePhysics.setBrake(breakingForce, i);
            } else {
                this.car.vehiclePhysics.setBrake(breakingForce/3, i);
            }

            // verify next checkpoint crossed (with any wheel)
            let intercp = raycaster.intersectObject(this.CHECKPOINTS[this.nextcp]);
            if (!nextcpcrossed) {
                nextcpcrossed = intercp.length > 0;
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
                /*if (this.vehicleSteering < -this.steeringIncrement)
                    this.vehicleSteering += this.steeringIncrement;
                else {
                    if (this.vehicleSteering > this.steeringIncrement)
                        this.vehicleSteering -= this.steeringIncrement;
                    else {
                        this.vehicleSteering = 0;
                    }
                }*/
            }
        }
        this.car.vehiclePhysics.setSteeringValue(this.vehicleSteering, this.car.FRONTLEFT);
        this.car.vehiclePhysics.setSteeringValue(this.vehicleSteering, this.car.FRONTRIGHT);


        // Apply the rules
        if (nextcpcrossed) {
            // startline
            if (this.nextcp == 0) {
                if (!this.started) {
                    this.started = true;
                } else {
                    // TODO remember valid time

                    // Reset clock
                    this.laptime = 0;
                    this.validtime = true;
                    for (var i = 0; i < 3; i++) {
                        sectorshtml[i].innerHTML = "-";
                        sectorshtml[i].style.color = "black";
                    }
                }
            }

            this.nextcp += 1;
            if (this.nextcp >= this.CHECKPOINTS.length) {
                this.nextcp = 0;
            }
        }

        if (this.started && wheelOffside == this.car.WHEELSNUMBER) {
            this.car.chassisMesh.material.color.setHex(0xff0000);
            this.validtime = false;
            
            for (var i = this.nextcp; i < 4; i++) {
                var j = i;
                if (j == 0) i = 4;
                if (j == 3) j = 0;
                sectorshtml[j].style.color = "red";
            }
        } else {
            this.car.chassisMesh.material.color.setHex(0x00fff0);
        }
        
        // Update car position
        this.car.updatePosition(speed);
        
        // Update camera Position
        let t = new THREE.Vector3();
        this.car.cameraPosition.getWorldPosition(t);
        this.camera.position.lerp(t, 0.15);
        this.cameraLookAt.lerp(this.car.chassisMesh.position, 0.15);
        
        this.camera.up = new THREE.Vector3(0,0,1);
        this.camera.lookAt(this.cameraLookAt);

        // Update particles
        this.particlesManager.update();
        
    }
}