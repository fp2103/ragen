
class TouchArrows {
    constructor (container, arrow1, arrow2, steering) {
        this.active = false;
        this.epirationDate = undefined;
        this.x = -1;
        this.y = -1;
        this.hw = 0;
        this.hh = 0;
        this.steering = steering;

        this.container = container;
        this.arrow1 = arrow1;
        this.arrow2 = arrow2;
        this.down = 0;

        this.ARROW_KEEP_ALIVE = 10000;
        this.touchList = new Set();
    }

    reset () {
        this.container.style.display = "none";
        this.active = false;
        this.epirationDate = undefined;
        this.x = -1;
        this.y = -1;
        this.down = 0;
    }

    update (n) {
        if (this.epirationDate != undefined && 
            n > this.epirationDate) {
            this.reset();
        }
    }

    activate (x, y) {
        this.x = x;
        this.y = y;
        this.active = true;
        this.container.style.left = `${x}px`;
        this.container.style.top = `${y}px`;
        this.container.style.transform = `translate(-50%, -50%)`;
        this.container.style.display = "block";
    }

    touchInside (x, y, id) {
        let res = false;
        if (x > this.x - this.hw && x < this.x + this.hw
            && y > this.y - this.hh && y < this.y + this.hh) {
            res = true;

            this.touchList.add(id);
            this.epirationDate = undefined;
            if ((this.steering && x > this.x) || (!this.steering && y > this.y)) {
                if (this.down != 2) {
                    this.arrow1.style.textDecoration = "";
                    this.arrow1.style.color = "";
                    this.arrow2.style.textDecoration = "bold";
                    this.arrow2.style.color = "rgba(0, 0, 0, 0.5)";
                    this.down = 2;
                }
            } else {
                if (this.down != 1) {
                    this.arrow1.style.textDecoration = "bold";
                    this.arrow1.style.color = "rgba(0, 0, 0, 0.5)";
                    this.arrow2.style.textDecoration = "";
                    this.arrow2.style.color = "";
                    this.down = 1;
                }
            }
        }
        return res;
    }

    removeId (id) {
        if (this.touchList.delete(id)) {
            this.down = 0;
            this.arrow1.style.textDecoration = "";
            this.arrow1.style.color = "";
            this.arrow2.style.textDecoration = "";
            this.arrow2.style.color = "";

            if (this.touchList.size == 0) {
                this.epirationDate = Date.now() + this.ARROW_KEEP_ALIVE;
            }
        }
    }

    setArea (w, h) {
        this.hw = w/2;
        this.hh = h/2;
    }
}

class Controls {

    constructor () {

        this.KEYSACTIONS = {
            "KeyW":'acceleration',
            "ArrowUp":'acceleration',
            
            "KeyS":'braking',
            "ArrowDown":'braking',
            
            "KeyA":'left',
            "ArrowLeft":'left',
            
            "KeyD":'right',
            "ArrowRight":'right',
            
            "KeyP":'reset'
        };
        this.actions = {};

        window.addEventListener('keydown', this.keydown.bind(this));
        window.addEventListener('keyup', this.keyup.bind(this));
        window.addEventListener('blur', this.resetActions.bind(this));

        document.getElementById('reset').addEventListener('click', () => { this.actions['reset'] = true; }, false);

        // Touch controls
        this.firstTouch = new TouchArrows(document.getElementById("touch_accel"),
                                          document.getElementById("uarr"),
                                          document.getElementById("darr"), false);
        this.secondTouch = new TouchArrows(document.getElementById("touch_steering"),
                                           document.getElementById("larr"),
                                           document.getElementById("rarr"), true);
        this.updateArea();
        document.getElementById("toucharea").addEventListener("touchstart", this.tapstart.bind(this), false);
        document.getElementById("toucharea").addEventListener("touchmove", this.tapmove.bind(this), false);
        document.getElementById("toucharea").addEventListener("touchend", this.tapend.bind(this), false);
        document.getElementById("toucharea").addEventListener("touchcancel", this.tapend.bind(this), false);

        this.resetActions();
    }

    resetActions () {
        this.actions['acceleration'] = false;
        this.actions['braking'] = false;
        this.actions['left'] = false;
        this.actions['right'] = false;
        this.actions['reset'] = false;

        this.firstTouch.reset();
        this.secondTouch.reset();
    }

    keyup(e) {
        if(this.KEYSACTIONS[e.code]) {
            this.actions[this.KEYSACTIONS[e.code]] = false;
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }
    
    keydown(e) {
        const active = document.activeElement;
        const textInput = active.tagName == "INPUT" && active.type == "text";
        if(this.KEYSACTIONS[e.code] && !textInput) {
            this.actions[this.KEYSACTIONS[e.code]] = true;
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }

    convertTouchToAction () {
        switch (this.firstTouch.down) {
            case 0:
                this.actions['acceleration'] = false;
                this.actions['braking'] = false;
                break;
            case 1:
                this.actions['acceleration'] = true;
                this.actions['braking'] = false;
                break;
            case 2:
                this.actions['acceleration'] = false;
                this.actions['braking'] = true;
                break;
        }

        switch (this.secondTouch.down) {
            case 0:
                this.actions['left'] = false;
                this.actions['right'] = false;
                break;
            case 1:
                this.actions['left'] = true;
                this.actions['right'] = false;
                break;
            case 2:
                this.actions['left'] = false;
                this.actions['right'] = true;
                break;
        }
    }

    tapstart (e) {
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];

            if (!this.firstTouch.active && !this.secondTouch.active) {
                this.firstTouch.activate(t.pageX, t.pageY);
            } else if (this.firstTouch.active && !this.secondTouch.active) {
                if (!this.firstTouch.touchInside(t.pageX, t.pageY, t.identifier)) {
                    this.secondTouch.activate(t.pageX, t.pageY);
                }
            } else if (!this.firstTouch.active && this.secondTouch.active) {
                if (!this.secondTouch.touchInside(t.pageX, t.pageY, t.identifier)) {
                    this.firstTouch.activate(t.pageX, t.pageY);
                }
            } else if (this.firstTouch.active && this.secondTouch.active) {
                this.firstTouch.touchInside(t.pageX, t.pageY, t.identifier);
                this.secondTouch.touchInside(t.pageX, t.pageY, t.identifier);
            }

            this.convertTouchToAction();
        }
    }

    tapmove (e) {
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];

            if (this.firstTouch.active && !this.firstTouch.touchInside(t.pageX, t.pageY, t.identifier)) {
                this.firstTouch.removeId(t.identifier);
            }
            if(this.secondTouch.active && !this.secondTouch.touchInside(t.pageX, t.pageY, t.identifier)) {
                this.secondTouch.removeId(t.identifier);
            }

            this.convertTouchToAction();
        }
    }

    tapend (e) {
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];

            this.firstTouch.removeId(t.identifier);
            this.secondTouch.removeId(t.identifier);

            this.convertTouchToAction();
        }
    }

    tapUpdate () {
        const n = Date.now();
        this.firstTouch.update(n);
        this.secondTouch.update(n);
    }

    updateArea () {
        const w = window.innerWidth;
        const h = window.innerHeight;

        if (h > w) {
            this.firstTouch.setArea(w/4, h/3);
            this.secondTouch.setArea(w/2, h/8);
        } else {
            this.firstTouch.setArea(w/8, h/2);
            this.secondTouch.setArea(w/3, h/4);
        }

    }
}