
/**
 * 
 * all functions for multiplayer
 * 
 * join(gameid): create/join a game
 * 
 * listen on driver creation/deletion/update
 * 
 * How to start:
 * 1. Function to join a game
 *        server return a seed
 *        access this circuit...
 *        when you click on menu
 * 2. disconnect from game
 * 
 * 3. Other player join same game: share leaderboard infos.
 * 3b. update info (name/color)
 * 3c. update time
 * 3d. Share car & car position
 * 
 * 4. session share, press papier...
 * 
 * 5. time reload circuit
 * 
 */


 class Client {
    constructor (conf, gameplay, circuitInit, htmlSessionElements, player, leaderboard) {
        this.server = conf.server;
        this.gameplay = gameplay;
        this.circuitInit = circuitInit;
        this.htmlSessionElements = htmlSessionElements;
        this.player = player;
        this.leaderboard = leaderboard;

        this.current_circuit = undefined;
        this.circuit_change_date = undefined;
        this.sessionid = undefined;
        this.socket = undefined;
        window.addEventListener("beforeunload", this.disconnect.bind(this), false);
        setInterval(this.updateRT.bind(this), 1000);

        this.otherDrivers = new Map();
        this.player.client_updateCb = this.mainDriverUpdate.bind(this);
    }

    isConnected () {
        return this.sessionid != undefined;
    }

    connect (sessionid, tobelisted) {
        this.socket = io.connect(this.server);
        this.sessionid = sessionid.toUpperCase();
        this.tobelisted = tobelisted;

        this.socket.on("session_please", () => this.send_session_info());
        this.socket.on("load_session", (data) => this.load_session(data));
        this.socket.on("add_user", (data) => this.add_user(data));
        this.socket.on("del_user", (data) => this.del_user(data));
        this.socket.on("update_user", (data) => this.update_user(data));
    }

    get_user_data () {
        return {name: this.player.name,
                color: this.player.car.currentColor.getHexString(),
                currTime: this.player.currTime};
    }

    send_session_info () {
        this.socket.emit("join_session", {sid: this.sessionid,
                                          tbl: this.tobelisted,
                                          user: this.get_user_data()});
    }

    load_session (data) {
        if (data.cid != this.current_circuit) {
            this.gameplay.reloadCircuit(this.circuitInit(data.cid));
        }
        this.current_circuit = data.cid;
        this.htmlSessionElements.session_span.innerHTML = data.id;
        this.circuit_change_date = Date.now() + data.rt;
        this.updateRT();

        // Rebuild learderboard
        this.leaderboard.clearSession();
        for (let p of data.players) {
            this.add_user(p);
        }
    }

    disconnect () {
        if (this.socket == undefined) { return; }
        this.socket.close();
        this.current_circuit = undefined;
        this.circuit_change_date = undefined;
        this.sessionid = undefined;
        this.socket = undefined;
    }

    updateRT () {
        if (this.circuit_change_date != undefined) { 
            let rts = Math.round((this.circuit_change_date - Date.now())/1000);
            let rtMin = Math.floor(rts/60);
            let rtSec = rts % 60;
            if (rtSec < 10) { rtSec = "0" + rtSec; }
            this.htmlSessionElements.remaining_time.innerHTML = rtMin + ":" + rtSec;
        }
    }
    
    add_user (data) {
        console.log("ADD", data);
        let c = new Car({cameraPosition: new THREE.Vector3(0,0,0),
                         defaultColor: "#" + data.color,
                         colorOuterMinimap: "white"});
        let d = new Driver(data.name, c, undefined, data.id);
        this.leaderboard.addDriver(d);
        this.otherDrivers.set(data.id, d);
    }

    del_user (data) {
        console.log("DEL", data);
        this.leaderboard.delDriver(data.id);
        this.otherDrivers.delete(data.id);
    }

    mainDriverUpdate () {
        if (this.socket != undefined) {
            console.log("send");
            this.socket.emit("driver_update", this.get_user_data());
        }
    }

    update_user (data) {
        let d = this.otherDrivers.get(data.id);
        console.log("received", this.otherDrivers, data.id);
        if (d != undefined) {
            d.updateName(data.name);
            d.car.updateColor('#' + data.color);
            d.currTime = data.currTime;
        }
    }
 }