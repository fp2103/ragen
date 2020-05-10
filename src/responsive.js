
// Defaults
const DEFAULT_EM = 16;

// Current Window Dimension
let lastW = 0;
let lastH = 0;
let lastEm = DEFAULT_EM;

// Html constants
const menu_button = document.getElementById("menu_button");
const scoreboard_full = document.getElementById("scoreboard");
const scoreboard_min = document.getElementById("scoreboard_min");
const hide_button = document.getElementById("hide");
const expand_button = document.getElementById("expand");
const expand_button_2 = document.getElementById("expand2");
const track_info = document.getElementById("track");
const session_info = document.getElementById("session_info");

// Stylesheet manipulation
const stylesheet = document.styleSheets[0];
const ruleIndex = stylesheet.cssRules.length;

var cb_objects = {leaderboard: undefined, client: undefined}

function responsive_update (mainView, minimapView, leaderboard, client) {
    // On dimension change
    const width = window.innerWidth;
    const height = window.innerHeight;
    const windowResized = width !== lastW || height !== lastH;
    const emSize = menu_button.clientHeight > 0 ? menu_button.clientHeight : DEFAULT_EM;
    const emChange = emSize !== lastEm;
    if (!windowResized && !emChange) {
        return;
    }
    lastW = width;
    lastH = height;
    lastEm = emSize;

    // --- Views camera ratio ----
    if (windowResized) {
        mainView.renderer.setSize(width, height, false);
        mainView.camera.aspect = width / height;
        mainView.camera.updateProjectionMatrix();
        
        const minimapc = minimapView.canvas;
        if (width < 300 || height < 150) {
            minimapView.canvas.style.display = "none";
        } else {
            minimapView.renderer.setSize(minimapc.clientWidth, minimapc.clientHeight, false);
            minimapView.camera.aspect = minimapc.clientWidth / minimapc.clientHeight;
            minimapView.camera.updateProjectionMatrix();
            minimapc.style.display = "block";
        }
    }

    // ---- Scoreboard ----
    cb_objects.leaderboard = leaderboard;
    cb_objects.client = client;
    display_scoreboard(width, height, emSize);
}

function display_scoreboard (width, height, emSize) {
    if (width < 25*emSize) {
        console.log("Using Minimal scoreboard");
        scoreboard_full.style.display = "none";
        scoreboard_min.style.display = "block";
    } else {
        scoreboard_full.style.display = "block";
        scoreboard_min.style.display = "none";
        if (ruleIndex < stylesheet.cssRules.length) stylesheet.deleteRule(ruleIndex);
    
        if (width > 3*25*emSize) {
            console.log("Using Full scoreboard");

            hide_button.style.display = "none";
            expand_button.style.display = "none";
            expand_button_2.style.display = "none";
            track_info.style.display = "block";
            session_info.style.display = "block";
            
            cb_objects.leaderboard.mergeCurrentAndMain = false;
            cb_objects.client.display = "full";
        } else if (height < 6*5*emSize) {
            console.log("Using UltraCompact scoreboard");
            
            hide_button.style.display = "none";
            track_info.style.display = "none";
            if (cb_objects.client.isConnected()) {
                expand_button.style.display = "none";
                session_info.style.display = "table";
                expand_button_2.style.display = "table-cell";
            } else {
                expand_button.style.display = "block";
                expand_button_2.style.display = "none";
                session_info.style.display = "none";
            }

            cb_objects.leaderboard.mergeCurrentAndMain = true;
            cb_objects.client.display = "ultracompact";

            stylesheet.insertRule(".compact-hide, .ultra-hide { display: none; }", ruleIndex);
        } else {
            console.log("Using Compact scoreboard");
            
            hide_button.style.display = "none";
            expand_button_2.style.display = "none";
            if (cb_objects.client.isConnected()) {
                expand_button.style.display = "block";
                track_info.style.display = "none";
                session_info.style.display = "block";
            } else {
                expand_button.style.display =  "none";
                track_info.style.display =  "block";
                session_info.style.display = "none";
            }
            
            cb_objects.leaderboard.mergeCurrentAndMain = false;
            cb_objects.client.display = "compact";

            stylesheet.insertRule(".compact-hide { display: none; }", ruleIndex);
        }
    }
}

function expand_scorboard () {
    hide_button.style.display = "block";
    expand_button.style.display = "none";
    expand_button_2.style.display = "none";

    scoreboard_full.style.display = "block";
    scoreboard_min.style.display = "none";

    track_info.style.display = "block";
    session_info.style.display = "block";

    if (ruleIndex < stylesheet.cssRules.length) stylesheet.deleteRule(ruleIndex);

    cb_objects.leaderboard.mergeCurrentAndMain = false;
}

function onhide () {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const emSize = menu_button.clientHeight > 0 ? menu_button.clientHeight : DEFAULT_EM;
    display_scoreboard(width, height, emSize);
}
 
expand_button.addEventListener("click", expand_scorboard, false);
expand_button_2.addEventListener("click", expand_scorboard, false);
document.getElementById("expand_min").addEventListener("click", expand_scorboard, false);
hide_button.addEventListener("click", onhide, false);