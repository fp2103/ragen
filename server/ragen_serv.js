'use strict';

// ---- CONFIGURATION ----
const PORT = process.env.PORT || 8080;

const CIRCUITRELOAD = 240000;
const PODIUM_SCENE_DURATION = 15000;

const KEEPALIVETIME = 30000;
const CLEANINGFREQUENCE = 10000;

const MAXPLAYER = 8;

const POSITIONSREFRESH = 55;
const GARBAGE_USER = 30000;

// ---- Function Utils ----
function generateRandomSeed (size) {
    const ascii = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let seed = "";
    for (var i = 0; i < size; i++) {
        let j = Math.floor(Math.random() * (ascii.length));
        seed += ascii.charAt(j);
    }
    return seed; 
}

// ---- Main server ----
const express = require('express');
const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Each individual player
class Player {
    constructor (socket, token, session, name, color, currTime, blt) {
        this.socket = socket;
        this.token = token;
        this.session = session;
        this.name = name;
        this.color = color;
        this.currTime = currTime;
        this.bestLapTime = blt;
        this.isSpectator = false;

        this.position = undefined;
        this.quaternion = undefined;
        this.speed = 0;
        this.steeringValue = 0;

        this.disconnected = false;
    }

    getData () {
        return {id: this.token,
                name: this.name,
                color: this.color,
                currTime: this.currTime,
                blt: this.bestLapTime};
    }
}
const socket_player = new Map();

// Sessions
class Session {
    constructor (id) {
        console.log("Creating session", id);
        this.id = id;

        this.circuit = undefined;
        this.circuitStartTime = undefined;
        this.state = undefined;

        this.players = new Map();
        this.activePlayerCount = 0;

        this.emitPosInter = setInterval(this.emitPositions.bind(this), POSITIONSREFRESH);
        this.currentTimeout = undefined;

        // load a new circuit
        this.reload_circuit();

        this.garbageUserIter = setInterval(this.garbageUserCollector.bind(this), GARBAGE_USER);
        this.toDumpList = [];
    }

    getData (socketid_dest) {
        let otherPlayers = [];
        let isSpectator = false;
        for (let p of this.players.values()) {
            if (p.socket.id != socketid_dest && !p.isSpectator) {
                otherPlayers.push(p.getData());
            } else if (p.socket.id == socketid_dest) {
                isSpectator = p.isSpectator;
            }
        } 
        return {id: this.id,
                cid: this.circuit,
                rt: this.circuitStartTime + CIRCUITRELOAD - Date.now(),
                players: otherPlayers,
                nonplayable: isSpectator,
                state: this.state};
    }

    refreshSession () {
        for (let p of this.players.values()) {
            if(!p.disconnected) p.socket.emit('load_session', this.getData(p.socket.id));
        }
    }

    circuitClosing () {
        // if one player has a best time -> podium scene
        let podium_scene = false;
        for (let p of this.players.values()) {
            if (p.bestLapTime != undefined) {
                podium_scene = true;
                break;
            }
        }

        if (podium_scene) {
            this.state = "podium";
            this.refreshSession();
            this.currentTimeout = setTimeout(this.reload_circuit.bind(this), PODIUM_SCENE_DURATION);
        } else {
            this.reload_circuit();
        }
    }

    reload_circuit () {
        this.circuit = generateRandomSeed(6);
        //this.circuit = "D48Osg";
        this.circuitStartTime = Date.now();
        this.state = "main";
        console.log("Session", this.id, "new circuit", this.circuit);
        // Reset players time
        for (let p of this.players.values()) {
            p.currTime = [undefined, undefined, undefined];
            p.bestLapTime = undefined;
        }
        // Send new session info to players
        this.refreshSession();
        this.currentTimeout = setTimeout(this.circuitClosing.bind(this), CIRCUITRELOAD + 1000);
    }

    is_inactive () {
        return (this.lastDisonnectedTS != undefined 
                && Date.now() - this.lastDisonnectedTS > KEEPALIVETIME);
    }

    new_user (player) {
        if (this.activePlayerCount < MAXPLAYER) {
            for (let p of this.players.values()) {
                if (p.socket.id != player.socket.id && !p.disconnected) {
                    p.socket.emit('add_user', player.getData());
                }
            }
            this.activePlayerCount += 1;
        } else {
            player.isSpectator = true;
        }
        this.players.set(player.token, player);
        this.lastDisonnectedTS = undefined;
    }

