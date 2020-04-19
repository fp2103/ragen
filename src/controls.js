
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
}