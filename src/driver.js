
class Driver {

    constructor (name, car, vuesCb, id) {
        this.name = name;
        this.car = car;
        this.vuesCb = vuesCb;
        this.id = id;

        this.position = "-";
        this.bestTime = [undefined, undefined, undefined];
        this.currTime = [undefined, undefined, undefined];

        this.lb_setLastCb = undefined;
        this.client_updateCb = undefined;
    }

    updateName (newName) {
        this.name = newName;
    }

    resetTime () {
        this.position = "-";
        this.bestTime = [undefined, undefined, undefined];
        if (this.lb_setLastCb != undefined) this.lb_setLastCb(true);
        if (this.client_updateCb != undefined) this.client_updateCb();
    }

    setToBest () {
        for (var i = 0; i < 3; i++) {
            this.currTime[i] = this.bestTime[i];
        }
    }

    saveAsBest () {
        for (var i = 0; i < 3; i++) {
            this.bestTime[i] = this.currTime[i];
        }
    }

    getColorTime (sector, time) {
        if (this.bestTime[sector] == undefined || time < this.bestTime[sector].time) {
            return "green";
        } else {
            return undefined;
        }
    }

    endSector (sector, time) {
        this.currTime[sector] = new TimeColor(time, this.getColorTime(sector, time));

        // full lap time
        if (sector == 2) {
            // callback leaderboard to show last lap
            if (this.lb_setLastCb != undefined) {
                let pb = this.bestTime[2] == undefined || time < this.bestTime[2].time;
                this.lb_setLastCb(false, this.currTime, pb);
            }

            // Update best time
            if (this.bestTime[2] == undefined || time < this.bestTime[2].time) {
                this.saveAsBest();
            } else {
                this.setToBest();
            }
        }

        // CB on client to update session
        if (this.client_updateCb != undefined) this.client_updateCb();
    }

    makeUnvisible () {
        this.vuesCb(false, [this.car.chassisMesh, ...this.car.wheelMeshes], this.car.minimapMesh);
    }

    makeVisible () {
        this.vuesCb(true, [this.car.chassisMesh, ...this.car.wheelMeshes], this.car.minimapMesh);
    }
}
