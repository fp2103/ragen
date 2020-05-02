
/**
 * all functions for multiplayer
 **/

 class Client {
    constructor (gameplay, circuitFactory, carFactory, player) {
        this.gameplay = gameplay;
        this.circuitFactory = circuitFactory;
        this.carFactory = carFactory;
        this.player = player;

        this.SERVER = "http://localhost:3000";
        this.POS_REFRESH_RATE = 50;
        
        this.circuit_change_date = undefined;
        this.sessionid = undefined;
        this.socket = undefined;
        this.sendPosInter = undefined;
        window.addEventListener("beforeunload", this.disconnect.bind(this), false);
        setInterval(this.updateRT.bind(this), 1000);

        this.player.client_CB = this.mainDriverUpdate.bind(this);

        this.connect_cb = undefined;

        // State
        this.onMenu = false;
        this.spectator = false;
        this.podiumScene = false;
        this.gameplay.getSessionState_cb = this.getSessionState.bind(this);
    }

    getSessionState () {
        return {podium: this.podiumScene, spectator: this.spectator};
    }

    isConnected () {
        return this.sessionid != undefined;
    }

    connect (sessionid, connect_cb) {
        document.getElementById("centered_msg").innerHTML = `Connecting to ${sessionid.toUpperCase()}...`;

        this.socket = io.connect(this.SERVER);
        this.sessionid = sessionid.toUpperCase();

        this.socket.on("session_please", () => this.send_session_info());
        this.socket.on("load_session", (data) => this.load_session(data));
        this.socket.on("add_user", (data) => this.add_user(data));
        this.socket.on("del_user", (data) => this.del_user(data));
        this.socket.on("update_user", (data) => this.update_user(data));
        this.socket.on("update_positions", (data) => this.update_positions(data));
        this.sendPosInter = setInterval(this.send_position.bind(this), this.posRefreshRate);

        this.connect_cb = connect_cb;
    }

    get_user_data () {
        return {name: this.player.name,
                color: this.player.car.currentColor.getHexString(),
                currTime: this.player.currTime,
                blt: this.player.bestLapTime};
    }

    send_session_info () {
        this.socket.emit("join_session", {sid: this.sessionid,
                                          user: this.get_user_data()});
    }

    load_session (data) {
        this.circuitFactory.createCircuit(data.cid).then(v => {
            // Convert players data to new Driver
            const drivers = [];
            for (let pData of data.players) {
                drivers.push(this.createDriverFromData(pData));
            }

            document.getElementById("seed").value = data.cid;
            document.getElementById("menu_seed").value = data.cid;
            document.getElementById("centered_msg").innerHTML = ""
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

        document.getElementById("session_span").innerHTML = data.id;
        this.circuit_change_date = Date.now() + data.rt;
        this.updateRT();
    }

    disconnect () {
        if (this.socket == undefined) return;

        this.gameplay.otherDrivers.forEach((v) => { v.car.makeUnvisible() });
        this.gameplay.otherDrivers.clear();

        this.socket.close();
        this.circuit_change_date = undefined;
        this.sessionid = undefined;
        this.spectator = false;
        this.podiumScene = false;
        this.socket = undefined;
        clearInterval(this.sendPosInter);
        this.sendPosInter = undefined;
        document.getElementById("remaining_time").innerHTML = "&infin;";
        document.getElementById("session_span").innerHTML = "N/A";
        this.connect_cb = undefined;
    }

    updateRT () {
        if (this.circuit_change_date != undefined) { 
            let rts = Math.round((this.circuit_change_date - Date.now())/1000);
            if (rts < 0) rts = 0;
            let rtMin = Math.floor(rts/60);
            let rtSec = rts % 60;
            if (rtSec < 10) { rtSec = "0" + rtSec; }
            let innerhtml = rtMin + ":" + rtSec;
            if (rts <= 60) innerhtml = "<b>" + innerhtml + "</b>";
            document.getElementById("remaining_time").innerHTML = innerhtml;
        }
    }

    createDriverFromData (data) {
        const c = this.carFactory.createCar("#" + data.color, false);
        const d = new Driver(data.id, data.name, c);
        d.currTime = data.currTime;
        d.bestLapTime = data.blt;
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
            d.currTime = data.currTime;
            let last_blt = d.bestLapTime;
            d.bestLapTime = data.blt;
            if (last_blt != data.blt) this.gameplay.leaderboard.sortDrivers();
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
        let p = {x: this.player.car.chassisMesh.position.x,
                 y: this.player.car.chassisMesh.position.y,
                 z: this.player.car.chassisMesh.position.z};
        let q = {x: this.player.car.chassisMesh.quaternion.x,
                 y: this.player.car.chassisMesh.quaternion.y,
                 z: this.player.car.chassisMesh.quaternion.z,
                 w: this.player.car.chassisMesh.quaternion.w};
        let s = this.player.car.vehiclePhysics.getCurrentSpeedKmHour()/3.6;
        let sv = this.player.car.vehiclePhysics.getSteeringValue(0);
        this.socket.emit("update_position", {p: p, q: q, s: s, sv: sv});
    }
 }