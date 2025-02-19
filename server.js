const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = 80;

// Serve static files (index.html, JS, CSS) from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Start the HTTP server (Express) for serving the HTML and assets
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Set up WebSocket server on the same HTTP server
const wss = new WebSocket.Server({ server });

let players = {}; // Object to store player data (e.g., positions)
let collisionTimer = {}

// Broadcast updates to all clients
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// WebSocket server connection handler
wss.on('connection', (ws) => {
    // Generate a unique ID for the new player
    const clientId = Date.now(); // Simple unique ID based on time
    
    // Handle incoming messages (player movements)
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'spawn') {
            players[clientId] = { x: -1000, y: -1000, angle: 0, rotationSpeed: clientId % 2 == 0 ? 0.08:-0.08, killCount: 0 }; // Initial player position
            collisionTimer[clientId] = Date.now()
            
            // Send initial state to the new player
            ws.send(JSON.stringify({ type: 'init', players, clientId }));
        }

        if (data.type === 'move') {
            // Update player position
            if (players[data.id]) {
                players[data.id] = data.player;
            }

            // Broadcast updated player positions to all clients
            broadcast({ type: 'update', players });
        }
        
        if (data.type === 'kill') {
            // remove the player player position
            if (players[data.id]) {
                delete players[data.id]
            }
            
            // Broadcast kill player to all clients
            broadcast({ type: 'kill', id: data.id });
        }

        if (data.type === 'collision') {
            // remove the player player position
            if (Date.now() - collisionTimer[data.id1] > 200 && Date.now() - collisionTimer[data.id2] > 200) {
                collisionTimer[data.id1] = Date.now()
                collisionTimer[data.id2] = Date.now()
                broadcast({ type: 'collision', id1: data.id1, id2: data.id2 });
            }
        }

    });

    // Handle connection close
    ws.on('close', () => {
        delete players[clientId]
        delete collisionTimer[clientId]
        broadcast({ type: 'kill', clientId });
    });
});