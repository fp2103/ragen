
const ANIMATION_DURATION = 500;

class CellWrap {
    constructor () {
        this.htmlCell = undefined;
        this.textSpan = document.createElement("SPAN");
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
            this.textSpan.textContent = ntext;
            this.text = ntext;
        }
    }

    setColor (color) {
        const ncolor = (!color) ? "black" : color;
        if (ncolor != this.color) {
            this.textSpan.style.color = ncolor;
            this.color = ncolor;
        }
    }

    associateCell (htmlCell) {
        this.textSpan.textContent = this.text;
        this.textSpan.style.color = this.color;
        
        this.htmlCell = htmlCell;
        this.htmlCell.appendChild(this.textSpan);
    }
}

class RowWrap {
    constructor (id) {
        this.id = id;
        this.htmlRow = undefined;
        this.cells = [];
        for (let i = 0; i < 5; i++) {
            this.cells.push(new CellWrap());
        }

        this.position = 0;
    }

    setHtmlRow (htmlRow, cls) {
        this.htmlRow = htmlRow;
        if (cls) this.htmlRow.className = cls;
        for (let c of this.cells) {
            c.associateCell(this.htmlRow.insertCell(-1));
        }
        this.cells[0].htmlCell.colSpan = 2;
        this.cells[1].htmlCell.classList.add("lap-cell");
    }

    setColorAllRow (color) {
        for (let c of this.cells) {
            c.setColor(color);
        }
    }

    translateAnimation (coeff) {
        const h = this.htmlRow.clientHeight;
        const t = coeff * h;

        this.htmlRow.style.transition = `transform ${ANIMATION_DURATION}ms`;
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
        this.cancelLastTimeout();
        if (this.allowAnimation) {
            cssAnimationNextFrameCbs.unshift(() => {
                this.container.style.maxHeight = "";
            });
        }

        const r = new RowWrap(id);

        let lastIndex = this.htmlTable.rows.length-1;
        if (lastIndex == 0) lastIndex = -1;

        if (this.allowAnimation && animate) {
            let lastRow = undefined;
            if (lastIndex > 0) {
                lastRow = this.getRowFromRealIndex(lastIndex);
                lastRow.translateAnimation(1);
            }
            this.container.style.padding = "0px 0px " + this.htmlTable.rows[0].clientHeight + "px";
            this.container.style.transition = `padding ${ANIMATION_DURATION}ms`;

            this.setTimeoutProtected(() => {
                if (lastRow != undefined) lastRow.clearAnimation();
                this.container.style.transition = "";
                this.container.style.padding = "";
                r.setHtmlRow(this.htmlTable.insertRow(lastIndex), cls);
            }, ANIMATION_DURATION-50);
        } else {
            r.setHtmlRow(this.htmlTable.insertRow(lastIndex), cls);
        }
        
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
            this.cancelLastTimeout();
            const toDel = this.rows.splice(toDelIndex, 1)[0];
            if (toDel.htmlRow == undefined) {
                console.warn("Deleting a row that doesn't have a tr element");
                return;
            }
            toDel.htmlRow.style.visibility = "hidden";

            if (this.allowAnimation && animate) {
                const movedRowList = [];
                for (let j = toDel.htmlRow.rowIndex+1; j < this.htmlTable.rows.length; j++) {
                    const r = this.getRowFromRealIndex(j);
                    movedRowList.push(r);
                    r.translateAnimation(-1);
                }

                this.container.style.maxHeight = this.container.scrollHeight + "px";
                this.container.style.transition = `max-height ${ANIMATION_DURATION}ms`;
                cssAnimationNextFrameCbs.unshift(() => {
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
                }, ANIMATION_DURATION);
            } else {
                this.htmlTable.deleteRow(toDel.htmlRow.rowIndex);
            }
        }
    }

    refreshPosition (animate) {
        this.cancelLastTimeout();

        const move = () => {
            let cont = false;
            do {
                cont = false;
                for (let r of this.rows) {
                    if (r.position > 0 && r.position < r.htmlRow.rowIndex) {
                        const dest = this.htmlTable.rows[r.position];
                        r.htmlRow.parentNode.insertBefore(r.htmlRow, dest);
                        cont = true;
                        break;
                    }
                }
            } while (cont);
        }

        if (this.allowAnimation && animate) {
            for (let r of this.rows) {
                if (r.position > 0 && r.position != r.htmlRow.rowIndex) {
                    r.translateAnimation(r.position - r.htmlRow.rowIndex);
                }
            }
        
            this.setTimeoutProtected(() => {
                move();
                for (let r of this.rows) {
                    r.clearAnimation();
                }
            }, ANIMATION_DURATION+50);
        } else {
            move();
        }
    }
}