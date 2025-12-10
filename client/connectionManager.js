class ConnectionManager{
    constructor(tetrisManager){
        this.conn = null;
        this.peers = new Map();
        this.tetrisManager = tetrisManager;
        this.localTetris = null;
        this.sessionFromLobby = false;
    }

    connect(address){
        //If no address provided, use same host/port as HTTP
        if (!address) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            address = `${protocol}//${window.location.host}`;
        }
        
        const sessionId = window.location.hash.split('#')[1];
        if(sessionId){
            this.sessionFromLobby = true;
            console.log('Coming from lobby with session:', sessionId);
        }
        
        console.log('Connecting to WebSocket:', address);
        this.conn = new WebSocket(address);

        this.conn.addEventListener('open', () => {
            console.log('Connection established');
            this.initSession();
            this.watchEvents();
        });

        this.conn.addEventListener('message', (event) => {
            this.receive(event.data);
        });

        this.conn.addEventListener('error', (error) => {
            console.error('WebSocket connection error:', error);
        });

        this.conn.addEventListener('close', () => {
            console.log('WebSocket connection closed');
        });
    }
    
    initSession(){
    const sessionId = window.location.hash.split('#')[1];
    const state = this.localTetris.serialize();
    
    //Get user info from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if(sessionId){
        console.log('Joining session from URL:', sessionId);
        //Send user info along with join request
        this.send({
            type: 'join-session',
            id: sessionId,
            state,
            username: user.username,
            userId: user.id
        });
    }else{
        console.log('Creating new session');
        this.send({
            type:'create-session',
            state,
            username: user.username,
            userId: user.id
        });
    }
}

    watchEvents(){
        const player = this.localTetris.player;
        
        //Watch position changes
        player.events.listen('pos', value => {
            this.send({
                type: 'state-update',
                fragment: 'player',
                state: ['pos', value],
            });
        });
        
        //Watch matrix changes
        player.events.listen('matrix', value => {
            this.send({
                type: 'state-update',
                fragment: 'player',
                state: ['matrix', value],
            });
        });
        
        player.events.listen('score', (value, linesCleared) => {
            this.send({
                type: 'state-update',
                fragment: 'player',
                state: ['score', value],
                linesCleared: linesCleared || 0
            });
        });
        
        player.events.listen('game-over', () => {
            console.log('Local player died!');
            isLocalPlayerAlive = false; 
            
            //Notify server
            this.send({
                type: 'player-died'
            });
            
            this.showDeathOverlay();
        });

        const arena = this.localTetris.arena;
        arena.events.listen('matrix', value => {
            this.send({
                type: 'state-update',
                fragment: 'arena',
                state: ['matrix', value],
            });
        });
    }

    updateManager(peers){
        const me = peers.you;
        const clients = peers.clients.filter(client => me !== client.id);
        
        clients.forEach(client => {
            if(!this.peers.has(client.id)){
                const tetris = this.tetrisManager.createPlayer();
                
                //Mark as remote player
                tetris.element.classList.add('remote');
                tetris.element.classList.remove('local');
                
                //Update player label to show opponent
                const label = tetris.element.querySelector('.player-label');
                if (label) {
                    label.textContent = 'Opponent';
                }
                
                //Only unserialize if state exists and is valid
                if (client.state && client.state.arena && client.state.player) {
                    tetris.unserialize(client.state);
                }
                
                //Add to peers map
                this.peers.set(client.id, tetris);
                
                console.log('Created opponent player view');
            }
        });

        [...this.peers.entries()].forEach(([id, tetris]) => {
            if(!clients.some(client => client.id === id)){
                this.tetrisManager.removePlayer(tetris);
                this.peers.delete(id);
            }
        });

        const sorted = peers.clients.map(client => {
            return this.peers.get(client.id) || this.localTetris;
        });
        this.tetrisManager.sortPlayers(sorted);
    }

    updatePeer(id, fragment, [prop, value]){
        if(!this.peers.has(id)){
            console.warn('Client does not exist:', id);
            return;
        }

        const tetris = this.peers.get(id);
        
        //Update the state
        tetris[fragment][prop] = value;

        if(prop === 'score'){
            tetris.updateScore(value);
        } else {
            //Redraw the opponent's board
            tetris.draw();
        }
    }

    receive(msg){
        const data = JSON.parse(msg);
        
        if(data.type === 'session-created'){
            console.log('Session created:', data.id);
            if(!this.sessionFromLobby){
                window.location.hash = data.id;
            }
        } 
        else if(data.type === 'session-broadcast'){
            this.updateManager(data.peers);
        } 
        else if(data.type === 'state-update'){
            this.updatePeer(data.clientId, data.fragment, data.state);
        } 
        else if(data.type === 'session-error'){
            console.error('Session error:', data.message);
            //Don't auto-create session, go back to lobby
            alert('Could not join game session. Returning to lobby...');
            window.location.href = 'lobby.html';
        }
        else if(data.type === 'garbage-attack'){
            console.log(`Receiving ${data.lines} garbage lines!`);
            this.localTetris.arena.addGarbage(data.lines);
        }
        else if(data.type === 'player-died'){
            console.log('Opponent died');
            const opponentTetris = this.peers.get(data.playerId);
            if(opponentTetris){
                const status = opponentTetris.element.querySelector('.game-status');
                if(status){
                    status.textContent = 'DEAD';
                    status.style.color = '#ff0000';
                }
            }
        }
        else if(data.type === 'game-over'){
            console.log('Game over received!', 'Winner:', data.winner, 'Loser:', data.loser);
            
            //Stop local game
            this.localTetris.player.gameActive = false;
            
            //Verify we have winner data
            if (!data.winner) {
                console.error('No winner data received!');
                alert('Game ended but no winner determined');
                window.location.href = 'lobby.html';
                return;
            }
            
            //Show the appropriate screen
            this.showGameOverScreen(data.winner, data.loser);
        }
        else if(data.type === 'return-to-lobby'){
            console.log('Returning to lobby...');
            window.location.href = 'lobby.html';
        }
    }

    send(data){
        if (this.conn && this.conn.readyState === WebSocket.OPEN) {
            const msg = JSON.stringify(data);
            this.conn.send(msg);
        }
    }
    
    showDeathOverlay(){
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            color: white;
            font-size: 3em;
            font-weight: bold;
        `;
        overlay.textContent = 'YOU DIED';
        document.body.appendChild(overlay);
    }
    
    
showGameOverScreen(winner, loser){
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    const isWinner = winner && (
        (winner.userId && winner.userId === user.id) || 
        (winner.username === user.username)
    );
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        color: white;
        text-align: center;
    `;
    
    if (isWinner) {
        //WINNER SCREEN - Show winner's own score
        const myScore = winner.score || (this.localTetris && this.localTetris.player ? this.localTetris.player.score : 0);
        
        overlay.innerHTML = `
            <div style="font-size: 4em; font-weight: bold; margin-bottom: 20px; color: #0f0;">
                WINNER!
            </div>
            <div style="font-size: 2em; margin-bottom: 20px;">
                ${user.username}
            </div>
            <div style="font-size: 1.5em; margin-bottom: 40px;">
                Your Score: ${myScore}
            </div>
            <div style="font-size: 1.2em; color: #aaa;">
                Returning to lobby in 5 seconds...
            </div>
        `;
    } else {
        //DEFEAT SCREEN - Show loser's own score and winner's name
        const myScore = this.localTetris && this.localTetris.player ? this.localTetris.player.score : 0;
        const winnerName = winner ? winner.username : 'Unknown';
        
        overlay.innerHTML = `
            <div style="font-size: 4em; font-weight: bold; margin-bottom: 20px; color: #ff6b6b;">
                DEFEAT
            </div>
            <div style="font-size: 1.5em; margin-bottom: 20px;">
                Your Score: ${myScore}
            </div>
            <div style="font-size: 2em; margin-bottom: 40px; color: #ffa500;">
                Defeated by: ${winnerName}
            </div>
            <div style="font-size: 1.2em; color: #aaa;">
                Returning to lobby in 5 seconds...
            </div>
        `;
    }
    
    document.body.appendChild(overlay);
}
}