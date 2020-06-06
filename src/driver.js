
class Driver {

    constructor (id, name, car) {
        this.id = id;
        this.name = name;
        this.car = car;
        
        this.bestLapTime = undefined;
        this.bestTime = [undefined, undefined, undefined];
        this.currTime = [undefined, undefined, undefined];
        this.lapCount = 0;
        this.currLapCount = 0;

        this.client_CB = undefined;
    }

    resetTime () {
        this.bestLapTime = undefined;
        this.bestTime = [undefined, undefined, undefined];
        this.currTime = [undefined, undefined, undefined];
        this.lapCount = 0;
        this.currLapCount = 0;
    }

    updateCurrTime (sector, time) {
        let better = this.bestTime[sector] == undefined || time <= this.bestTime[sector].time;
        this.currTime[sector] = new TimeColor(time, better ? "green" : undefined);
        return this.currTime[sector];
    }

    updateBestTime (time) {
        this.lapCount += 1;
        if (this.bestLapTime == undefined || time < this.bestLapTime) {
            this.bestLapTime = time;
            for (var i = 0; i < 3; i++) {
                this.bestTime[i] = this.currTime[i];
            }
            return true;
        } else {
            for (var i = 0; i < 3; i++) {
                this.currTime[i] = this.bestTime[i];
            }
            return false;
        }
    }

    cancelCurrTime () {
        let same = true;
        for (var i = 0; i < 3; i++) {
            same = same && (this.currTime[i] == this.bestTime[i]);
            this.currTime[i] = this.bestTime[i];
        }
        if (!same) this.client_CB();
    }

}
