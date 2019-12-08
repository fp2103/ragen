'use strict';

class TimeColor {
    constructor (time, color) {
        this.time = time;
        this.color = color;
    }
}

class Leaderboard {

    constructor (htmltable, htmlmessage, mainDriver) {
        this.htmltable = htmltable;
        this.htmlmessage = htmlmessage;
        this.mainDriver = mainDriver;
        this.mainDriver.lb_setLastCb = this.setLast.bind(this);

        this.drivers = [];
        this.current = [undefined, undefined, undefined];
        this.last = undefined;
    }

    setLast (reset, driverCurrTime, personalBest) {
        if (reset) {
            this.last = undefined;
        } else {
            this.last = [];
            for (var i = 0; i < 3; i++) {
                this.last.push(driverCurrTime[i]);
            }

            if (personalBest) {
                // TODO: different message if circuit best!!!
                this.last.push("Personal Best");
            }
        }
    }

    reset () {
        this.current = [undefined, undefined, undefined];
    }

    sortDrivers () {
        // TODO
        for (var i = 0; i < this.drivers.length; i++) {
            if (this.drivers[i].bestTime[2] != undefined) {
                this.drivers[i].position = "1";
            }
        }
    }

    convertTimeToString (time) {
        let min = Math.floor(time/60);
        let sec = Math.floor(time) % 60;
        let milli = Math.round((time - Math.floor(time)) * 1000)
        if (min < 10) min = "0" + min;
        if (sec < 10) sec = "0" + sec;
        if (milli < 10) milli = "00" + milli;
        else if (milli < 100) milli = "0" + milli;

        return min + ":" + sec + ":" + milli;
    }

    createRow (label, labelColor, sectors) {
        const row = this.htmltable.insertRow(-1);

        const c0 = row.insertCell(-1);
        c0.colSpan = 2;
        c0.innerHTML = label;
        if (labelColor != undefined) c0.style.color = labelColor;

        for (var i = 0; i < 3; i++) {
            let c = row.insertCell(-1);
            if (sectors[i] != undefined) {
                c.innerHTML = this.convertTimeToString(sectors[i].time);
                if (sectors[i].color != undefined) c.style.color = sectors[i].color; 
            } else {
                c.innerHTML = "-";
            }
        }

        return row;
    } 

    updateDisplay (current_sector, time, valid) {
        // Update current time
        if (time > 0) {
            if (this.current[current_sector] != undefined) {
                this.current[current_sector].time = time;
            } else {
                this.current[current_sector] = new TimeColor(time);
            }
        }

        // reset table
        while (this.htmltable.rows.length > 2) {
            this.htmltable.deleteRow(2);
        }
        this.htmlmessage.innerHTML = "";
        
        // Create table drivers
        this.sortDrivers();
        for (var i = 0; i < this.drivers.length; i++) {
            const l = this.drivers[i].position + " . " + this.drivers[i].name;
            this.createRow(l, this.drivers[i].car.currentColor.getHexString(), this.drivers[i].currTime);
        }

        // Add last row
        let lastRowLabel = "Current";
        let TCvalue = this.current;
        let showLast = false;
        if (time < 4 && this.last != undefined) {
            lastRowLabel = "Last";
            TCvalue = this.last;
            showLast = true;

            // show message
            if (this.last.length > 3) {
                this.htmlmessage.innerHTML = this.last[3];
            }
        } else {
            this.last = undefined;
        }

        // Create table current/last
        const r = this.createRow(lastRowLabel, undefined, TCvalue);
        if (!showLast && !valid) r.style.color = "red";
    }
}
