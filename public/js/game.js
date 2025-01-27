import { distance, doLineSegmentsIntersect } from './geometry.js';

(async () =>
{

    const app = new PIXI.Application();

    await app.init({ background: '#f3f1f2', resizeTo: window });

    document.body.appendChild(app.view);
    
    app.stage.interactive = true;

    // Create a texture from the grid square
    const paper = await PIXI.Assets.load('assets/bgk-converter.jpg');
    
    const mapSize = 1000
    
    const background = new PIXI.TilingSprite({texture: paper, width: app.screen.width + mapSize, height: app.screen.height + mapSize});
    // Add the tiling sprite to the stage (background grid)
    app.stage.addChild(background);

    //clients coordinate on the map
    const coord = new PIXI.Text('(0, 0)', {
        fontFamily: 'Arial',
        fontSize: 12,
        fill: 0xffffff,
    });
    coord.alpha = 0.5
    // Set the position of the text (top-right corner)
    coord.x = app.screen.width - 10 - coord.width;
    coord.y = 10;
    app.stage.addChild(coord);

    //leaderboard title text (located top left)
    const leaderboard = new PIXI.Text('Leaderboard', {
        fontFamily: 'Arial',
        fontSize: 16,
        fill: 0xffffff, // White color
    });
    leaderboard.x = 10
    leaderboard.y = 10

    app.stage.addChild(leaderboard)

    //leaderboard content
    const leaderboardContent = new PIXI.Text('', {
        fontFamily: 'Arial',
        fontSize: 12,
        fill: 0xffffff,
    });
    leaderboardContent.alpha = 0.5
    leaderboardContent.x = 10
    leaderboardContent.y = 15 + leaderboardContent.height
    
    app.stage.addChild(leaderboardContent)

    //player rank (located bottom left)
    const yourRank = new PIXI.Text('Your Rank - 0', {
        fontFamily: 'Arial',
        fontSize: 16,
        fill: 0xffffff,
    });
    yourRank.x = 10
    yourRank.y = app.screen.height - 10 - yourRank.height
    
    app.stage.addChild(yourRank)

    // Player and Sword graphics contexts
    const players = {};
    const playerContext = new PIXI.GraphicsContext()
    .circle(0, 0, 50)
    
    const swordContext = new PIXI.GraphicsContext()
    .rect(0, 0, 5, 150)
    .fill(0xFFD700)
    
    const swordRadius = 150;
    let clientId = null;
    let playerGraphics = {}; // contains client copy of game state
    const colorList = [
        0xFF0000, // Red
        0x00FF00, // Green
        0x0000FF, // Blue
        0xFFFF00, // Yellow
        0x00FFFF, // Cyan
        0xFF00FF, // Magenta
        0x000000, // Black
        0xC0C0C0, // Silver
    ];
    
    let targetPosition = { x: app.screen.width / 2, y: app.screen.height / 2 }; // Target position for movement
    
    // Connect to WebSocket server
    const socket = new WebSocket('ws:ec2-3-16-79-116.us-east-2.compute.amazonaws.com');
    
    socket.onopen = () => {
        console.log('Connected to server');
    };
    
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'init') {
            clientId = data.clientId;
            // Initialize players when the connection is established
            Object.assign(players, data.players);
            for (let id in players) {
                createPlayer(id);
            }
        }
        if (data.type === 'update' && data.players[clientId] != null) {
            for (let id in data.players) { // update every player except the client with server information
                if (id != clientId) {
                    players[id] = data.players[id]
                }
            }
            for (let id in players) { // create new players
                if (!playerGraphics[id]) {
                    createPlayer(id);
                }
            }
            // Update players' positions based on server data
            updatePlayers();
        }
        if (data.type === 'kill') {
            killPlayer(data.id)
        }
    };
    
    //main menu logic
    async function menu() {
        const button = new PIXI.Graphics().roundRect((app.screen.width - 200)/2, (app.screen.height - 100)/2, 200, 100).fill(0x000000);
        button.filters = new PIXI.BlurFilter({ strength: 5 });
        const buttonMask = new PIXI.Graphics().roundRect((app.screen.width - 200)/2, (app.screen.height - 100)/2, 200, 100).fill(0x000000);
        buttonMask.alpha = 0
        const play = new PIXI.Text('Play', {fontFamily: 'Arial', fontSize: 48, fill: 0xffffff});
        play.x = (app.screen.width - play.width)/2
        play.y = (app.screen.height - play.height)/2
        buttonMask.eventMode = 'static';
        buttonMask.cursor = 'pointer';
        app.stage.addChild(button);
        app.stage.addChild(play);
        app.stage.addChild(buttonMask);

        let elapsedTime = 0
        return new Promise((resolve) => {
            // Start fade-out animation on button click
            buttonMask.on('pointerdown', () => {
                app.ticker.add(function fadeOut(delta) {
                    elapsedTime += delta.deltaTime;  // Accumulate the time passed (delta is time between frames)
                    const fadeAmount = 1 - elapsedTime / 50; // Fade over time
    
                    // Update alpha values
                    button.alpha = fadeAmount;
                    play.alpha = fadeAmount;
    
                    // Log for debugging
                    // If the button has fully faded out, remove it and resolve the promise
                    if (fadeAmount <= 0) {
                        app.stage.removeChild(button);
                        app.stage.removeChild(play);
                        app.stage.removeChild(buttonMask);
    
                        socket.send(JSON.stringify({ type: 'spawn' }));
    
                        // Remove the ticker listener to stop the animation
                        app.ticker.remove(fadeOut);
    
                        // Resolve the promise when the animation finishes
                        resolve('done');
                    }
                });
            });
            // Add the button and text to the stage
        });
    }
 
    await menu()

    // Create a player and all graphical components
    function createPlayer(id) {
        if (!players[id]) return

        const player = new PIXI.Graphics(playerContext);
        player.fill(colorList[Math.floor(Math.random() * colorList.length)]); // Red color
        //player.fill(new PIXI.FillGradient(0, 0, 200, 200))
        player.x = app.screen.width / 2 + players[id].x - players[clientId].x;
        player.y = app.screen.height / 2 + players[id].y - players[clientId].y;
        player.filters = new PIXI.BlurFilter({ strength: 2 });
        
        const killCount = new PIXI.Text(players[id].killCount, {
            fontFamily: 'Arial',
            fontSize: 24,
            fill: 0xffffff, // White color
        });
        killCount.x = player.x - killCount.width / 2
        killCount.y = player.y - killCount.height / 2
        
        const sword = []
        for (let i = 0; i < 30; i++) {
            sword.push(new PIXI.Graphics(swordContext));
            sword[i].alpha = (30 - i)/30
            sword[i].x = player.x + Math.cos(players[id].angle) * swordRadius;
            sword[i].y = player.y + Math.sin(players[id].angle) * swordRadius;
            sword[i].angle = players[id].angle
            sword[i].filters = new PIXI.BlurFilter({ strength: 1 });
            app.stage.addChild(sword[i]);
        }
        app.stage.addChild(player);
        app.stage.addChild(killCount);
        
        // Store the player and sword for later updates
        playerGraphics[id] = {player, sword, killCount};
    }


    // Update all players' positions and sword rotation
    function updatePlayers() {
        for (let id in playerGraphics) {
            if (playerGraphics[id] && players[id] && players[clientId]) {
                playerGraphics[id].player.x = app.screen.width / 2 + players[id].x - players[clientId].x
                playerGraphics[id].player.y = app.screen.height / 2 + players[id].y - players[clientId].y
                playerGraphics[id].killCount.text = players[id].killCount
                playerGraphics[id].killCount.x = playerGraphics[id].player.x - playerGraphics[id].killCount.width / 2
                playerGraphics[id].killCount.y = playerGraphics[id].player.y - playerGraphics[id].killCount.height / 2
                for (let i = 0; i < 30; i++) {
                    if (players[id].rotationSpeed > 0) {
                        playerGraphics[id].sword[i].angle = players[id].angle - i/30
                    } else {
                        playerGraphics[id].sword[i].angle = players[id].angle + i/30
                    }
                    playerGraphics[id].sword[i].alpha = (30 - i)/30
                    playerGraphics[id].sword[i].x = playerGraphics[id].player.x + Math.cos(playerGraphics[id].sword[i].angle) * swordRadius;
                    playerGraphics[id].sword[i].y = playerGraphics[id].player.y + Math.sin(playerGraphics[id].sword[i].angle) * swordRadius;
                    playerGraphics[id].sword[i].rotation = playerGraphics[id].sword[i].angle + Math.PI / 2
                }            
            }
        }
        // sort players by killCount
        const ranking = Object
        .entries(players) 
        .sort((a, b) => b[1].killCount - a[1].killCount)
        const top5 = ranking.slice(0,5)
        //update leaderboard
        let newLeaderboard = ''
        for (let i = 0; i < Math.min(top5.length, 5); i++) {
            newLeaderboard += (i + 1) + ' - ' + top5[i][1].killCount + '\n'
        }
        leaderboardContent.text = newLeaderboard
        //update player rank
        yourRank.text = 'Your Rank - ' + (ranking.findIndex(player => player[0] == clientId) + 1)
    }

    //removes a players graphic components
    function removePlayerGraphic(id) {
        const {player, sword, killCount} = playerGraphics[id];
        app.stage.removeChild(player);  // Remove player graphic
        app.stage.removeChild(killCount)
        for (let i = 0; i < 30; i++) {
            app.stage.removeChild(sword[i]);   // Remove sword graphic
        }
        
        // Delete the player from the dicts
        delete players[id];
        delete playerGraphics[id];
    }

    //executed when a player is killed
    function killPlayer(id) {
        if (!playerGraphics[id]) return;

        // Remove the player and sword from the stage
        removePlayerGraphic(id)
        
        socket.send(JSON.stringify({
            type: 'kill',
            id: id,
        }));

        if (id == clientId) {
            //remove all player graphics
            for (let id0 in playerGraphics) {
                removePlayerGraphic(id0)
            }
            menu();
        }
    }

    //kill the client player on refresh
    window.addEventListener("beforeunload", () => {
        killPlayer(clientId);
    })

    // Handle mouse movement to send to server
    app.stage.on('pointermove', (event) => {
        targetPosition = event.data.global; // Set the new target position
    });

    let lastCollisionCheck = 0
    // Main game loop to update sword position
    app.ticker.add((delta) => {
        if (!players[clientId]) return;

        players[clientId].angle += delta.deltaTime * players[clientId].rotationSpeed * 10;

        //move client
        const d = distance(targetPosition, playerGraphics[clientId].player)
        if (d > 50) { // speed may change based on player computer speed
            // Smooth player movement towards the target position
            const speed = 2;
            const dx = targetPosition.x - playerGraphics[clientId].player.x;
            const dy = targetPosition.y - playerGraphics[clientId].player.y;
            //shift background
            background.x = Math.min(Math.max(-mapSize, background.x - (dx / d) * speed), 0)
            players[clientId].x = Math.min(Math.max(0, players[clientId].x + (dx / d) * speed), mapSize)
            background.y = Math.min(Math.max(-mapSize, background.y - (dy / d) * speed), 0)
            players[clientId].y = Math.min(Math.max(0, players[clientId].y + (dy / d) * speed), mapSize)
            coord.text = '(' + Math.round(players[clientId].x) + ', ' + Math.round(players[clientId].y) + ')'
            coord.x = app.screen.width - 10 - coord.width
        }
        
        // check for collisions
        for (let id in playerGraphics) {
            if (id != clientId) {
                if (distance(playerGraphics[id].player, playerGraphics[clientId].sword[0]) < 50) { // client kills player with id
                    killPlayer(id)
                    players[clientId].killCount += 1
                    players[clientId].rotationSpeed *= -1
                } else if (Date.now() - lastCollisionCheck > 50 && doLineSegmentsIntersect(playerGraphics[id].player, playerGraphics[id].sword[0], playerGraphics[clientId].player, playerGraphics[clientId].sword[0])) { //swords connect and reflect backwards
                    players[id].rotationSpeed *= -1
                    players[clientId].rotationSpeed *= -1
                    lastCollisionCheck = Date.now()
                }
            }
        }

        if (players[clientId]) { // update server with player movement
            socket.send(JSON.stringify({
                type: 'move',
                id: clientId,
                player: players[clientId],
            }));
        }
    });
})();
