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
    const coord = new PIXI.Text('', {
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
    const playerRadius = 50
    
    const swordRadius = 150;

    const swordContext = new PIXI.GraphicsContext()
    .rect(0, 0, 5, swordRadius)
    .fill(0xFFD700)

    let clientId = null;
    let playerGraphics = {}; // contains client copy of game state
    
    let targetPosition = { x: app.screen.width / 2, y: app.screen.height / 2 }; // Target position for movement
    
    // Connect to WebSocket server
    //const socket = new WebSocket('ws://localhost:80');
    const socket = new WebSocket('wss://superballs.lol');
    
    socket.onopen = () => {
        console.log('Connected to server');
    };
    
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'init') {
            clientId = data.clientId;
            Object.assign(players, data.players);
            players[clientId].x = Math.random() * mapSize
            players[clientId].y = Math.random() * mapSize
            
            let repeat = false
            while (repeat) { // find a spawn point for the new player
                repeat = false
                for (let id in players) {
                    if (id != clientId && distance(players[clientId], players[id]) < 2 * swordRadius) {
                        players[clientId].x = Math.random() * mapSize
                        players[clientId].y = Math.random() * mapSize
                        repeat = true
                        break
                    }
                }
            }
            
            // Initialize players when the connection is established
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
        }
        if (data.type === 'kill') {
            killPlayer(data.victimId)
        }
        if (data.type === 'collision') {
            players[data.id1].rotationSpeed *= -1
            players[data.id2].rotationSpeed *= -1
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

        const player = new PIXI.Graphics().circle(0, 0, playerRadius);
        player.fill(Math.floor(Math.random() * 0xFFFFFF));
        player.x = app.screen.width / 2 + players[id].x - players[clientId].x;
        player.y = app.screen.height / 2 + players[id].y - players[clientId].y;
        player.filters = new PIXI.BlurFilter({ strength: 2 });
        
        const killCount = new PIXI.Text(players[id].killCount, {
            fontFamily: 'Arial',
            fontSize: 24,
            fill: 0xffffff, // white text
        });
        killCount.x = player.x - killCount.width / 2
        killCount.y = player.y - killCount.height / 2
        
        const sword = new PIXI.Graphics(swordContext);
        sword.x = player.x + Math.cos(players[id].angle) * swordRadius;
        sword.y = player.y + Math.sin(players[id].angle) * swordRadius;
        sword.angle = players[id].angle
        sword.filters = new PIXI.BlurFilter({ strength: 1 });
        
        const gradientFill = new PIXI.FillGradient(0, 0, 150, 150);
        
        const swordArc = new PIXI.Graphics()
        if (players[id].rotationSpeed > 0) {
            gradientFill.addColorStop(1, 0xFFD700);
            gradientFill.addColorStop(0, 0x252620);
            swordArc.arc(0, 0, swordRadius, 0, -Math.PI/4, true)
        } else {
            gradientFill.addColorStop(0, 0xFFD700);
            gradientFill.addColorStop(1, 0x252620);    
            swordArc.arc(0, 0, swordRadius, Math.PI/4, 0, true)
        }

        swordArc.x = player.x
        swordArc.y = player.y
        swordArc.lineTo(0, 0)
        swordArc.fill(gradientFill)
        swordArc.alpha = 0.5
        swordArc.angle = players[id].angle * 360 / (2 * Math.PI)

        app.stage.addChild(swordArc);
        app.stage.addChild(sword);
        app.stage.addChild(player);
        app.stage.addChild(killCount);
        
        // Store the player and sword for later updates
        playerGraphics[id] = {player, sword, swordArc, killCount};
    }


    // Update all players' positions and sword rotation
    function updatePlayerGraphic(id) {
        if (playerGraphics[id] && players[id] && players[clientId]) {
            playerGraphics[id].player.x = app.screen.width / 2 + players[id].x - players[clientId].x
            playerGraphics[id].player.y = app.screen.height / 2 + players[id].y - players[clientId].y
            playerGraphics[id].killCount.text = players[id].killCount
            playerGraphics[id].killCount.x = playerGraphics[id].player.x - playerGraphics[id].killCount.width / 2
            playerGraphics[id].killCount.y = playerGraphics[id].player.y - playerGraphics[id].killCount.height / 2
            
            playerGraphics[id].sword.angle = players[id].angle
            playerGraphics[id].sword.x = playerGraphics[id].player.x + Math.cos(playerGraphics[id].sword.angle) * swordRadius;
            playerGraphics[id].sword.y = playerGraphics[id].player.y + Math.sin(playerGraphics[id].sword.angle) * swordRadius;
            playerGraphics[id].sword.rotation = playerGraphics[id].sword.angle + Math.PI / 2
            
            
            app.stage.removeChild(playerGraphics[id].swordArc);
            playerGraphics[id].swordArc = new PIXI.Graphics()
            if (players[id].rotationSpeed > 0) { // draw the sword arc
                playerGraphics[id].swordArc.arc(0, 0, swordRadius, 0, -Math.PI/4, true)
                playerGraphics[id].swordArc.lineTo(0, 0)
                const gradientFill = new PIXI.FillGradient(0, 0, 1, 1);
                gradientFill.addColorStop(1, 0xFFD700);
                gradientFill.addColorStop(0, 0x252620);
                playerGraphics[id].swordArc.fill(gradientFill)
            } else {
                playerGraphics[id].swordArc.arc(0, 0, swordRadius, Math.PI/4, 0, true)
                playerGraphics[id].swordArc.lineTo(0, 0)
                const gradientFill = new PIXI.FillGradient(0, 0, 1, -1);
                gradientFill.addColorStop(1, 0xFFD700);
                gradientFill.addColorStop(0, 0x252620);
                playerGraphics[id].swordArc.fill(gradientFill)
            }
            playerGraphics[id].swordArc.x = playerGraphics[id].player.x
            playerGraphics[id].swordArc.y = playerGraphics[id].player.y
            playerGraphics[id].swordArc.alpha = 0.5
            playerGraphics[id].swordArc.angle = players[id].angle * 360 / (2 * Math.PI)
            
            playerGraphics[id].swordArc.zIndex = 0
            playerGraphics[id].killCount.zIndex = 1
            playerGraphics[id].player.zIndex = 1
            playerGraphics[id].sword.zIndex = 1
            app.stage.addChild(playerGraphics[id].swordArc);
            app.stage.sortChildren();
        }
        updateLeaderboard()
    }

    function updateLeaderboard() {
        // sort players by killCount
        const ranking = Object.entries(players) .sort((a, b) => b[1].killCount - a[1].killCount)
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
        const {player, sword, swordArc, killCount} = playerGraphics[id];
        app.stage.removeChild(player);  // Remove player graphic
        app.stage.removeChild(killCount)
        app.stage.removeChild(sword);   // Remove sword graphic
        app.stage.removeChild(swordArc);
        
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
            killerId: clientId,
            victimId: id,
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

    // Main game loop to update sword position
    let lastKillTime = 0
    app.ticker.add((delta) => {
        if (!players[clientId]) return;

        for (let id in players) {
            players[id].angle += delta.deltaTime * players[id].rotationSpeed;
            updatePlayerGraphic(id)
        }
        
        //move client
        const d = distance(targetPosition, playerGraphics[clientId].player)
        if (d > 30) { // speed may change based on player computer speed
            // Smooth player movement towards the target position
            const speed = 5;
            const dx = targetPosition.x - playerGraphics[clientId].player.x;
            const dy = targetPosition.y - playerGraphics[clientId].player.y;
            //shift background
            players[clientId].x = Math.min(Math.max(0, players[clientId].x + (dx / d) * speed * delta.deltaTime), mapSize)
            background.x = -players[clientId].x
            players[clientId].y = Math.min(Math.max(0, players[clientId].y + (dy / d) * speed * delta.deltaTime), mapSize)
            background.y = -players[clientId].y
            coord.text = '(' + Math.round(players[clientId].x) + ', ' + Math.round(players[clientId].y) + ')'
            coord.x = app.screen.width - 10 - coord.width
        }

        
        // check for collisions
        for (let id in playerGraphics) {
            if (Date.now() - lastKillTime > 50 && players[clientId] && players[id] && id != clientId) {
                if (distance(playerGraphics[id].player, playerGraphics[clientId].sword) < playerRadius || distance(playerGraphics[id].player, {x: playerGraphics[clientId].player.x + Math.cos(playerGraphics[clientId].sword.angle) * swordRadius / 2, y: playerGraphics[clientId].player.y + Math.sin(playerGraphics[clientId].sword.angle) * swordRadius / 2}) < playerRadius || distance(playerGraphics[id].player, playerGraphics[clientId].player) < 2 * playerRadius) { // client kills player with id due to collision or 
                    killPlayer(id)
                    players[clientId].killCount += 1
                    players[clientId].rotationSpeed *= -1
                    lastKillTime = Date.now()
                } else if (doLineSegmentsIntersect(playerGraphics[id].player, playerGraphics[id].sword, playerGraphics[clientId].player, playerGraphics[clientId].sword)) { //swords connect and reflect backwards
                    socket.send(JSON.stringify({
                        type: 'collision',
                        id1: clientId,
                        id2: id,
                    }));
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
