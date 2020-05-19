
class Menu {
    constructor (gameplay, circuitFactory, player, client) {
        this.gameplay = gameplay;
        this.circuitFactory = circuitFactory;
        this.player = player;
        this.client = client;

        this.TRACKID_SIZE = 6;
        this.SESSION_SIZE = 4;

        this.html = {
            menu: document.getElementById("menu"),
            // Driver info
            name: document.getElementById("name"),
            color: document.getElementById("color"),
            // circuit info
            menuSeed: document.getElementById("menu_seed"),
            seed: document.getElementById("seed"),
            trackGo: document.getElementById("go"),
            trackRandom: document.getElementById("random"),
            // session info
            sessionIdInput: document.getElementsByName("session_id")[0],
            sessionIdList: document.getElementById("session_id"),
            // others
            closeButton: document.getElementById("close"),
            soloB: document.getElementById("solo_b"),
            soloDiv: document.getElementById("solo_div"),
            multiB: document.getElementById("multi_b"),
            multiDiv: document.getElementById("multi_div"),
            // Fullscrenn
            container: document.getElementById("container"),
            fullscreen: document.getElementById("fullscreen"),
        }
    
        // Link with action
        document.getElementById("menu_button").addEventListener("click", this.onMenuButton.bind(this), false);

        this.html.name.addEventListener("change", this.updatePlayerName.bind(this), false);
        this.html.color.addEventListener("change", this.updateCarColor.bind(this), false);

        document.getElementById("menu_go").addEventListener("click", this.onGoMenu.bind(this), false);
        this.html.trackGo.addEventListener("click", this.onGoScoreboard.bind(this), false);

        document.getElementById("menu_random").addEventListener("click", this.onRandomMenu.bind(this), false);
        this.html.trackRandom.addEventListener("click", this.onRandomScoreboard.bind(this), false);

        document.getElementById("session_random").addEventListener("click", this.onSessionRandomMenu.bind(this), false);
        document.getElementById("session_go").addEventListener("click", this.onSessionGoMenu.bind(this), false);

        document.getElementById("session_share").addEventListener("click", this.onSessionShare.bind(this), false);

        this.html.closeButton.addEventListener("click", this.onClose.bind(this), false);

        this.html.soloB.addEventListener("click", this.onSoloButton.bind(this), false);
        this.html.multiB.addEventListener("click", this.onMultiButton.bind(this), false);

        this.html.fullscreen.addEventListener("click", this.toggleFullscreen.bind(this), false);
    }
    
    updatePlayerName () {
        this.player.name = this.html.name.value;
        this.client.mainDriverUpdate();
    }

    updateCarColor () {
        this.player.car.updateColor(this.html.color.value);
        this.client.mainDriverUpdate();
    }

    showMenu () {
        // refresh session list
        fetch(`http://${window.location.host}/sessions_list`)
        .then((res) => { return res.text(); })
        .then((data) => { this.html.sessionIdList.innerHTML = data; })
        .catch((err) => { console.log("error getting sessions_list", err); });

        this.html.menu.style.display = "block";
        this.client.onMenu = true;
    }

    onMenuButton () {
        this.html.closeButton.style.display = "";
        this.showMenu();
        this.gameplay.setState("menu");
    }

    hideMenu () {
        this.html.menu.style.display = "none";
        this.client.onMenu = false;
    }

    onGoMenu () {
        this.client.disconnect();
        this.quickButtonsEnable();
        this.html.multiB.value = ">";
        this.html.multiDiv.style.display = "none";

        this.loadTrack(this.html.menuSeed.value, "solo");
        this.hideMenu();
    }

    onRandomMenu () {
        this.client.disconnect();
        this.quickButtonsEnable();
        this.html.closeButton.style.display = "none";

        this.loadTrack(generateRandomSeed(this.TRACKID_SIZE), "menu");
    }

    onGoScoreboard () {
        this.loadTrack(this.html.seed.value, "solo");
    }

    onRandomScoreboard () {
        this.loadTrack(generateRandomSeed(this.TRACKID_SIZE), "solo");
    }

    loadTrack (trackid, mode) {
        this.circuitFactory.createCircuit(trackid).then(v => {
            this.html.seed.value = trackid;
            this.html.menuSeed.value = trackid;
            this.gameplay.setState(mode, v);
        });
    }

    // --- Multi buttons ---

    quickButtonsDisable () {
        this.html.seed.disabled = true;
        this.html.trackGo.disabled = true;
        this.html.trackRandom.disabled = true;
    }

    quickButtonsEnable () {
        this.html.seed.disabled = false;
        this.html.trackGo.disabled = false;
        this.html.trackRandom.disabled = false;
    }

    onSessionRandomMenu () {
        this.html.sessionIdInput.value = generateRandomSeed(this.SESSION_SIZE);
    }

    onSessionGoMenu () {
        const session_id = this.html.sessionIdInput.value;
        if (!session_id) return;

        this.quickButtonsDisable();
        this.hideMenu();
        this.html.soloB.value = ">";
        this.html.soloDiv.style.display = "none";

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
        if (this.html.sessionIdInput.value) {
            const linkta = document.createElement('textarea');
            linkta.value = "localhost:3000?sessionid=" + this.html.sessionIdInput.value.toUpperCase();

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

    // ---- Other buttons ----

    onClose () {
        if (this.client.isConnected()) {
            // reset id field to current session
            this.html.sessionIdInput.value = this.client.sessionid;
            this.onSessionGoMenu();
        } else {
            this.onGoMenu();
        }
    }

    onSoloButton () {
        const b = this.html.soloB;
        if (b.value == ">") {
            b.value = "v";
            this.html.soloDiv.style.display = "block";
        } else {
            b.value = ">";
            this.html.soloDiv.style.display = "none";
        }
    }

    onMultiButton () {
        const b = this.html.multiB;
        if (b.value == ">") {
            b.value = "v";
            this.html.multiDiv.style.display = "block";
        } else {
            b.value = ">";
            this.html.multiDiv.style.display = "none";
        }
    }

    toggleFullscreen () {
        if (!document.fullscreenElement) {
            this.html.container.requestFullscreen().then(() => {
                this.html.fullscreen.value = "Exit Fullscreen";
            }).catch(err => {
                alert(`Can't enable fullscreen mode: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen();
            this.html.fullscreen.value = "Go on Fullscreen";
        }
    }
}