
function loadMenu () {
    
}

class Menu {
    constructor (htmlelements, conf, player, gameplay, seedGenerator, circuitInit, currentTrackId, client) {
        this.htmlelements = htmlelements;
        this.conf = conf;
        this.player = player;
        this.gameplay = gameplay;

        // Circuit
        this.seedGenerator = seedGenerator;
        this.circuitInit = circuitInit;
        this.currentTrackId = currentTrackId;

        // Client multi
        this.client = client;

        // Link with action
        this.htmlelements.menu_button.addEventListener("click", this.displayMenu.bind(this), false);

        this.htmlelements.name.addEventListener("change", this.updatePlayerName.bind(this), false);
        this.htmlelements.color.addEventListener("change", this.updateCarColor.bind(this), false);

        this.htmlelements.menu_go.addEventListener("click", this.onGoMenu.bind(this), false);
        this.htmlelements.go.addEventListener("click", this.onGoScoreboard.bind(this), false);

        this.htmlelements.menu_random.addEventListener("click", this.onRandomMenu.bind(this), false);
        this.htmlelements.random.addEventListener("click", this.onRandomScoreboard.bind(this), false);

        this.htmlelements.session_random.addEventListener("click", this.onSessionRandomMenu.bind(this), false);
        this.htmlelements.session_go.addEventListener("click", this.onSessionGoMenu.bind(this), false);
    }

    updatePlayerName () {
        this.player.updateName(this.htmlelements.name.value);
        this.client.mainDriverUpdate();
    }

    updateCarColor () {
        this.player.car.updateColor(this.htmlelements.color.value);
        this.client.mainDriverUpdate();
    }
 
    displayMenu () {
        this.gameplay.displayMenu();
        this.loadSessionsList();        
        this.htmlelements.menu.style.display = "block";
        this.htmlelements.game_elements.style.display = "none";
    }

    loadSessionsList () {
        fetch('http://localhost:3000/sessions_list')
        .then((res) => { return res.text(); })
        .then((data) => { this.htmlelements.session_id_list.innerHTML = data; })
        .catch((err) => { console.log("error getting sessions_list", err); });
    } 

    hideMenu (cbGp) {
        this.htmlelements.menu.style.display = "none";
        this.htmlelements.game_elements.style.display = "block";

        if (cbGp) this.gameplay.hideMenu();
    }

    onGoMenu () {
        this.hideMenu(true);
        this.loadTrack(this.htmlelements.menu_seed.value);
    }

    onGoScoreboard () {
        this.gameplay.resetCamera();
        this.loadTrack(this.htmlelements.seed.value);
    }

    loadTrack (trackId) {
        // Local track so disconnet session
        if (this.client.isConnected()) {
            this.client.disconnect();

            this.htmlelements.seed.disabled = false;
            this.htmlelements.random.disabled = false;
            this.htmlelements.go.disabled = false;
            this.htmlelements.session_span.innerHTML = "N/A";
            this.htmlelements.remaining_time.innerHTML = "&infin;";
        }

        if (trackId == this.currentTrackId) {
            this.gameplay.reset();
        } else {
            this.circuitInit(trackId).then(v => {
                this.gameplay.reloadCircuit(v);
            });
            this.currentTrackId = trackId;
        }
    }

    onRandomScoreboard () {
        this.gameplay.resetCamera();
        this.loadTrack(this.seedGenerator(this.conf.trackidRandSize));
    }

    onRandomMenu () {
        this.loadTrack(this.seedGenerator(this.conf.trackidRandSize));
    }

    onSessionRandomMenu () {
        this.htmlelements.session_id_input.value = this.seedGenerator(this.conf.sessionRandSize);
    }

    onSessionGoMenu () {
        if (!this.htmlelements.session_id_input.value) {
            return;
        }

        if (this.client.isConnected()
            && this.client.sessionid == this.htmlelements.session_id_input.value.toUpperCase()) {
            this.hideMenu(true);
            this.gameplay.reset();
            return;
        } else if (this.client.isConnected()) {
            this.client.disconnect();
        }

        this.hideMenu(false);
        this.htmlelements.seed.disabled = true;
        this.htmlelements.random.disabled = true;
        this.htmlelements.go.disabled = true;
        this.currentTrackId = undefined;

        this.gameplay.circuit = undefined;
        this.client.connect(this.htmlelements.session_id_input.value, 
                            this.htmlelements.session_tobelisted.checked);
    }

}