    remove_user (userid) {
        let player = this.players.get(userid);
        // Remove from all other users
        this.players.delete(userid);
        for (let p of this.players.values()) {
            if (!p.disconnected) p.socket.emit('del_user', {id: userid});
        }

        if (player != undefined && !player.isSpectator) {
            this.activePlayerCount -= 1;

            // Load another waiting player
            for (let p of this.players.values()) {
                if (p.isSpectator && !p.disconnected) {
                    p.isSpectator = false;
                    this.new_user(p);
                    p.socket.emit('load_session', this.getData(p.socket.id));
                    break;
                }
            }
        }

        // Flag session to be deleted if empty
        if (this.players.size == 0) {
            this.lastDisonnectedTS = Date.now();
            if (this.state == "podium") {
                clearTimeout(this.currentTimeout);
                this.reload_circuit();
            }
        }
    }

    update_user (user) {
        for (let p of this.players.values()) {
            if (!p.disconnected && p.socket.id != user.socket.id) {
                p.socket.emit('update_user', user.getData());
            }
        }
    }

    emitPositions () {
        // Create table of all players position
        const table = [];
        for (let p of this.players.values()) {
            table.push({id: p.token, p: p.position, q: p.quaternion, 
                        s: p.speed, sv: p.steeringValue});
        }
        // Emit table to all players
        for (let p of this.players.values()) {
            if (!p.disconnected) p.socket.emit("update_positions", {table: table});
        }
    }

    garbageUserCollector () {
        while (this.toDumpList.length > 0) {
            let p = this.toDumpList.pop();
            if (p.disconnected) this.remove_user(p.token);
        }

        for (let p of this.players.values()) {
            if (p.disconnected) this.toDumpList.push(p);
        }
    }
}
const sessions = new Map();

// Render the page
app.get('/', (req, res) => {
    let sessionid = req.query.sessionid;
    if (sessionid != undefined) {
        sessionid = sessionid.substring(0, 4).toUpperCase();
    }
    res.render('index', {sessionid: sessionid});
});
app.get('/sessions_list', (req,res) => {
    let sessions_list = [];
    for (let [sid, s] of sessions.entries()) {
        sessions_list.push({sid: sid, p: s.activePlayerCount});
    }
    res.append('Access-Control-Allow-Origin', '*');
    res.render('sessions_list', {sessions: sessions_list, mp: MAXPLAYER});
});

// Clean old empty sessions
setInterval(() => {
    const toDel = [];
    for (let [k, s] of sessions.entries()) {
        if (s.is_inactive()) {
            toDel.push(k);
            clearInterval(s.emitPosInter);
            clearInterval(s.garbageUserIter);
            clearTimeout(s.currentTimeout);
        }
    }
    if (toDel.length > 0) {
        console.log("Cleaning old sessions:", toDel);
    }
    toDel.forEach(d => { sessions.delete(d); });
}, CLEANINGFREQUENCE);

// Listen on port PORT
const server = app.listen(PORT);
console.log("Starting Server on port", PORT);

// communication function 
const io = require("socket.io")(server);
io.on('connection', (socket) => {
    console.log('New User connected', socket.id);
    socket.emit('session_please');
    
    socket.on('join_session', (data) => {
        const sid = data.sid.toUpperCase();
        const userToken = data.t;
        console.log("User", socket.id, "Joining session", sid, "token", userToken);
        console.log(data.user);
        
        // Retreive session or create a new one
        let session = sessions.get(sid);
        if (session == undefined) {
            session = new Session(sid);
            sessions.set(sid, session);
        }

        let p = session.players.get(userToken);
        if (p == undefined) {
            // Create new Player
            p = new Player(socket, userToken, session,
                           data.user.name, data.user.color, data.user.currTime);
            session.new_user(p);
        } else {
            p.disconnected = false;
            p.socket = socket;
            p.name = data.user.name;
            p.color = data.user.color;
            p.currTime = data.user.currTime;
            p.bestLapTime = data.user.blt;
            session.update_user(p);
        }
        socket_player.set(socket.id, p);

        socket.emit('load_session', session.getData(socket.id));
    });

    socket.on('disconnect', (reason) => {
        console.log("Socket disconnected", socket.id, `(${reason})`);
        let player = socket_player.get(socket.id);
        if (player != undefined) {
            if (reason.startsWith("client") || reason == "transport close") {
                player.session.remove_user(player.token);
            } else {
                player.disconnected = true;
            }
        }
        socket_player.delete(socket.id);
    });

    socket.on('driver_update', (data) => {
        let player = socket_player.get(socket.id);
        if (player != undefined) {
            player.name = data.name;
            player.color = data.color;
            player.currTime = data.currTime;
            player.bestLapTime = data.blt;
            player.session.update_user(player);
        }
    });

    socket.on('update_position', (data) => {
        let player = socket_player.get(socket.id);
        if (player != undefined) {
            player.position = data.p;
            player.quaternion = data.q;
            player.speed = data.s;
            player.steeringValue = data.sv;
        }
    });
});