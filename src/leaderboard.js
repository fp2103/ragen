
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

class Leaderboard {

    constructor (mainDriver) {
        this.mainDriver = mainDriver;
        this.table = new TableWrap(document.getElementById("leaderboard"));
        this.htmlMessage = document.getElementById("score_message");

        // Minimal scoreboard
        this.htmlPlayerMin = new CellWrap();
        this.htmlPlayerMin.associateCell(document.getElementById("player_min"));
        this.htmlTimeMin = new CellWrap();
        this.htmlTimeMin.associateCell(document.getElementById("time_min"));
        
        this.drivers = [];
        this.rows = new Map();

        // Init current/last row
        this.rows.set("current", this.table.addRow("current", undefined, false));

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
        this.msgExpirationDate = 0;

        // Keep best times for each sector
        this.bestSectorTime = [undefined, undefined, undefined];

        // mode
        this.mode = undefined;
        this.mergeCurrentAndMain = false;
    }

    // --- Player Time Management ---

    resetTime () {
        this.clock = new THREE.Clock(false);
        this.laptime = 0;
        this.validtime = true;
        this.current = [undefined, undefined, undefined];
        this.current_sector = 0;

        this.last = undefined;
        this.endSectorMsg = "";
        this.endSector_min = undefined;
        this.msgExpirationDate = 0;
        this.htmlMessage.innerHTML = "";

        this.mainDriver.cancelCurrTime();
        this.computeBestSectorTime();
    }

    sectorEnd (sector) {
        let bestMsg = "";
        let timegapMsg = "";
        let isPersonalBest = false;

        if (this.validtime) {
            timegapMsg = this.computeTimeGap(sector, this.laptime);
            this.current[sector] = this.mainDriver.updateCurrTime(sector, this.laptime);
            this.endSector_min = this.current[sector];
            if (sector == 2) {
                isPersonalBest = this.mainDriver.updateBestTime(this.laptime);
                this.sortDrivers(true);
                if (isPersonalBest) {
                    bestMsg = (this.mode == "multi" && this.drivers[0].id == this.mainDriver.id) ? 
                                this.SESSIONBEST : this.PERSONALBEST;
                }
                this.last = [...this.current];
            }
            this.mainDriver.client_CB();
            this.computeBestSectorTime();
        }
        
        if (sector < 2) {
            this.current_sector += 1;
        } else {
            this.current = [undefined, undefined, undefined];
            this.laptime = 0
            this.validtime = true;
            this.current_sector = 0;
        }

        if (bestMsg || timegapMsg || this.last != undefined || this.endSector_min != undefined) {
            if (bestMsg || timegapMsg) this.endSectorMsg = bestMsg + "<br/>" + timegapMsg;
            this.msgExpirationDate = Date.now() + this.MESSAGESHOWINGTIME;
        }
        return isPersonalBest;
    }

    disqualify () {
        this.validtime = false;
        this.mainDriver.cancelCurrTime();
        this.computeBestSectorTime();
    }

    // --- Time table ---

