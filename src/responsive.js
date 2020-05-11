

class Responsive {
    constructor (mainView, minimapView, leaderboard, client) {
        this.mainView = mainView;
        this.minimapView = minimapView;
        this.leaderboard = leaderboard;
        this.client = client;

        this.currentW = 0;
        this.currentH = 0;
        this.currentEm = DEFAULT_EM;

        // Html elements
        this.html = {
            stylesheet: document.styleSheets[0],
            menu_button: document.getElementById("menu_button"),
            
            scoreboard_full: document.getElementById("scoreboard"),
            scoreboard_min: document.getElementById("scoreboard_min"),
            
            hide_button: document.getElementById("hide"),
            expand_button: document.getElementById("expand"),
            expand_button_2: document.getElementById("expand2"),
            expand_button_min: document.getElementById("expand_min"),
            
            track_info: document.getElementById("track"),
            session_info: document.getElementById("session_info"),
            session_info_min: document.getElementById("session_info_min"),
        }

        this.ruleIndex = -1;

        this.html.expand_button.addEventListener("click", this.expandScoreboard.bind(this), false);
        this.html.expand_button_2.addEventListener("click", this.expandScoreboard.bind(this), false);
        this.html.expand_button_min.addEventListener("click", this.expandScoreboard.bind(this), false);
        this.html.hide_button.addEventListener("click", this.resizeScoreboard.bind(this), false);

        this.client.updateScorboardDisplay_cb = this.resizeScoreboard.bind(this);
    }

    windowResized () {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const res = w !== this.currentW || h !== this.currentH;
        this.currentW = w;
        this.currentH = h;
        return res;
    }

    emResized () {
        const emSize = this.html.menu_button.clientHeight > 0 ? this.html.menu_button.clientHeight : DEFAULT_EM;
        const res = emSize !== this.currentEm;
        this.currentEm = emSize;
        return res; 
    }

    update () {
        const wResize = this.windowResized();
        const emResize = this.emResized();

        // --- Views camera ratio ----
        if (wResize) {
            this.mainView.renderer.setSize(this.currentW, this.currentH, false);
            this.mainView.camera.aspect = this.currentW / this.currentH;
            this.mainView.camera.updateProjectionMatrix();
        }
        const minimapc = this.minimapView.canvas;
        if (this.currentW < 300 || this.currentH < 150) {
                minimapc.style.display = "none";
        } else if (minimapc.width !== minimapc.clientWidth || minimapc.height !== minimapc.clientHeight) {
                minimapc.style.display = "block";
                this.minimapView.renderer.setSize(minimapc.clientWidth, minimapc.clientHeight, false);
                this.minimapView.camera.aspect = minimapc.clientWidth / minimapc.clientHeight;
                this.minimapView.camera.updateProjectionMatrix();
        }

        // ---- Scoreboard ----
        if (emResize || wResize) {
            this.resizeScoreboard();
        }
    }

    resizeScoreboard () {
        if (this.currentW < 25*this.currentEm) {
            //console.log("Using Minimal scoreboard");

            this.html.scoreboard_full.style.display = "none";
            this.html.scoreboard_min.style.display = "block";

            this.html.session_info_min.style.display = this.client.isConnected() ? "block" : "none";
        } else {
            this.html.scoreboard_full.style.display = "block";
            this.html.scoreboard_min.style.display = "none";

            if (this.ruleIndex >= 0) {
                this.html.stylesheet.deleteRule(this.ruleIndex);
                this.ruleIndex = -1;
            }
            const newRuleIndex = this.html.stylesheet.cssRules.length;
    
            if (this.currentW > 3*25*this.currentEm) {
                //console.log("Using Full scoreboard");

                this.html.hide_button.style.display = "none";
                this.html.expand_button.style.display = "none";
                this.html.expand_button_2.style.display = "none";
                this.html.track_info.style.display = "block";
                this.html.session_info.style.display = "block";
                
                this.leaderboard.mergeCurrentAndMain = false;     
            } else if (this.currentH < 6*5*this.currentEm) {
                //console.log("Using UltraCompact scoreboard");
                
                this.html.hide_button.style.display = "none";
                this.html.track_info.style.display = "none";
                if (this.client.isConnected()) {
                    this.html.expand_button.style.display = "none";
                    this.html.session_info.style.display = "table";
                    this.html.expand_button_2.style.display = "table-cell";
                } else {
                    this.html.expand_button.style.display = "block";
                    this.html.expand_button_2.style.display = "none";
                    this.html.session_info.style.display = "none";
                }

                this.ruleIndex = this.html.stylesheet.insertRule(".compact-hide, .ultra-hide { display: none; }", newRuleIndex);

                this.leaderboard.mergeCurrentAndMain = true;           
            } else {
                //console.log("Using Compact scoreboard");
                
                this.html.hide_button.style.display = "none";
                this.html.expand_button_2.style.display = "none";
                if (this.client.isConnected()) {
                    this.html.expand_button.style.display = "block";
                    this.html.track_info.style.display = "none";
                    this.html.session_info.style.display = "block";
                } else {
                    this.html.expand_button.style.display =  "none";
                    this.html.track_info.style.display =  "block";
                    this.html.session_info.style.display = "none";
                }

                this.ruleIndex = this.html.stylesheet.insertRule(".compact-hide { display: none; }", newRuleIndex);
                
                this.leaderboard.mergeCurrentAndMain = false;
            }
        }
    }

    expandScoreboard () {
        this.html.hide_button.style.display = "block";
        this.html.expand_button.style.display = "none";
        this.html.expand_button_2.style.display = "none";

        this.html.scoreboard_full.style.display = "block";
        this.html.scoreboard_min.style.display = "none";

        this.html.track_info.style.display = "block";
        this.html.session_info.style.display = "block";

        if (this.ruleIndex >= 0) {
            this.html.stylesheet.deleteRule(this.ruleIndex);
            this.ruleIndex = -1;
        }

        this.leaderboard.mergeCurrentAndMain = false;
    }
}