
class CellWrap {
    constructor () {
        this.htmlCell = undefined;
        this.text = "-";
        this.color = "black";
    }

    setContent (text, color) {
        this.setText(text);
        this.setColor(color);
    }

    setText (text) {
        const ntext = (!text) ? "-" : text;
        if (ntext != this.text) {
            if (this.htmlCell != undefined) this.htmlCell.textContent = ntext;
            this.text = ntext;
        }
    }

    setColor (color) {
        const ncolor = (!color) ? "black" : color;
        if (ncolor != this.color) {
            if (this.htmlCell != undefined) this.htmlCell.style.color = ncolor;
            this.color = ncolor;
        }
    }

    force () {
        if (this.htmlCell != undefined) {
            this.htmlCell.textContent = this.text;
            this.htmlCell.style.color = this.color;
        }
    }
}

class RowWrap {
    constructor (id, rowPromise, cls) {
        this.id = id;
        this.htmlRow = undefined;
        this.cells = [];
        for (let i = 0; i < 4; i++) {
            this.cells.push(new CellWrap());
        }
        
        rowPromise.then((v) => {
            this.htmlRow = v;
            if (cls) this.htmlRow.className = cls;
            for (let c of this.cells) {
                c.htmlCell = this.htmlRow.insertCell(-1);
                c.force();
            }
            this.cells[0].htmlCell.colSpan = 2;
        });

        this.position = 0;
    }

    setColorAllRow (color) {
        for (let c of this.cells) {
            c.setColor(color);
        }
    }

    translateAnimation (coeff) {
        const h = this.htmlRow.clientHeight;
        const t = coeff * h;

        this.htmlRow.style.transition = "transform 500ms";
        this.htmlRow.style.transform = `translateY(${t}px)`;
    }

    clearAnimation () {
        this.htmlRow.style.transition = "";
        this.htmlRow.style.transform = "";
    }
}

class TableWrap {
    constructor (htmlTable) {
        this.htmlTable = htmlTable;
        
        this.container = this.htmlTable.parentNode;
        this.animationDuration = 500;

        this.rows = [];

        // Allow only one animation at a time
        this.currentTimeout = undefined;
        this.currentTimeoutFunc = undefined;

        this.allowAnimation = true;
    }

    //  --- Utils ---

    getRowFromRealIndex (index) {
        let row = undefined;
        for (let i = 0; i < this.rows.length; i++) {
            if (this.rows[i].htmlRow != undefined && this.rows[i].htmlRow.rowIndex == index) {
                row = this.rows[i];
                break;
            }
        }
        if (!row) throw `No row found for index ${index}`;
        return row;
    }

    cancelLastTimeout () {
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeoutFunc();
        }
    }

    setTimeoutProtected (func, time) {
        this.currentTimeoutFunc = () => { 
            func();
            this.currentTimeoutFunc = undefined;
            this.currentTimeout = undefined;
        };
        this.currentTimeout = setTimeout(this.currentTimeoutFunc, time);
    }

    // --- Row management ---

    addRow (id, cls, animate) {
        const r = new RowWrap(id, new Promise((resolve) => {
            if (this.allowAnimation && animate) {
                this.cancelLastTimeout();

                let lastIndex = this.htmlTable.rows.length-1;
                if (lastIndex > 0) {
                    const lastRow = this.getRowFromRealIndex(lastIndex);
                    lastRow.translateAnimation(1);
                    this.container.style.padding = "0px 0px " + this.htmlTable.rows[0].clientHeight + "px";
                    this.container.style.transition = "padding 500ms";

                    this.setTimeoutProtected(() => {
                        lastRow.clearAnimation();
                        this.container.style.transition = "";
                        this.container.style.padding = "";
                        resolve(this.htmlTable.insertRow(lastIndex));
                    }, this.animationDuration-50);
                } else {
                    resolve(this.htmlTable.insertRow(-1));
                }
            } else {
                let lastIndex = this.htmlTable.rows.length-1;
                if (lastIndex == 0) lastIndex = -1;
                resolve(this.htmlTable.insertRow(lastIndex));
            }
        }), cls);
        this.rows.push(r);
        return r;
    }

    delRow (id, animate) {
        let toDelIndex = undefined;
        for (let i = 0;  i < this.rows.length; i++) {
            if (this.rows[i].id == id) {
                toDelIndex = i;
                break;
            }
        }

        if (toDelIndex != undefined) {
            const toDel = this.rows.splice(toDelIndex, 1)[0];
            
            if (toDel.htmlRow != undefined) {
                toDel.htmlRow.style.visibility = "hidden";
                if (this.allowAnimation && animate) {
                    this.cancelLastTimeout();

                    const movedRowList = [];
                    for (let j = toDel.htmlRow.rowIndex+1; j < this.htmlTable.rows.length; j++) {
                        const r = this.getRowFromRealIndex(j);
                        movedRowList.push(r);
                        r.translateAnimation(-1);
                    }

                    if (movedRowList.length > 0) {
                        this.container.style.maxHeight = this.container.scrollHeight + "px";
                        this.container.style.transition = "max-height 500ms";
                        cssAnimationNextFrameCbs.push(() => {
                            const newmh = this.container.scrollHeight - this.htmlTable.rows[0].clientHeight;
                            this.container.style.maxHeight = `${newmh}px`;
                        });

                        this.setTimeoutProtected(() => {
                            for (let r of movedRowList) {
                                r.clearAnimation();
                            }
                            this.container.style.transition = "";
                            this.container.style.maxHeight = "";
                            this.htmlTable.deleteRow(toDel.htmlRow.rowIndex);
                        }, this.animationDuration);
                    } else {
                        this.htmlTable.deleteRow(toDel.htmlRow.rowIndex);
                    }
                } else {
                    this.htmlTable.deleteRow(toDel.htmlRow.rowIndex);
                }
            }
        }
    }

    refreshPosition (animate) {
        const everyRowHappy = () => {
            for (let r of this.rows) {
                if (r.position > 0 && r.htmlRow != undefined && r.position != r.htmlRow.rowIndex) {
                    return false;
                }
            }
            return true;
        }

        if (this.allowAnimation && animate) {
            // animate on position change
            let change = false;
            for (let r of this.rows) {
                if (r.position > 0 && ((r.htmlRow != undefined && r.position != r.htmlRow.rowIndex)
                                    || r.htmlRow == undefined)) {
                    change = true;
                    this.cancelLastTimeout();
                    r.translateAnimation(r.position - r.htmlRow.rowIndex);
                }
            }

            // update table
            if (change) {
                this.setTimeoutProtected(() => {
                    while (!everyRowHappy()) {
                        for (let r of this.rows) {
                            if (r.position > 0 && r.htmlRow != undefined && r.position != r.htmlRow.rowIndex) {
                                const dest = this.htmlTable.rows[r.position];
                                r.htmlRow.parentNode.insertBefore(dest, r.htmlRow);
                                break;
                            }
                        }
                    }

                    for (let r of this.rows) {
                        r.clearAnimation();
                    }
                }, this.animationDuration+50);
            }
        } else {
            while (!everyRowHappy()) {
                for (let r of this.rows) {
                    if (r.position > 0 && r.htmlRow != undefined && r.position != r.htmlRow.rowIndex) {
                        const dest = this.htmlTable.rows[r.position];
                        r.htmlRow.parentNode.insertBefore(dest, r.htmlRow);
                        break;
                    }
                }
            }
        }
    }
}