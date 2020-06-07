
class Ghost {

    constructor (carFactory, driver) {
        this.ghost = carFactory.createCar("#FFFFFF", false); //carFactory.createGhost();
        this.car = driver.car;

        this.recording = [];

        this.best = [];
        this.iter = 0;
    }

    clear () {
        this.recording = [];
        this.hide();
        this.reset();
    }

    hide () {
        this.ghost.makeUnvisible();
    }

    reset () {
        this.recording = [];
        this.iter = 0;
    }

    endLap (best) {
        if (best) {
            this.best = this.recording.slice();
            this.ghost.makeVisible();
        }
        this.reset();
    }

    update (laptime) {
        /*if (laptime - this.last_laptime >= this.FREQUENCE) {
            this.last_laptime = laptime;

            const o = this.driver.car.getPosObject();
            o.t = laptime;
            this.curr.push(o);
        }

        if (this.best.length > 0) {
            let b = this.best[this.iter-1];
            while (laptime >= b.t && this.iter < this.best.length) {
                if (laptime <= b.t + this.FREQUENCE) {
                    this.ghost.setLerpPosition(b.p, b.q, b.s, b.sv);
                    break;
                }
                this.iter++;
                b = this.best[this.iter-1];
            }

            this.ghost.updateLerpPosition();
        }*/
    }
}