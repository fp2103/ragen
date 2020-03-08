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

// routes
app.get('/', (req, res) => {
	res.render('index');
});

// Listen on port PORT
const server = app.listen(PORT);
console.log("Starting Server on port", PORT);

const io = require("socket.io")(server);

// Sessions
class Session {
    constructor (id, listed) {
        console.log("Creating session", id);
        this.id = id;
        this.circuit = generateRandomSeed(6);
        this.listed = listed;

        this.active_sockets = new Map();

        setInterval(this.reload_circuit.bind(this), CIRCUITRELOAD+1000);
        this.circuitStartTime = Date.now();
        this.lastDisonnectedTS = undefined;
    }

    reload_circuit () {
        this.circuit = generateRandomSeed(6);
        this.circuitStartTime = Date.now();
        for (let s of this.active_sockets.values()) {
            s.emit('load_session', {cid: this.circuit, rt: CIRCUITRELOAD});
        }
    }

    is_inactive () {
        return (this.lastDisonnectedTS != undefined 
                && Date.now() - this.lastDisonnectedTS > KEEPALIVETIME);
    }
}
const sessions = new Map();
const socket_session = new Map();

// Clean empty sessions
setInterval(() => {
    const toDel = [];
    for (let [k, s] of sessions.entries()) {
        if (s.is_inactive()) { toDel.push(k); }
    }
    console.log("Cleaning old sessions:", toDel)
    toDel.forEach(d => { sessions.delete(d); });
}, CLEANINGFREQUENCE);

// communication function 
io.on('connection', (socket) => {
    console.log('New User connected', socket.id);
    socket.emit('session_please');
    
    socket.on('join_session', (data) => {
        const sid = data.sid.toUpperCase();
        console.log("User", socket.id, "Joining session", sid);

        // Retreive session or create a new one
        let session = sessions.get(sid);
        let remaining_time = CIRCUITRELOAD
        if (session == undefined) {
            session = new Session(sid, data.tbl);
            sessions.set(sid, session);
        } else {
            remaining_time = session.circuitStartTime + CIRCUITRELOAD - Date.now();
        }
        session.active_sockets.set(socket.id, socket);
        socket_session.set(socket.id, session);
        session.lastDisonnectedTS = undefined;

        socket.emit('load_session', {cid: session.circuit, rt: remaining_time});
    });

    socket.on('disconnect', () => {
        console.log("User disconnected", socket.id);
        let session = socket_session.get(socket.id);
        if (session != undefined) {
            session.active_sockets.delete(socket.id);
            if (session.active_sockets.size == 0) {
                session.lastDisonnectedTS = Date.now();
            }
        }
        socket_session.delete(socket.id);
    });
    
});