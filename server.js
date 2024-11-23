const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

const players = {};
const playerStates = {};
let enemies = [];  // Initialize as empty array instead of null
let hostId = null;

io.on("connection", (socket) => {
  console.log("A player connected:", socket.id);

  // Assign host if none exists
  if (!hostId) {
    hostId = socket.id;
    console.log("Host assigned:", hostId);
    // Reset enemies array when new host is assigned
    enemies = [];
  }

  // Send host status to the connecting client
  socket.emit("hostStatus", { isHost: socket.id === hostId });

  // If enemies exist and this isn't the host, send them to the new player
  if (enemies.length > 0 && socket.id !== hostId) {
    console.log("Sending existing enemies to new player");
    socket.emit("initEnemies", enemies);
  }

  players[socket.id] = {
    id: socket.id,
    x: Math.random() * 500,
    y: Math.random() * 500,
    radius: 15,
    color: `hsl(${Math.random() * 360}, 50%, 50%)`,
  };

  playerStates[socket.id] = { isAlive: true };

  io.emit("updatePlayers", players);
  io.emit("playerStateUpdate", playerStates);

  // Handle initial enemy creation from host
  socket.on("initEnemies", (enemiesData) => {
    if (socket.id === hostId) {
      console.log("Host initialized enemies:", enemiesData.length);
      enemies = enemiesData;
      // Broadcast to all clients except the host
      socket.broadcast.emit("initEnemies", enemies);
    }
  });

  // Handle enemy position updates from host
  socket.on("updateEnemies", (enemiesData) => {
    if (socket.id === hostId) {
      enemies = enemiesData;
      // Broadcast to all clients except the host
      socket.broadcast.emit("updateEnemies", enemies);
    }
  });

  socket.on("move", (data) => {
    if (players[socket.id]) {
      players[socket.id].x += data.x;
      players[socket.id].y += data.y;
      io.emit("updatePlayers", players);
    }
  });

  socket.on("playerStateUpdate", (states) => {
    Object.assign(playerStates, states);
    io.emit("playerStateUpdate", playerStates);
  });

  socket.on("disconnect", () => {
    console.log("A player disconnected:", socket.id);
    
    if (socket.id === hostId) {
      const remainingPlayers = Object.keys(players).filter(id => id !== socket.id);
      if (remainingPlayers.length > 0) {
        hostId = remainingPlayers[0];
        console.log("New host assigned:", hostId);
        io.to(hostId).emit("hostStatus", { isHost: true });
      } else {
        hostId = null;
        enemies = []; // Reset to empty array instead of null
      }
    }

    delete players[socket.id];
    delete playerStates[socket.id];
    io.emit("updatePlayers", players);
    io.emit("playerStateUpdate", playerStates);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});