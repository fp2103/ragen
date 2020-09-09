
/**
 * all functions for multiplayer
 **/

 class Client {
    constructor (gameplay, circuitFactory, carFactory, player, podiumSceneFactory) {
        this.gameplay = gameplay;
        this.circuitFactory = circuitFactory;
        this.carFactory = carFactory;
        this.player = player;
        this.podiumSceneFactory = podiumSceneFactory;


        this.SERVER = "http://" + window.location.host;
        this.POS_REFRESH_RATE = 50;
        
        this.circuit_change_date = undefined;
        this.sessionid = undefined;
        this.userToken = undefined;
        this.socket = undefined;
        this.sendPosInter = undefined;
        this.connect_cb = undefined;
        this.reconnect_inprogress = false;
        setInterval(this.updateRT.bind(this), 1000);
        this.player.client_CB = this.mainDriverUpdate.bind(this);
        this.oldSessions = [];

        // State
        this.onMenu = false;
        this.spectator = false;
        this.podiumScene = false;
        this.gameplay.getSessionState_cb = this.getSessionState.bind(this);

        // Html
        this.htmlElements = {
            centeredMsg: document.getElementById("centered_msg"),
            seed: document.getElementById("seed"),
            menuSeed: document.getElementById("menu_seed"),
            sessionSpan: document.getElementById("session_span"),
            remainingTime: document.getElementById("remaining_time"),
            remainingTime2: document.getElementById("remaining_time_2"),
            errorMsg: document.getElementById("connexion_error")
        }
        this.updateScorboardDisplay_cb = undefined;
        window.addEventListener("beforeunload", () => {
            if (this.socket != undefined) {
                this.socket.emit("desco");
                this.socket.close();
            }
        })
    }

    getSessionState () {
        return {connected: this.isConnected, podium: this.podiumScene, spectator: this.spectator};
    }

    isConnected () {
        return this.sessionid != undefined;
    }

    connect (sessionid, connect_cb) {
        this.htmlElements.centeredMsg.textContent = `Connecting to ${sessionid.toUpperCase()}...`;

        // clear time on connection
        this.player.resetTime();

        // create a user token for this connection
        this.userToken= generateRandomSeed(10);

        this.socket = io.connect(this.SERVER, {'sync disconnect on unload': true});
        this.sessionid = sessionid.toUpperCase();

        this.socket.on("session_please", () => this.send_session_info());
        this.socket.on("load_session", (data) => this.load_session(data));
        this.socket.on("add_user", (data) => this.add_user(data));
        this.socket.on("del_user", (data) => this.del_user(data));
        this.socket.on("update_user", (data) => this.update_user(data));
        this.socket.on("update_positions", (data) => this.update_positions(data));
        this.socket.on("disconnect", (reason) => this.onDisconnect(reason));
        this.sendPosInter = setInterval(this.send_position.bind(this), this.POS_REFRESH_RATE);

        this.connect_cb = connect_cb;
    }

    get_user_data () {
        return {name: this.player.name,
                color: this.player.car.currentColor.getHexString(),
                currTime: this.player.currTime,
                blt: this.player.bestLapTime,
                lapCount: this.player.lapCount};
    }

    send_session_info () {
        this.htmlElements.errorMsg.textContent = "";
        this.socket.emit("join_session", {sid: this.sessionid, t: this.userToken,
                                          user: this.get_user_data()});
    }

    load_session (data) {

        if (!this.reconnect_inprogress || this.gameplay.circuit.id != data.cid
            || data.state == "podium" || this.spectator != data.nonplayable) {
            this.circuitFactory.createCircuit(data.cid).then(v => {
                // Convert players data to new Driver
                const drivers = [];
                for (let pData of data.players) {
                    drivers.push(this.createDriverFromData(pData));
                }

                this.htmlElements.seed.value = data.cid;
                this.htmlElements.menuSeed.value = data.cid;
                this.spectator = data.nonplayable;
                this.podiumScene = data.state == "podium";

                // Callback if defined
                if (this.connect_cb != undefined) this.connect_cb();

                if (this.onMenu) {
                    this.gameplay.setState("menu", v, drivers);
                    return;
                }

                if (this.podiumScene) {
                    this.gameplay.setState("podium", v, drivers);
                } else if (this.spectator) {
                    this.gameplay.setState("spectator", v, drivers);
                } else {
                    this.gameplay.setState("multi", v, drivers);
                }
            });
        }

        this.reconnect_inprogress = false;
        this.htmlElements.sessionSpan.textContent = data.id;
        this.circuit_change_date = Date.now() + data.rt;
        this.updateRT();
        this.updateScorboardDisplay_cb(0);
    }

    disconnect () {
        if (this.socket == undefined) return;

        this.socket.emit("desco");
        this.oldSessions.push(this.socket);
        setTimeout(() => { 
            while (this.oldSessions.length > 0) {
                this.oldSessions.pop().close();
            }
         }, 1000);

        this.circuit_change_date = undefined;
        this.sessionid = undefined;
        this.userToken = undefined;
        this.spectator = false;
        this.podiumScene = false;
        this.socket = undefined;
        this.reconnect_inprogress = false;
        clearInterval(this.sendPosInter);
        this.sendPosInter = undefined;
        this.connect_cb = undefined;

        this.gameplay.otherDrivers.forEach((v) => { v.car.makeUnvisible() });
        this.gameplay.otherDrivers.clear();

        this.htmlElements.errorMsg.textContent = "";
        this.htmlElements.remainingTime.innerHTML = "&infin;";
        this.htmlElements.remainingTime2.innerHTML = "&infin;";
        this.htmlElements.remainingTime.classList.remove("soon");
        this.htmlElements.remainingTime2.classList.remove("soon");
        this.htmlElements.sessionSpan.textContent = "N/A";
        this.updateScorboardDisplay_cb(0);
    }

    updateRT () {
        if (this.circuit_change_date != undefined) { 
            let rts = Math.round((this.circuit_change_date - Date.now())/1000);
            if (rts < 0) rts = 0;
            let rtMin = Math.floor(rts/60);
            let rtSec = rts % 60;
            if (rtSec < 10) { rtSec = "0" + rtSec; }
            let rtText = rtMin + ":" + rtSec;
            
            const rtHtml = this.htmlElements.remainingTime;
            const rtHtml2 = this.htmlElements.remainingTime2;
            if (rts < 60) {
                if (!rtHtml.classList.contains("soon")) rtHtml.classList.add("soon");
                if (!rtHtml2.classList.contains("soon")) rtHtml2.classList.add("soon");
            } else {
                rtHtml.classList.remove("soon");
                rtHtml2.classList.remove("soon");
            }
            rtHtml.textContent = rtText;
            rtHtml2.textContent = rtText;
        }
    }

    createDriverFromData (data) {
        const c = this.carFactory.createCar("#" + data.color, false);
        const d = new Driver(data.id, data.name, c);
        d.currTime = data.currTime;
        d.bestLapTime = data.blt;
        d.lapCount = data.lapCount;
        return d;
    }

    add_user (data) {
        this.gameplay.addOtherDriver(this.createDriverFromData(data));
    }

    del_user (data) {
        this.gameplay.delOtherDriver(data.id);
    }

    mainDriverUpdate () {
        if (this.socket != undefined) {
            this.socket.emit("driver_update", this.get_user_data());
        }
    }

    update_user (data) {
        const d = this.gameplay.otherDrivers.get(data.id);
        if (d != undefined) {
            d.name = data.name;
            d.car.updateColor('#' + data.color);
            this.podiumSceneFactory.updateDriver(d.id);
            
            d.currTime = data.currTime;
            this.gameplay.leaderboard.computeBestSectorTime();

            let last_blt = d.bestLapTime;
            d.bestLapTime = data.blt;

            let last_lapCount = d.lapCount;
            d.lapCount = data.lapCount;

            if (last_lapCount != data.lapCount || last_blt != data.blt) this.gameplay.leaderboard.sortDrivers(true);
        }
    }

    update_positions (data) {
        for (let p of data.table) {
            let d = this.gameplay.otherDrivers.get(p.id);
            if (d != undefined) {
                d.car.setLerpPosition(p.p, p.q, p.s, p.sv);
            }
        }
    }

    send_position() {
        this.socket.emit("update_position", this.player.car.getPositionToLerp());
    }

    onDisconnect (reason) {
        if (reason == "io client disconnect") {
            return;
        }

        this.htmlElements.errorMsg.textContent = "Connexion lost, trying to reconnect...";
        this.reconnect_inprogress = true;
        if (reason == "io server disconnect") {
            this.socket.connect();
        }
    }
 }