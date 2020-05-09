
function convertTimeToString (time, forceMin) {
    let min = Math.floor(time/60);
    let showMin = forceMin || min > 0;
    let sec = Math.floor(time) % 60;
    let milli = Math.round((time - Math.floor(time)) * 1000)
    if (min < 10) min = "0" + min;
    if (sec < 10) sec = "0" + sec;
    if (milli < 10) milli = "00" + milli;
    else if (milli < 100) milli = "0" + milli;

    if (showMin) return min + ":" + sec + ":" + milli;
    else return sec + ":" + milli;
}

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

    constructor (mainDriver) {
        this.mainDriver = mainDriver;
        this.htmlTable = document.getElementById("leaderboard");
        this.htmlMessage = document.getElementById("score_message");

        // Minimal scoreboard
        this.htmlPlayerMin = document.getElementById("player_min");
        this.htmlTimeMin = document.getElementById("time_min")
        
        this.drivers = [];
        this.rows = [];

        // duration of msg & last time
        this.MESSAGESHOWINGTIME = 3000;

        // Msg
        this.SESSIONBEST = "Session Best";
        this.PERSONALBEST = "Personal Best";

        // Current lap time info
        this.clock = new THREE.Clock(false);
        this.laptime = 0;
        this.validtime = true;
        this.current = [undefined, undefined, undefined];
        this.current_sector = 0;

        // Previous lap/sector info
        this.last = undefined;
        this.endSectorMsg = "";
        this.endSector_min = undefined;
        this.msgStartTime = 0;

        // Keep best times for each sector
        this.bestSectorTime = [undefined, undefined, undefined];

        // mode
        this.mode = undefined;
    }

    resetTime () {
        this.clock = new THREE.Clock(false);
        this.laptime = 0;
        this.validtime = true;
        this.current = [undefined, undefined, undefined];
        this.current_sector = 0;

        this.last = undefined;
        this.endSectorMsg = "";
        this.endSector_min = undefined;
        this.msgStartTime = 0;

        this.bestSectorTime = [undefined, undefined, undefined];

        this.mainDriver.cancelCurrTime();
    }

    sectorEnd (sector) {
        let bestMsg = "";
        let timegapMsg = "";

        if (this.validtime) {
            timegapMsg = this.computeTimeGap(sector, this.laptime);
            this.current[sector] = this.mainDriver.updateCurrTime(sector, this.laptime);
            this.endSector_min = this.current[sector];
            if (sector == 2 && this.mainDriver.updateBestTime(this.laptime)) {
                this.sortDrivers();
                bestMsg = this.PERSONALBEST;
                if (this.mode == "multi" && this.drivers[0].id == this.mainDriver.id) {
                    bestMsg = this.SESSIONBEST;
                }
            }
            this.mainDriver.client_CB();
        }
        
        if (sector < 2) {
            this.current_sector += 1;
        } else {
            if (this.validtime) this.last = [...this.current];
            this.current = [undefined, undefined, undefined];
            this.laptime = 0
            this.validtime = true;
            this.current_sector = 0;
        }

        if (bestMsg || timegapMsg || this.last != undefined || this.endSector_min != undefined) {
            if (bestMsg || timegapMsg) this.endSectorMsg = bestMsg + "<br/>" + timegapMsg;
            this.msgStartTime = Date.now();
        }
    }

    disqualify () {
        this.validtime = false;
        this.mainDriver.cancelCurrTime();
    }

    update () {
        // reset all rows & message
        let i = 0;
        for (i = 0; i < this.rows.length; i++) {
            this.rows[i].reset();
        }
        this.htmlMessage.innerHTML = "";

        // fill table drivers
        const multi = this.mode == "multi" || this.mode == "spectator";
        let mainDriverPos = "-";
        this.computeBestSectorTime();
        for (i = 0; i < this.drivers.length; i++) {
            let l = (i+1) + " . ";
            if (this.drivers[i].bestLapTime == undefined) {
                l = "- . ";
            } else if (this.drivers[i].id == 0) {
                mainDriverPos = i+1;
            }
            l += this.drivers[i].name;
            if (multi && this.drivers[i].id == 0) {
                l += " (you)";
            }
            this.fillRow(i, l, this.drivers[i].car.currentColor.getHexString(), 
                         this.drivers[i].currTime, multi);
        }

        // Reset minimal scoreboard
        this.htmlPlayerMin.innerHTML = mainDriverPos + ". " + this.mainDriver.name;
        this.htmlPlayerMin.style.color = "#" + this.mainDriver.car.currentColor.getHexString();
        this.htmlTimeMin.innerHTML = "-";
        this.htmlTimeMin.style.color = "black";

        // that's enough for spectator mode(/podium)
        if (this.mode == "spectator") {
            // Fill minimal scoreboard time with best lap time
            if (this.mainDriver.bestLapTime != undefined) {
                this.htmlTimeMin.innerHTML = convertTimeToString(this.mainDriver.bestLapTime, true);
            }
            return;
        }

        // Update current time
        this.laptime += this.clock.getDelta();
        if (this.laptime > 0) {
            if (this.current[this.current_sector] == undefined) {
                this.current[this.current_sector] = new TimeColor();
            }
            this.current[this.current_sector].time = this.laptime;
        }

        // Add last/current row && display messages
        let lastRowLabel = "Current";
        let lastRowData = this.current;
        if (Date.now() - this.msgStartTime <= this.MESSAGESHOWINGTIME) {
            if (this.last != undefined) {
                lastRowLabel = "Last";
                lastRowData = this.last;
            }
            if (this.endSectorMsg) this.htmlMessage.innerHTML = this.endSectorMsg;
        } else {
            this.last = undefined;
            this.endSectorMsg = "";
            this.endSector_min = undefined;
        }

        // fill table current/last
        this.fillRow(i, lastRowLabel, undefined, lastRowData, multi);
        if (this.last == undefined && !this.validtime) this.rows[i].setColorAllRow("red");

        // Fill minimal scoreboard time
        if (this.endSector_min != undefined) {
            this.htmlTimeMin.innerHTML = convertTimeToString(this.endSector_min.time, true);
            if (this.endSector_min.color != undefined) this.htmlTimeMin.style.color = this.endSector_min.color;
        } else {
            this.htmlTimeMin.innerHTML = convertTimeToString(this.laptime, true);
            if (!this.validtime) this.htmlTimeMin.style.color = "red";
        }
    }

    setMode (mode, drivers) {
        this.mode = mode;
        if (mode == "multi" || mode == "solo") {
            this.addDriver(this.mainDriver);
            // Add one row for current/last time
            this.rows.push(new Row(this.htmlTable));
        }
        for (let d of drivers) this.addDriver(d);
        this.sortDrivers();
    }
    
    // ---- Utils ----

    fillRow (indice, label, labelColor, sectors, purplize) {
        const row = this.rows[indice];

        row.clabel.innerHTML = label;
        if (labelColor != undefined) row.clabel.style.color = "#" + labelColor;

        for (var j = 0; j < 3; j++) {
            let c = row.csectors[j];
            if (sectors[j] != undefined) {
                c.innerHTML = convertTimeToString(sectors[j].time, true);
                if (sectors[j].color != undefined) c.style.color = sectors[j].color;

                // Change to purple for best overall time
                if (purplize && this.bestSectorTime[j] != undefined 
                    && sectors[j].color == "green" && sectors[j].time <= this.bestSectorTime[j]) {
                    c.style.color = "purple";
                }
            }
        }
    }

    // ---- Multi drivers functions ----

    addDriver (driver) {
        this.drivers.push(driver);
        this.rows.push(new Row(this.htmlTable));
    }

    delDriver (driverid) {
        for (var i = 0; i < this.drivers.length; i++) {
            if (this.drivers[i].id == driverid) {
                this.drivers.splice(i, 1);
                this.rows.pop();
                this.htmlTable.deleteRow(-1);
            }
        }
    }

    clearRows () {
        while (this.htmlTable.rows.length > 2) {
            this.htmlTable.deleteRow(-1);
        }

        this.rows = [];
        this.drivers = [];
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

    computeBestSectorTime () {
        // reset
        this.bestSectorTime = [undefined, undefined, undefined];

        // compute
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
    
    computeTimeGap (sector, time) {
        if (this.bestSectorTime[sector] == undefined) return "";

        let tg = time - this.bestSectorTime[sector];
        let result = tg > 0 ? '<span style="color: red;">+ ' : '<span style="color: aquamarine;">- ';
        result += convertTimeToString(Math.abs(tg), false);
        result += '</span>';
        return result;
    }
}
