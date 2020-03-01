
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

        // Starting app
        this.htmlelements.menu.style.display = "block";
        this.htmlelements.game_elements.style.display = "none";

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
    }

    updateCarColor () {
        this.player.car.updateColor(this.htmlelements.color.value);
    }
 
    displayMenu () {
        this.gameplay.displayMenu();

        this.htmlelements.menu.style.display = "block";
        this.htmlelements.game_elements.style.display = "none";
    }

    hideMenu () {
        this.htmlelements.menu.style.display = "none";
        this.htmlelements.game_elements.style.display = "block";

        this.gameplay.hideMenu();
    }

    onGoMenu () {
        this.hideMenu();
        this.loadTrack(this.htmlelements.menu_seed.value);
    }

    onGoScoreboard () {
        this.gameplay.setCameraLerpFast();
        this.loadTrack(this.htmlelements.seed.value);
    }

    loadTrack (trackId) {
        // Local track so disconnet session
        if (this.client.isConnected()) {
            this.client.disconnect();
        }

        if (trackId == this.currentTrackId) {
            this.gameplay.reset();
        } else {
            this.gameplay.reloadCircuit(this.circuitInit(trackId));
            this.currentTrackId = trackId;
        }
    }

    onRandomScoreboard () {
        this.gameplay.setCameraLerpFast();
        this.loadTrack(this.seedGenerator(this.conf.trackidRandSize));
    }

    onRandomMenu () {
        this.loadTrack(this.seedGenerator(this.conf.trackidRandSize));
    }

    onSessionRandomMenu () {
        this.htmlelements.session_id.value = this.seedGenerator(this.conf.sessionRandSize);
    }

    onSessionGoMenu () {
        if (this.client.isConnected()
            && this.client.sessionid == this.htmlelements.session_id.value.toUpperCase()) {
            this.hideMenu();
            this.gameplay.reset();
            return;
        } else if (this.client.isConnected()) {
            this.client.disconnect();
        }

        this.hideMenu();
        this.client.connect(this.htmlelements.session_id.value, this.htmlelements.session_tobelisted.checked);
    }

}