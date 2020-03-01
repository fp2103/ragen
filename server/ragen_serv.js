'use strict';

// ---- CONFIGURATION ----
const PORT = 3000;

// ---- Main server script ----
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
});