import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import express from 'express';
import cors from "cors";

// Create HTTP server
const app = express();
app.use(cors({ origin: "*" }));
const server = http.createServer(app);

// Create WebSocket server instance
const wss = new WebSocketServer({ server });

// Game configuration
const PLAYER_RADIUS = 15;
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;

// Player data storage
const players = new Map();
let nextPlayerId = 1;

// Enhanced position broadcasting system
const broadcastPositions = () => {
  const positions = Array.from(players.values()).map(player => ({
    id: player.id,
    x: player.x,
    y: player.y,
    color: player.color
  }));

  const updateMessage = JSON.stringify({
    type: 'positionUpdate',
    players: positions
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(updateMessage);
    }
  });
};

// Player connection handler
wss.on('connection', (ws) => {
  // Generate initial position
  const initialPosition = {
    x: Math.random() * (WORLD_WIDTH - PLAYER_RADIUS * 2) + PLAYER_RADIUS,
    y: Math.random() * (WORLD_HEIGHT - PLAYER_RADIUS * 2) + PLAYER_RADIUS,
  };

  // Create new player
  const playerId = nextPlayerId++;
  const newPlayer = {
    id: playerId,
    ...initialPosition,
    color: `#${Math.floor(Math.random()*16777215).toString(16)}`
  };

  // Store player
  players.set(playerId, newPlayer);

  // Send initial setup
  ws.send(JSON.stringify({
    type: 'init',
    id: playerId,
    players: Array.from(players.values()),
    config: {
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
      playerRadius: PLAYER_RADIUS
    }
  }));

  // Handle client messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'move') {
        const player = players.get(playerId);
        if (!player) return;

        // Update position with boundary checks
        player.x = Math.max(PLAYER_RADIUS, 
          Math.min(message.x, WORLD_WIDTH - PLAYER_RADIUS));
        player.y = Math.max(PLAYER_RADIUS,
          Math.min(message.y, WORLD_HEIGHT - PLAYER_RADIUS));

        // Broadcast updates immediately
        broadcastPositions();
      }
    } catch (error) {
      console.error('Invalid message:', error);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    players.delete(playerId);
    broadcastPositions(); // Update remaining players
  });
});

// Start position broadcast interval
setInterval(broadcastPositions, 50); // 20 updates/second

// Start server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Live position server running on port ${PORT}`);
});