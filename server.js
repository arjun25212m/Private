const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve static files
app.use(express.static('public'));

// Store rooms data
const rooms = {};

io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);

    // Join room
    socket.on('join-room', ({ room, password, username }) => {
        // Create room if doesn't exist
        if (!rooms[room]) {
            rooms[room] = { 
                password: password, 
                users: [], 
                messages: [] 
            };
        }

        // Check password
        if (rooms[room].password !== password) {
            socket.emit('error', '❌ Wrong password!');
            return;
        }

        // Join room
        socket.join(room);
        rooms[room].users.push(socket.id);
        socket.data = { room, username };

        // Send previous messages
        socket.emit('load-messages', rooms[room].messages);
        
        // Notify others
        socket.to(room).emit('system-message', `🟢 ${username} joined the chat`);
        
        console.log(`📥 ${username} joined room: ${room} (${rooms[room].users.length} users)`);
    });

    // Send message
    socket.on('send-message', ({ room, text }) => {
        const user = socket.data;
        if (!user || user.room !== room) return;

        const msg = { 
            sender: user.username, 
            text: text, 
            time: Date.now() 
        };
        
        rooms[room].messages.push(msg);
        io.to(room).emit('new-message', msg);
    });

    // Exit room
    socket.on('exit-room', ({ room }) => {
        const user = socket.data;
        if (user && user.room === room) {
            socket.leave(room);
            rooms[room].users = rooms[room].users.filter(id => id !== socket.id);
            socket.to(room).emit('system-message', `🔴 ${user.username} left the chat`);

            // Delete room if empty
            if (rooms[room].users.length === 0) {
                delete rooms[room];
                console.log(`🗑️ Room ${room} deleted (empty)`);
            }
            socket.data = null;
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        const user = socket.data;
        if (user && rooms[user.room]) {
            rooms[user.room].users = rooms[user.room].users.filter(id => id !== socket.id);
            socket.to(user.room).emit('system-message', `🔴 ${user.username} disconnected`);

            if (rooms[user.room].users.length === 0) {
                delete rooms[user.room];
                console.log(`🗑️ Room ${user.room} deleted (disconnect)`);
            }
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Waiting for connections...`);
});