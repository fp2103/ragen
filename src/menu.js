
class Menu {
    constructor (gameplay, circuitFactory, player, client) {
        this.gameplay = gameplay;
        this.circuitFactory = circuitFactory;
        this.player = player;
        this.client = client;

        this.TRACKID_SIZE = 6;
        this.SESSION_SIZE = 4;

        this.htmlSeed = document.getElementById("seed");
        this.htmlMenuSeed = document.getElementById("menu_seed");
        this.htmlSessionId = document.getElementsByName("session_id")[0];
        
        // Link with action
        document.getElementById("menu_button").addEventListener("click", this.onMenuButton.bind(this), false);

        document.getElementById("name").addEventListener("change", this.updatePlayerName.bind(this), false);
        document.getElementById("color").addEventListener("change", this.updateCarColor.bind(this), false);

        document.getElementById("menu_go").addEventListener("click", this.onGoMenu.bind(this), false);
        document.getElementById("go").addEventListener("click", this.onGoScoreboard.bind(this), false);

        document.getElementById("menu_random").addEventListener("click", this.onRandomMenu.bind(this), false);
        document.getElementById("random").addEventListener("click", this.onRandomScoreboard.bind(this), false);

        document.getElementById("session_random").addEventListener("click", this.onSessionRandomMenu.bind(this), false);
        document.getElementById("session_go").addEventListener("click", this.onSessionGoMenu.bind(this), false);

        document.getElementById("session_share").addEventListener("click", this.onSessionShare.bind(this), false);
    }

    _generateRandomSeed (size) {
        const ascii = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let seed = "";
        for (var i = 0; i < size; i++) {
            let j = Math.floor(Math.random() * (ascii.length));
            seed += ascii.charAt(j);
        }
        return seed; 
    }
    
    updatePlayerName () {
        this.player.name = document.getElementById("name").value;
        this.client.mainDriverUpdate();
    }

    updateCarColor () {
        this.player.car.updateColor(document.getElementById("color").value);
        this.client.mainDriverUpdate();
    }

    showMenu () {
        // refresh session list
        fetch('http://localhost:3000/sessions_list')
        .then((res) => { return res.text(); })
        .then((data) => { document.getElementById("session_id").innerHTML = data; })
        .catch((err) => { console.log("error getting sessions_list", err); });

        document.getElementById("menu").style.display = "block";
        this.client.onMenu = true;
    }

    onMenuButton () {
        this.showMenu();
        this.gameplay.setState("menu");
    }

    hideMenu () {
        document.getElementById("menu").style.display = "none";
        this.client.onMenu = false;
    }

    onGoMenu () {
        this.client.disconnect();
        this.quickButtonsEnable();

        this.loadTrack(this.htmlMenuSeed.value, "solo");
        this.hideMenu();
    }

    onRandomMenu () {
        this.client.disconnect();
        this.quickButtonsEnable();

        this.loadTrack(this._generateRandomSeed(this.TRACKID_SIZE), "menu");
    }

    onGoScoreboard () {
        this.loadTrack(this.htmlSeed.value, "solo");
    }

    onRandomScoreboard () {
        this.loadTrack(this._generateRandomSeed(this.TRACKID_SIZE), "solo");
    }

    loadTrack (trackid, mode) {
        this.circuitFactory.createCircuit(trackid).then(v => {
            this.htmlSeed.value = trackid;
            this.htmlMenuSeed.value = trackid;
            this.gameplay.setState(mode, v);
        });
    }

    // --- Multi buttons ---

    quickButtonsDisable () {
        this.htmlSeed.disabled = true;
        document.getElementById("random").disabled = true;
        document.getElementById("go").disabled = true;
    }

    quickButtonsEnable () {
        this.htmlSeed.disabled = false;
        document.getElementById("random").disabled = false;
        document.getElementById("go").disabled = false;
    }

    onSessionRandomMenu () {
        this.htmlSessionId.value = this._generateRandomSeed(this.SESSION_SIZE);
    }

    onSessionGoMenu () {
        const session_id = this.htmlSessionId.value;
        if (!session_id) return;

        this.quickButtonsDisable();
        this.hideMenu();

        // Already connected to this session
        if (this.client.isConnected()
            && this.client.sessionid == session_id.toUpperCase()) {
            if (this.client.podiumScene) {
                this.gameplay.setState("podium");
            } else if (this.client.spectator) {
                this.gameplay.setState("spectator");
            } else {
                this.gameplay.setState("multi");
            }
            return;
        }

        this.client.disconnect();
        this.gameplay.circuit = undefined;
        this.client.connect(session_id);
    }

    onSessionShare () {
        if (this.htmlSessionId.value) {
            const linkta = document.createElement('textarea');
            linkta.value = "localhost:3000?sessionid=" + this.htmlSessionId.value.toUpperCase();

            linkta.setAttribute('readonly', '');
            linkta.style.position = 'absolute';
            linkta.style.left = '-9999px';
            document.body.appendChild(linkta);
            
            linkta.select();
            linkta.setSelectionRange(0,9999);

            document.execCommand("copy");
            document.body.removeChild(linkta);
        }
    }

}