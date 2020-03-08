'use strict';

// ---- CONFIGURATION ----
const PORT = 3000;

const CIRCUITRELOAD = 300000;

const KEEPALIVETIME = 30000;
const CLEANINGFREQUENCE = 10000;

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
    constructor (socket, sessionid, name, color, currTime) {
        this.socket = socket;
        this.sessionid = sessionid;
        this.name = name;
        this.color = color;
        this.currTime = currTime;
    }

    getData () {
        return {id: this.socket.id,
                name: this.name,
                color: this.color,
                currTime: this.currTime};
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
    }

    getData (socketid_dest) {
        let otherPlayers = [];
        for (let p of this.players.values()) {
            if (p.socket.id != socketid_dest) {
                otherPlayers.push(p.getData());
            }
        } 
        return {id: this.id,
                cid: this.circuit,
                rt: this.circuitStartTime + CIRCUITRELOAD - Date.now(),
                players: otherPlayers};
    }

    reload_circuit () {
        this.circuit = generateRandomSeed(6);
        this.circuitStartTime = Date.now();
        // Reset players time
        for (let p of this.players.values()) {
            p.currTime = [undefined, undefined, undefined];
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
        for (let p of this.players.values()) {
            p.socket.emit('add_user', player.getData());
        }
        this.players.set(player.socket.id, player);
        this.lastDisonnectedTS = undefined;
    }

    remove_user (userid) {
        this.players.delete(userid);
        for (let p of this.players.values()) {
            p.socket.emit('del_user', {id: userid});
        }
        if (this.players.size == 0) {
            this.lastDisonnectedTS = Date.now();
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
        
        // Create new Player
        let p = new Player(socket, sid, data.user.name, data.user.color, data.user.currTime);
        socket_player.set(socket.id, p);

        // Retreive session or create a new one
        let session = sessions.get(sid);
        if (session == undefined) {
            session = new Session(sid, data.tbl);
            sessions.set(sid, session);
        }
        session.new_user(p);

        socket.emit('load_session', session.getData(socket.id));
    });

    socket.on('disconnect', () => {
        console.log("User disconnected", socket.id);
        let player = socket_player.get(socket.id);
        if (player != undefined) {
            let session = sessions.get(player.sessionid);
            if (session != undefined) {
                session.remove_user(socket.id);
            }
        }
        socket_player.delete(socket.id);
    });
    
});