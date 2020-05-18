
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
        this.resetActions();

        window.addEventListener('keydown', this.keydown.bind(this));
        window.addEventListener('keyup', this.keyup.bind(this));
        window.addEventListener('blur', this.resetActions.bind(this));

        document.getElementById('reset').addEventListener('click', () => { this.actions['reset'] = true; }, false);

        // Touch controls
        this.tapOrigin = {x: -1, y: -1};
        this.MOVE_MIN = 25;
        document.getElementById("toucharea").addEventListener("touchstart", this.tapstart.bind(this), false);
        document.getElementById("toucharea").addEventListener("touchmove", this.tapmove.bind(this), false);
        document.getElementById("toucharea").addEventListener("touchend", this.tapend.bind(this), false);
        document.getElementById("toucharea").addEventListener("touchcancel", this.tapend.bind(this), false);
    }

    resetActions () {
        this.actions['acceleration'] = false;
        this.actions['braking'] = false;
        this.actions['left'] = false;
        this.actions['right'] = false;
        this.actions['reset'] = false;
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

    tapstart (e) {
        if(e.touches) {
            this.tapOrigin.x = e.touches[0].pageX;
            this.tapOrigin.y = e.touches[0].pageY;
            e.preventDefault();
        }
    }

    tapmove (e) {
        if(e.touches) {
            if (e.touches[0].pageX > this.tapOrigin.x + this.MOVE_MIN) {
                this.actions['right'] = true;
            } else {
                this.actions['right'] = false;
            }

            if (e.touches[0].pageX < this.tapOrigin.x - this.MOVE_MIN) {
                this.actions['left'] = true;
            } else {
                this.actions['left'] = false;
            }

            if (e.touches[0].pageY < this.tapOrigin.y - this.MOVE_MIN) {
                this.actions['acceleration'] = true;
            } else {
                this.actions['acceleration'] = false;
            }

            if (e.touches[0].pageY > this.tapOrigin.y + this.MOVE_MIN) {
                this.actions['braking'] = true;
            } else {
                this.actions['braking'] = false;
            }

            e.preventDefault();
        }
    }

    tapend () {
        this.resetActions();
    }
}