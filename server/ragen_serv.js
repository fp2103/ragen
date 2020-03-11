'use strict';

// ---- CONFIGURATION ----
const PORT = 3000;

const CIRCUITRELOAD = 300000;

const KEEPALIVETIME = 30000;
const CLEANINGFREQUENCE = 10000;

const MAXPLAYER = 12;

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
    constructor (socket, session, name, color, currTime, blt) {
        this.socket = socket;
        this.session = session;
        this.name = name;
        this.color = color;
        this.currTime = currTime;
        this.bestLapTime = blt;
        this.isSpectator = false;
    }

    getData () {
        return {id: this.socket.id,
                name: this.name,
                color: this.color,
                currTime: this.currTime,
                blt: this.bestLapTime};
    }
}
const socket_player = new Map();

// Sessions
class Session {
    constructor (id, listed) {
        console.log("Creating session", id);
        this.id = id;
        this.listed = listed;

        this.circuit = generateRandomSeed(6);
        setInterval(this.reload_circuit.bind(this), CIRCUITRELOAD+1000);
        this.circuitStartTime = Date.now();

        this.players = new Map();
        this.activePlayerCount = 0;
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
                nonplayable: isSpectator};
    }

    reload_circuit () {
        this.circuit = generateRandomSeed(6);
        this.circuitStartTime = Date.now();
        // Reset players time
        for (let p of this.players.values()) {
            p.currTime = [undefined, undefined, undefined];
            p.bestLapTime = undefined;
        }
        // Send new session info to players
        for (let p of this.players.values()) {
            p.socket.emit('load_session', this.getData(p.socket.id));
        }
    }

    is_inactive () {
        return (this.lastDisonnectedTS != undefined 
                && Date.now() - this.lastDisonnectedTS > KEEPALIVETIME);
    }

    new_user (player) {
        if (this.activePlayerCount < MAXPLAYER) {
            for (let p of this.players.values()) {
                p.socket.emit('add_user', player.getData());
            }
            this.activePlayerCount += 1;
        } else {
            player.isSpectator = true;
        }
        this.players.set(player.socket.id, player);
        this.lastDisonnectedTS = undefined;
    }

    remove_user (userid) {
        let player = this.players.get(userid);
        // Remove from all other users
        this.players.delete(userid);
        for (let p of this.players.values()) {
            p.socket.emit('del_user', {id: userid});
        }

        if (player != undefined && !player.isSpectator) {
            this.activePlayerCount -= 1;

            // Load another waiting player
            for (let p of this.players.values()) {
                if (p.isSpectator) {
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
        }
    }

    update_user (user) {
        for (let p of this.players.values()) {
            if (p.socket.id != user.socket.id) {
                p.socket.emit('update_user', user.getData());
            }
        }
    }
}
const sessions = new Map();

// Render the page
app.get('/', (req, res) => {
    res.render('index');
});
app.get('/sessions_list', (req,res) => {
    let sessions_list = [];
    for (let [sid, s] of sessions.entries()) {
        if (s.listed) { sessions_list.push(sid); }
    }
    res.render('sessions_list', {sessions: sessions_list});
});

// Clean old empty sessions
setInterval(() => {
    const toDel = [];
    for (let [k, s] of sessions.entries()) {
        if (s.is_inactive()) { toDel.push(k); }
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
        console.log("User", socket.id, "Joining session", sid);
        console.log(data.user);
        
        // Retreive session or create a new one
        let session = sessions.get(sid);
        if (session == undefined) {
            session = new Session(sid, data.tbl);
            sessions.set(sid, session);
        }

        // Create new Player
        let p = new Player(socket, session, data.user.name, data.user.color, data.user.currTime);
        socket_player.set(socket.id, p);
        session.new_user(p);

        socket.emit('load_session', session.getData(socket.id));
    });

    socket.on('disconnect', () => {
        console.log("User disconnected", socket.id);
        let player = socket_player.get(socket.id);
        if (player != undefined) {
            player.session.remove_user(socket.id);
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
    
});