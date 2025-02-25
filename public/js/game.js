import { distance, doLineSegmentsIntersect, getIntersectionPoint } from './geometry.js';

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
    const color = {};
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
                createPlayerGraphic(id);
            }
        }
        if (players[clientId]) {
            if (data.type === 'update') {
                for (let id in data.players) { // update every player except the client with server information
                    if (id != clientId) {
                        players[id] = data.players[id]
                        if (!playerGraphics[id]) {
                            createPlayerGraphic(id);
                        }
                    }
                }
            }
            if (data.type === 'kill') {
                if (data.killerId === clientId) {
                    players[clientId].killCount += 1
                    players[clientId].rotationSpeed *= -1
                }
                killPlayer(data.victimId)
            }
            if (data.type === 'collision') {
                players[data.id1].rotationSpeed *= -1
                players[data.id2].rotationSpeed *= -1
                //calculate the intersection point of 
                let intersection = getIntersectionPoint(playerGraphics[data.id1].player, playerGraphics[data.id1].sword, playerGraphics[data.id2].player, playerGraphics[data.id2].sword)
                if (intersection === null) {
                    intersection = getIntersectionPoint(playerGraphics[data.id2].player, playerGraphics[data.id2].sword, playerGraphics[data.id1].sword, playerGraphics[data.id1].sword.prev)
                }
                createSparks(intersection ? intersection : playerGraphics[clientId].sword)
            }
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
    function createPlayerGraphic(id) {
        const player = new PIXI.Graphics().circle(0, 0, playerRadius);
        color[id] = Math.random() * 0xFFFFFF
        player.fill(Math.floor(color[id]));
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


    // Update all players' positions, sword rotation, kill count
    function updatePlayerGraphic(id) {
        playerGraphics[id].player.x = app.screen.width / 2 + players[id].x - players[clientId].x
        playerGraphics[id].player.y = app.screen.height / 2 + players[id].y - players[clientId].y
        playerGraphics[id].killCount.text = players[id].killCount
        playerGraphics[id].killCount.x = playerGraphics[id].player.x - playerGraphics[id].killCount.width / 2
        playerGraphics[id].killCount.y = playerGraphics[id].player.y - playerGraphics[id].killCount.height / 2
        
        playerGraphics[id].sword.angle = players[id].angle
        playerGraphics[id].sword.x = playerGraphics[id].player.x + Math.cos(playerGraphics[id].sword.angle) * swordRadius;
        playerGraphics[id].sword.y = playerGraphics[id].player.y + Math.sin(playerGraphics[id].sword.angle) * swordRadius;
        //prev and sword connect to form a line that is used as collision bounds for the sword
        if (id == clientId) {
            playerGraphics[clientId].sword.prev = {x: players[clientId].rotationSpeed < 0 ? playerGraphics[clientId].player.x + Math.cos(playerGraphics[clientId].sword.angle + Math.PI / 16) * swordRadius : playerGraphics[clientId].player.x + Math.cos(playerGraphics[clientId].sword.angle - Math.PI / 16) * swordRadius, y: players[clientId].rotationSpeed < 0 ? playerGraphics[clientId].player.y + Math.sin(playerGraphics[clientId].sword.angle + Math.PI / 16) * swordRadius : playerGraphics[clientId].player.y + Math.sin(playerGraphics[clientId].sword.angle - Math.PI / 16) * swordRadius}
        }
        playerGraphics[id].sword.rotation = playerGraphics[id].sword.angle + Math.PI / 2
        
        //remove and add sword arc again
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
    function removePlayerGraphic(victimId) {
        const {player, sword, swordArc, killCount} = playerGraphics[victimId];
        app.stage.removeChild(player);  // Remove player graphic
        app.stage.removeChild(killCount)
        app.stage.removeChild(sword);   // Remove sword graphic
        app.stage.removeChild(swordArc);
        
        // Delete the player from the dicts
        delete color[victimId]
        delete players[victimId];
        delete playerGraphics[victimId];
    }

    //executed when a player is killed
    function killPlayer(victimId) {
        // Remove the player and sword from the stage
        createSparks(playerGraphics[victimId].player, true, victimId)
        removePlayerGraphic(victimId)
        
        if (victimId == clientId) {
            //remove all player graphics
            for (let id in playerGraphics) {
                removePlayerGraphic(id)
            }
            menu();
        }
    }

    //kill the client player on refresh
    window.addEventListener("beforeunload", () => {
        socket.send(JSON.stringify({
            type: 'kill',
            killerId: clientId,
            victimId: clientId,
        }));
    })

    // Handle mouse movement to send to server
    app.stage.on('pointermove', (event) => {
        targetPosition = event.data.global; // Set the new target position
    });

    // Function to generate sparks on sword clash
    function createSparks(sword, playerDeath = false, id = null) {
        const sparkCount = playerDeath ? 60 : 20; // More sparks for larger effect
        const sparkSize = playerDeath ? 10 : 1; // Larger sparks when 'isLargeSparks' is true
        const sparkColor = playerDeath ? color[id] : 0xFFD700; // Use victim's color for large sparks

        for (let i = 0; i < sparkCount; i++) {
            const spark = new PIXI.Graphics();
            spark.beginFill(sparkColor); // Spark color (gold)
            spark.drawCircle(sword.x, sword.y, sparkSize + Math.random() * 4); // Random spark size
            spark.endFill();

            // Add random velocity to the sparks
            const angle = Math.random() * Math.PI * 2; // Random angle
            const speed = playerDeath? Math.random() * 5: Math.random() * 5 + 5; // Random speed
            spark.vx = Math.cos(angle) * speed;
            spark.vy = Math.sin(angle) * speed;

            // Add spark to the stage
            app.stage.addChild(spark);

            // Animate the spark (move and fade out)
            app.ticker.add(function animateSpark() {
                spark.x += spark.vx;
                spark.y += spark.vy;
                spark.alpha -= playerDeath ? 0.01 : 0.05; // Fade out
                spark.scale.x *= 0.95; // Shrink
                spark.scale.y *= 0.95;

                // Remove spark once it's fully faded out
                if (spark.alpha <= 0) {
                    app.stage.removeChild(spark);
                }
            });
        }
    }

    // Main game loop to update sword position
    app.ticker.add((delta) => {
        if (!players[clientId]) return;

        for (let id in players) { //change angle of every players sword
            players[id].angle += delta.deltaTime * players[id].rotationSpeed;
            updatePlayerGraphic(id)
        }
        
        //move client
        const d = distance(targetPosition, playerGraphics[clientId].player)
        if (d > 30) { // speed may change based on player computer speed
            const speed = 5;
            // Smooth player movement towards the target position
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
            if (id != clientId) {
                //checks if tip or a point halfway towards the tip intersects another player or if a player body intersects the client body
                if (distance(playerGraphics[id].player, playerGraphics[clientId].sword) < playerRadius || distance(playerGraphics[id].player, {x: playerGraphics[clientId].player.x + Math.cos(playerGraphics[clientId].sword.angle) * swordRadius / 2, y: playerGraphics[clientId].player.y + Math.sin(playerGraphics[clientId].sword.angle) * swordRadius / 2}) < playerRadius || distance(playerGraphics[id].player, playerGraphics[clientId].player) < 1.7 * playerRadius) {
                    socket.send(JSON.stringify({
                        type: 'kill',
                        killerId: clientId,
                        victimId: id,
                    }));
                //check if players swords collide
                } else if (doLineSegmentsIntersect(playerGraphics[id].player, playerGraphics[id].sword, playerGraphics[clientId].player, playerGraphics[clientId].sword) || doLineSegmentsIntersect(playerGraphics[id].player, playerGraphics[id].sword, playerGraphics[clientId].sword, playerGraphics[clientId].sword.prev)) {
                    socket.send(JSON.stringify({
                        type: 'collision',
                        id1: clientId,
                        id2: id,
                    }));
                }
            }
        }
        //update server with new client
        socket.send(JSON.stringify({
            type: 'move',
            id: clientId,
            player: players[clientId],
        }));
    });
})();
