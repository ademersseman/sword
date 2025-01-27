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
    console.log('New player connected');

    // Generate a unique ID for the new player
    const clientId = Date.now(); // Simple unique ID based on time
    
    // Handle incoming messages (player movements)
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'spawn') {
            players[clientId] = { x: -300, y: -300, angle: 0, rotationSpeed: clientId % 2 == 0 ? 0.008:-0.008, killCount: 0 }; // Initial player position
            
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


    });

    // Handle connection close
    ws.on('close', () => {
        console.log('Player disconnected');
        delete players[clientId]
        broadcast({ type: 'kill', clientId });
    });
});