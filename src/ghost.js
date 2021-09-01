
class Ghost {

    constructor (carFactory, carToCopy) {
        this.ghost = carFactory.createGhost();
        this.ghost.LERP_SPEED = 0.10;
        this.carToCopy = carToCopy;

        this.recording = [];

        this.best = [];
        this.iter = 0;

        // Html element to activate/deactivate this ghost
        this.activated = true;
        this.checkbox = document.createElement("INPUT");
        this.checkbox.setAttribute('type', 'checkbox');
        this.checkbox.style.position = "absolute";
        this.checkbox.style.left = "0px";
        this.checkbox.style.display = "none";
        this.checkbox.addEventListener('click', () => {
            this.activated = this.checkbox.checked;
            if (this.activated) {
                this.show();
            } else {
                this.hide();
            }
        }, false);
    }

    clear () {
        this.recording = [];
        this.best = [];
        this.hide();
        this.reset();
        
        // Hide checkbox when not ready
        this.checkbox.style.display = "none";
    }

    hide () {
        this.ghost.makeUnvisible();
    }

    show () {
        if (this.best.length > 0) {
            // Show checkbox when ready
            if (this.checkbox.style.display == "none") {
                this.checkbox.style.display = "inline-block";
                this.checkbox.checked = this.activated;
            }

            if (this.activated) this.ghost.makeVisible();
        }
    }

    reset () {
        this.recording = [];
        this.iter = 0;
        this.ghost.lerp_speed = 1;
    }

    endLap (best) {
        if (best && this.recording.length > 0) {
            this.best = this.recording.slice();
            this.show();
        }
        this.reset();
    }

    update (laptime, valid) {
        // Record
        if (valid && laptime > 0) {
            let r = this.carToCopy.getPositionToLerp();
            r.t = laptime;
            this.recording.push(r);
        }
        
        // Update ghost matrix
        if (this.best.length > 0) {

            while (this.iter < this.best.length) {
                let b = this.best[this.iter];
                if (b.t >= laptime) {
                    let niter = this.iter + 9;
                    if (niter >= this.best.length) {
                        niter = this.best.length - 1;
                    }
                    let b2 = this.best[niter];

                    this.ghost.setLerpPosition(b2.p, b2.q, b2.s, b2.sv);
                    this.ghost.updateLerpPosition();

                    break;
                }
                this.iter++;
            }
        }
    }
}