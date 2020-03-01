
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
 * 3b. Share car & car position
 * 
 * 4. session share, press papier...
 * 
 * 5. time reload circuit
 * 
 */


 class Client {
    constructor (conf, gameplay, circuitInit) {
        this.server = conf.server;
        this.gameplay = gameplay;
        this.circuitInit = circuitInit;

        this.sessionid = undefined;
        this.socket = undefined;
    }

    isConnected () {
        return this.sessionid != undefined;
    }

    connect (sessionid, tobelisted) {
        this.socket = io.connect(this.server);
        this.socket.emit("connect_session", {sid: sessionid, tbl: tobelisted});
        this.socket.on("reload_session", (data) => {this.reload_session(data)});
    }

    reload_session (data) {
        this.sessionid = data.sid;
        this.gameplay.reloadCircuit(this.circuitInit(data.cid));
    }

    disconnect () {
        this.socket.emit("quit_session", {sid: this.sessionid});
        this.socket.close();
        this.sessionid = undefined;
        this.socket = undefined;
    }
 }