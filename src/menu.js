
class Menu {
    constructor (htmlelements, player, gameplay, trackidGenerator, circuitInit, currentTrackId) {
        this.htmlelements = htmlelements;
        this.player = player;
        this.gameplay = gameplay;

        // Circuit
        this.trackidGenerator = trackidGenerator;
        this.circuitInit = circuitInit;
        this.currentTrackId = currentTrackId;

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

    onGoMenu () {
        this.htmlelements.menu.style.display = "none";
        this.htmlelements.game_elements.style.display = "block";

        this.gameplay.hideMenu();
        this.trackChange(this.htmlelements.menu_seed.value);
    }

    onGoScoreboard () {
        this.gameplay.setCameraLerpFast();
        this.trackChange(this.htmlelements.seed.value);
    }

    trackChange (trackId) {
        if (trackId == this.currentTrackId) {
            this.gameplay.reset();
        } else {
            this.gameplay.reloadCircuit(this.circuitInit(trackId));
            this.currentTrackId = trackId;
        }
    }

    onRandomScoreboard () {
        this.gameplay.setCameraLerpFast();
        this.trackChange(this.trackidGenerator());
    }

    onRandomMenu () {
        this.trackChange(this.trackidGenerator());
    }

}