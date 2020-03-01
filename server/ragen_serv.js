'use strict';

// ---- CONFIGURATION ----
const PORT = 3000;

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

io.on('connection', (socket) => {
    console.log('New User connected');

    socket.on('connect_session', (data) => {
        console.log(data);

        var sid = data.sid.toUpperCase()
        socket.emit("reload_session", {sid: sid, cid: generateRandomSeed(6)});
    });

    socket.on('disconnect', () => {
        console.log("Disconnected!");
    });


});