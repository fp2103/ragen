
/**
 * all functions for multiplayer
 **/

 class Client {
    constructor (conf, carconf, gameplay, circuitInit, htmlSessionElements, player, leaderboard, scenes) {
        this.server = conf.server;
        this.posRefreshRate = conf.posRefreshRate; 
        this.carconf = carconf;
        this.gameplay = gameplay;
        this.circuitInit = circuitInit;
        this.htmlSessionElements = htmlSessionElements;
        this.player = player;
        this.leaderboard = leaderboard;
        this.scenes = scenes;

        this.current_circuit = undefined;
        this.circuit_change_date = undefined;
        this.sessionid = undefined;
        this.socket = undefined;
        this.sendPosInter = undefined;
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
        this.socket.on("update_positions", (data) => this.update_positions(data));
        this.sendPosInter = setInterval(this.send_position.bind(this), this.posRefreshRate);
    }

    get_user_data () {
        return {name: this.player.name,
                color: this.player.car.currentColor.getHexString(),
                currTime: this.player.currTime,
                blt: this.player.bestLapTime};
    }

    send_session_info () {
        this.socket.emit("join_session", {sid: this.sessionid,
                                          tbl: this.tobelisted,
                                          user: this.get_user_data()});
    }

    load_session (data) {
        if (data.cid != this.current_circuit) {
            this.gameplay.resetCamera();
            this.gameplay.reloadCircuit(this.circuitInit(data.cid));
        }
        this.current_circuit = data.cid;
        this.htmlSessionElements.session_span.innerHTML = data.id;
        this.circuit_change_date = Date.now() + data.rt;
        this.updateRT();

        if (data.nonplayable) {
            this.gameplay.nonplayable = true;
            this.leaderboard.nonplayable = true;
            this.player.makeUnvisible();
            this.gameplay.htmlelements.speed.style.display = "none";
        }
        // Change in playability
        if (!data.nonplayable && this.gameplay.nonplayable) {
            this.gameplay.nonplayable = false;
            this.leaderboard.nonplayable = false;
            this.player.makeVisible();
            this.gameplay.htmlelements.speed.style.display = "block";
            this.gameplay.reset();
        }

        // Rebuild other users
        this.destroyOtherUser();
        for (let p of data.players) {
            this.add_user(p);
        }
    }

    destroyOtherUser () {
        this.leaderboard.clearSession();
        this.otherDrivers.clear();
        for (let c of this.gameplay.otherCars.values()) {
            this.scenes[1].remove(c.minimapMesh);
            this.scenes[0].remove(c.chassisMesh);
            for (var i = 0; i < c.WHEELSNUMBER; i++) {
                this.scenes[0].remove(c.wheelMeshes[i]);
            }
        }
        this.gameplay.otherCars.clear();
    }

    disconnect () {
        if (this.socket == undefined) { return; }
        this.socket.close();
        this.current_circuit = undefined;
        this.circuit_change_date = undefined;
        this.sessionid = undefined;
        this.socket = undefined;
        clearInterval(this.sendPosInter);
        this.sendPosInter = undefined;

        // reset non playable
        this.gameplay.nonplayable = false;
        this.leaderboard.nonplayable = false;
        this.gameplay.htmlelements.speed.style.display = "block";

        this.destroyOtherUser();
    }

    updateRT () {
        if (this.circuit_change_date != undefined) { 
            let rts = Math.round((this.circuit_change_date - Date.now())/1000);
            if (rts < 0) rts = 0;
            let rtMin = Math.floor(rts/60);
            let rtSec = rts % 60;
            if (rtSec < 10) { rtSec = "0" + rtSec; }
            this.htmlSessionElements.remaining_time.innerHTML = rtMin + ":" + rtSec;
        }
    }
    
    add_user (data) {
        // Create car & add it to the scene
        let carconf_tmp = Object.assign({}, this.carconf);
        carconf_tmp.defaultColor = "#" + data.color;
        carconf_tmp.colorOuterMinimap = "white";
        let c = new Car(carconf_tmp);
        c.initVue(this.scenes[0]);
        this.scenes[1].add(c.minimapMesh);

        let d = new Driver(data.name, c, undefined, data.id);
        d.currTime = data.currTime;
        d.bestLapTime = data.blt;
        this.leaderboard.addDriver(d);
        this.otherDrivers.set(data.id, d);

        this.gameplay.otherCars.set(data.id, c);
    }

    del_user (data) {
        let driver = this.otherDrivers.get(data.id);
        if (driver != undefined) {
            // remove meshes
            this.scenes[1].remove(driver.car.minimapMesh);
            this.scenes[0].remove(driver.car.chassisMesh);
            for (var i = 0; i < driver.car.WHEELSNUMBER; i++) {
                this.scenes[0].remove(driver.car.wheelMeshes[i]);
            }

            this.leaderboard.delDriver(data.id);
            this.otherDrivers.delete(data.id);
        }
        this.gameplay.otherCars.delete(data.id);
    }

    mainDriverUpdate () {
        if (this.socket != undefined) {
            this.socket.emit("driver_update", this.get_user_data());
        }
    }

    update_user (data) {
        let d = this.otherDrivers.get(data.id);
        if (d != undefined) {
            d.updateName(data.name);
            d.car.updateColor('#' + data.color);
            d.currTime = data.currTime;
            let last_blt = d.bestLapTime;
            d.bestLapTime = data.blt;
            if (last_blt != data.blt) this.leaderboard.sortDrivers();
        }
    }

    update_positions (data) {
        for (let d of data.table) {
            let c = this.gameplay.otherCars.get(d.id);
            if (c != undefined) {
                c.setLerpPosition(d.p, d.q, d.s, d.sv);
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