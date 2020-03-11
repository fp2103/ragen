
class TimeColor {
    constructor (time, color) {
        this.time = time;
        this.color = color;
    }
}

class Row {
    constructor (table) {
        const row = table.insertRow(-1);
        
        this.clabel = row.insertCell(-1);
        this.clabel.colSpan = 2;

        this.csectors = [];
        for (var i = 0; i < 3; i++) {
            let c = row.insertCell(-1);
            c.innerHTML = "-";
            this.csectors.push(c);
        } 
    }

    reset () {
        this.clabel.innerHTML = "";
        this.clabel.style.color = "black";
        for (var i = 0; i < 3; i++) {
            this.csectors[i].innerHTML = "-";
            this.csectors[i].style.color = "black";
        }
    }

    setColorAllRow (color) {
        this.clabel.style.color = color;
        for (var i = 0; i < 3; i++) {
            this.csectors[i].style.color = color;
        }
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
        this.bestSectorTime = [undefined, undefined, undefined];
        this.last = undefined;

        // Rows (filled with 1 current/last row)
        this.rows = [new Row(htmltable)];

        this.nonplayable = false;
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
                this.sortDrivers();
                this.computeBestSectorTime();
                if (this.drivers.length > 1 && this.last[2].time <= this.bestSectorTime[2]) {
                    this.last.push("Session Best");
                } else {
                    this.last.push("Personal Best");
                }
            }
        }
    }

    reset () {
        this.current = [undefined, undefined, undefined];
        this.bestSectorTime = [undefined, undefined, undefined];
    }

    clearSession () {
        while (this.htmltable.rows.length > 2) {
            this.htmltable.deleteRow(-1);
        }

        this.rows = [];
        this.drivers = [];

        if(!this.nonplayable) {
            this.rows.push(new Row(this.htmltable));
            this.addDriver(this.mainDriver);
        }
    }

    addDriver (driver) {
        this.drivers.push(driver);
        this.sortDrivers();
        this.rows.push(new Row(this.htmltable));
    }

    delDriver (driverid) {
        for (var i = 0; i < this.drivers.length; i++) {
            if (this.drivers[i].id == driverid) {
                this.drivers.splice(i, 1);
            }
        }
        this.rows.pop();
        this.htmltable.deleteRow(-1);
    }

    sortDrivers () {
        this.drivers.sort((a, b) => {
            if (a.bestLapTime == undefined && b.bestLapTime == undefined) {
                return 0;
            } else if (a.bestLapTime != undefined && b.bestLapTime == undefined) {
                return -1;
            } else if (a.bestLapTime == undefined && b.bestLapTime != undefined) {
                return 1;
            }
            return a.bestLapTime - b.bestLapTime;
        });
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

    fillRow (indice, label, labelColor, sectors, purplize) {
        const row = this.rows[indice];

        row.clabel.innerHTML = label;
        if (labelColor != undefined) row.clabel.style.color = "#" + labelColor;

        for (var j = 0; j < 3; j++) {
            let c = row.csectors[j];
            if (sectors[j] != undefined) {
                c.innerHTML = this.convertTimeToString(sectors[j].time);
                if (sectors[j].color != undefined) c.style.color = sectors[j].color;

                // Change to purple for best overall time
                if (purplize && this.bestSectorTime[j] != undefined 
                    && sectors[j].color == "green" && sectors[j].time <= this.bestSectorTime[j]) {
                    c.style.color = "purple";
                }
            }
        }
    }
    
    computeBestSectorTime () {
        for (var i = 0; i < 3; i++) {
            let minSectorTime = undefined;
            for (var j = 0; j < this.drivers.length; j++) {
                if (this.drivers[j].currTime[i] != undefined) {
                    if (minSectorTime == undefined || this.drivers[j].currTime[i].time < minSectorTime) {
                        minSectorTime = this.drivers[j].currTime[i].time;
                    }
                }
            }
            this.bestSectorTime[i] = minSectorTime;
        }
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

        // reset all rows & message
        let i = 0;
        for (i = 0; i < this.rows.length; i++) {
            this.rows[i].reset();
        }
        this.htmlmessage.innerHTML = "";
        if (this.nonplayable) this.htmlmessage.innerHTML = "Session full";
        
        // fill table drivers
        this.computeBestSectorTime();
        for (i = 0; i < this.drivers.length; i++) {
            let l = (i+1) + " . ";
            if (this.drivers[i].bestLapTime == undefined) l = "- . ";
            l += this.drivers[i].name;
            if (this.drivers.length > 1 && this.drivers[i].id == 0) {
                l += " (you)";
            }
            this.fillRow(i, l, this.drivers[i].car.currentColor.getHexString(), 
                         this.drivers[i].currTime, this.drivers.length > 1);
        }

        if (this.nonplayable) return;
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
        this.fillRow(i, lastRowLabel, undefined, TCvalue, showLast && this.drivers.length > 1);
        if (!showLast && !valid) this.rows[i].setColorAllRow("red");
    }
}
