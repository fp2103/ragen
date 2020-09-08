
class Ghost {

    constructor (carFactory, driver) {
        this.ghost = carFactory.createGhost();
        this.ghost.LERP_SPEED = 0.10;
        this.car = driver.car;

        this.recording = [];

        this.best = [];
        this.iter = 0;
    }

    clear () {
        this.recording = [];
        this.best = [];
        this.hide();
        this.reset();
    }

    hide () {
        this.ghost.makeUnvisible();
    }

    show () {
        if (this.best.length > 0) {
            this.ghost.makeVisible();
        }
    }

    reset () {
        this.recording = [];
        this.iter = 0;
        this.ghost.lerp_speed = 1;
    }

    endLap (best) {
        if (best) {
            this.best = this.recording.slice();
            this.ghost.makeVisible();
        }
        this.reset();
    }

    update (laptime, valid) {
        // Record
        if (valid && laptime > 0) {
            let r = this.car.getPositionToLerp();
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

                    console.log(b2);

                    this.ghost.setLerpPosition(b2.p, b2.q, b2.s, b2.sv);
                    this.ghost.updateLerpPosition();

                    break;
                }
                this.iter++;
            }
        }
    }
}