    update () {

        // fill table drivers
        const multi = this.mode == "multi" || this.mode == "spectator";
        let mainDriverPos = '-';
        for (let i = 0; i < this.drivers.length; i++) {
            const p = this.drivers[i].bestLapTime == undefined ? '-' : i+1;
            let l = p + " . " + this.drivers[i].name;
            if (this.drivers[i].id == this.mainDriver.id) {
                mainDriverPos = p;
                if (multi) l += " (you)";
            }

            this.fillRow(this.drivers[i].id, l, 
                         "#" + this.drivers[i].car.currentColor.getHexString(), 
                         this.drivers[i].currTime, multi,
                         this.drivers[i].lapCount);
        }

        // update minimal scoreboard
        this.htmlPlayerMin.setText(mainDriverPos + ". " + this.mainDriver.name);
        this.htmlPlayerMin.setColor("#" + this.mainDriver.car.currentColor.getHexString());
        
        // that's enough for spectator mode(/podium)
        if (this.mode == "spectator") {
            // Fill minimal scoreboard time with best lap time
            if (this.mainDriver.bestLapTime != undefined) {
                this.htmlTimeMin.setText(convertTimeToString(this.mainDriver.bestLapTime, true));
                const c = (multi && this.mainDriver.bestLapTime <= this.bestSectorTime[3]) ? "purple" : "green";
                this.htmlTimeMin.setColor(c);
            } else {
                this.htmlTimeMin.setContent();
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
        let lastRowLabelColor = undefined;
        let lastRowData = this.current;
        let lastRowLapCount = this.laptime > 0 ? this.mainDriver.lapCount + 1 : '-';
        if (Date.now() <= this.msgExpirationDate) {
            if (this.last != undefined) {
                lastRowLabel = "Last";
                lastRowData = this.last;
                lastRowLapCount = this.mainDriver.lapCount;
            }
            if (this.endSectorMsg && !this.htmlMessage.innerHTML) {
                this.htmlMessage.innerHTML = this.endSectorMsg;
            }
        } else {
            this.last = undefined;
            this.endSectorMsg = "";
            this.endSector_min = undefined;
        }
        if (this.htmlMessage.innerHTML && !this.endSectorMsg) {
            this.htmlMessage.innerHTML = "";
        }

        // Merge main driver time and current row for ultra compact scoreboard
        if (this.mergeCurrentAndMain && this.last == undefined) {
            lastRowLabel = mainDriverPos + " . " + this.mainDriver.name;
            lastRowLabelColor = "#" + this.mainDriver.car.currentColor.getHexString();
            lastRowData = [undefined, undefined, undefined];
            for (let j = 0; j < 3; j++) {
                if (this.current[j] != undefined) {
                    lastRowData[j] = this.current[j];
                    if (!this.validtime) lastRowData[j].color = "red";
                } else if (this.mainDriver.currTime[j] != undefined) {
                    lastRowData[j] = this.mainDriver.currTime[j];
                }
            }
            if (lastRowLapCount == '-' && this.mainDriver.lapCount > 0) {
                lastRowLapCount = this.mainDriver.lapCount;
            }
        }

        // fill table current/last
        this.fillRow("current", lastRowLabel, lastRowLabelColor, lastRowData, multi, lastRowLapCount);
        if (!this.mergeCurrentAndMain && this.last == undefined && !this.validtime) {
            this.rows.get("current").setColorAllRow("red");
        }

        // Fill minimal scoreboard time
        if (this.endSector_min != undefined) {
            this.htmlTimeMin.setText(convertTimeToString(this.endSector_min.time, true));
            this.htmlTimeMin.setColor(this.endSector_min.color);
        } else {
            this.htmlTimeMin.setText(convertTimeToString(this.laptime, true));
            this.htmlTimeMin.setColor((!this.validtime) ? "red" : undefined);
        }
    }

    setMode (mode, drivers) {
        this.mode = mode;

        // Clear old drivers list
        const oldRows = new Map();
        for (let [k,v] of this.rows) {
            oldRows.set(k, v);
            // Remove ghost checkbox
            for (let checkbox of v.cells[0].htmlCell.getElementsByTagName("INPUT")) {
                v.cells[0].htmlCell.style.paddingLeft = "";
                v.cells[0].htmlCell.removeChild(checkbox);
            }
        }
        this.rows.clear();
        this.rows.set("current", oldRows.get("current"));
        this.drivers = [];
        
        if (mode == "multi" || mode == "solo") {
            // Show main driver and current
            if (oldRows.has(this.mainDriver.id)) {
                this.rows.set(this.mainDriver.id, oldRows.get(this.mainDriver.id))
            }
            this.addDriver(this.mainDriver, false);
            // Add ghost checkbox for solo
            if (mode == "solo" && this.mainDriver.ghost != undefined) {
                let mainCell = this.rows.get(this.mainDriver.id).cells[0];
                mainCell.htmlCell.insertBefore(this.mainDriver.ghost.checkbox, mainCell.textSpan);
            }
            this.rows.get("current").htmlRow.style.display = "";
        } else {
            this.rows.get("current").htmlRow.style.display = "none";
        }

        for (let d of drivers) {
            if (oldRows.has(d.id)) this.rows.set(d.id, oldRows.get(d.id));
            this.addDriver(d, false);
        }

        // remove unused oldRows
        for (let k of oldRows.keys()) {
            if (!this.rows.has(k)) this.table.delRow(k, false);
        }

        this.computeBestSectorTime();
        this.sortDrivers(false);
    }
    
    // ---- Utils ----

    fillRow (id, label, labelColor, sectors, purplize, lapcount) {
        const row = this.rows.get(id);

        // label
        row.cells[0].setContent(label, labelColor);

        // lap count
        row.cells[1].setContent(lapcount, undefined);

        // sectors
        for (var j = 0; j < 3; j++) {
            const cell = row.cells[j+2];
            if (sectors[j] != undefined) {
                cell.setText(convertTimeToString(sectors[j].time, true));
                cell.setColor(sectors[j].color);

                // Change to purple for best overall time
                if (purplize && this.bestSectorTime[j] != undefined 
                    && sectors[j].color == "green" && sectors[j].time <= this.bestSectorTime[j]) {
                        cell.setColor("purple");
                }
            } else {
                cell.setContent();
            }
        }
    }

    // ---- Multi drivers functions ----

    addDriver (driver, animate) {
        this.drivers.push(driver);
        if (!this.rows.has(driver.id)) {
            const cls = driver.id == this.mainDriver.id ? "ultra-hide" : "compact-hide";
            this.rows.set(driver.id, this.table.addRow(driver.id, cls, animate));
        }
    }

    delDriver (driverid) {
        let toDelInd = undefined;
        for (var i = 0; i < this.drivers.length; i++) {
            if (this.drivers[i].id == driverid) {
                toDelInd = i;
                break;
            }
        }
        if (toDelInd != undefined) {
            this.drivers.splice(toDelInd, 1);
            this.rows.delete(driverid);
            this.table.delRow(driverid, true);
            this.computeBestSectorTime();
        }
    }

    sortDrivers (animate) {
        this.drivers.sort((a, b) => {
            if (a.lapCount == b.lapCount) {
                if (a.bestLapTime == undefined && b.bestLapTime == undefined) {
                    return 0;
                } else if (a.bestLapTime != undefined && b.bestLapTime == undefined) {
                    return -1;
                } else if (a.bestLapTime == undefined && b.bestLapTime != undefined) {
                    return 1;
                }
                return a.bestLapTime - b.bestLapTime;
            } else {
                return b.lapCount - a.lapCount;
            }
        });

        // Set rows position
        let p = 1;
        for (let d of this.drivers) {
            this.rows.get(d.id).position = p;
            p += 1;
        }
        this.table.refreshPosition(animate);
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
