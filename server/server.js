const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();

const db = require('./config/database');

const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const messageRoutes = require('./routes/message');
const statsRoutes = require('./routes/stats');
const Session = require('./session');
const Client = require('./client');

const sessions = new Map();
const lobbyClients = new Map();
const gameSessions = new Map();

const app = express();
const PORT = process.env.PORT || 3000;

//Create HTTP server
const server = http.createServer(app);

//Create WebSocket server on same port
const wss = new WebSocket.Server({ server });

//Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/client', express.static(path.join(__dirname, '../client')));
app.use('/audio', express.static(path.join(__dirname, '../audio')));

//API Routes
app.use('/api', authRoutes);
app.use('/api', gameRoutes);
app.use('/api', messageRoutes);
app.use('/api', statsRoutes);

//Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

//Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

//404 handler
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
});

//Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error'
    });
});

//WebSocket handling
function createId(len = 6, chars = 'abcdefghjkmnopqrstwxyz0123456789') {
    let id = '';
    while (len--) {
        id += chars[Math.random() * chars.length | 0];
    }
    return id;
}

function createClient(conn, id = createId()) {
    return new Client(conn, id);
}

function broadcastLobbyState() {
    const players = Array.from(lobbyClients.values()).map(client => ({
        id: client.id,
        username: client.username,
        userId: client.userId
    }));

    lobbyClients.forEach(client => {
        if (client.conn.readyState === WebSocket.OPEN) {
            client.send({
                type: 'lobby-state',
                yourId: client.id,
                players: players
            });
        }
    });
}

function broadcastToLobby(data, excludeClient = null) {
    lobbyClients.forEach(client => {
        if (client !== excludeClient && client.conn.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

wss.on('connection', (conn) => {
    console.log('WebSocket connection established');
    const client = createClient(conn);

    conn.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);

            if (data.type === 'join-lobby') {
                client.username = data.username;
                client.userId = data.userId;
                client.inLobby = true;
                lobbyClients.set(client.id, client);
                console.log(`${client.username} joined lobby. Total players: ${lobbyClients.size}`);
                broadcastLobbyState();
            } 
            else if (data.type === 'chat-message') {
                console.log(`Chat from ${client.username}: ${data.message}`);
                broadcastToLobby({
                    type: 'chat-message',
                    username: client.username || 'Unknown',
                    message: data.message
                }, client); //exclude sender
            }
            else if (data.type === 'start-game') {
                const players = Array.from(lobbyClients.values()).slice(0, 2);
                
                if (players.length >= 2) {
                    const sessionId = createId();
                    const session = new Session(sessionId);
                    sessions.set(sessionId, session);
                    gameSessions.set(sessionId, true); //Mark as game session

                    console.log(`Starting game ${sessionId} with ${players[0].username} and ${players[1].username}`);

                    //Just send them the session ID - they'll join when they redirect
                    players.forEach(player => {
                        player.send({
                            type: 'game-start',
                            sessionId: sessionId
                        });
                    });
                } else {
                    client.send({
                        type: 'error',
                        message: 'Not enough players to start game'
                    });
                }
            }
            else if (data.type === 'create-session') {
                const session = new Session(createId());
                sessions.set(session.id, session);
                
                if (data.username) {
                    client.username = data.username;
                }
                if (data.userId) {
                    client.userId = data.userId;
                }
                
                session.join(client);
                client.isAlive = true;
                client.state = data.state;
                
                console.log(`${client.username || client.id} (userId: ${client.userId}) created session ${session.id}`);
                
                client.send({
                    type: 'session-created',
                    id: session.id,
                });
            }
            else if (data.type === 'join-session') {
                const session = sessions.get(data.id);
                if (session) {
                    if (client.inLobby) {
                        lobbyClients.delete(client.id);
                        client.inLobby = false;
                        broadcastLobbyState();
                    }
                    
                    if (data.username) {
                        client.username = data.username;
                    }
                    if (data.userId) {
                        client.userId = data.userId;
                    }
                    
                    session.join(client);
                    client.isAlive = true;
                    client.state = data.state;
                    
                    console.log(`${client.username || client.id} (userId: ${client.userId}) joined session ${data.id}`);
                } else {
                    console.error('Session not found:', data.id);
                    client.send({
                        type: 'session-error',
                        message: 'Session not found'
                    });
                }
            }
            else if (data.type === 'state-update') {
                if (client.isAlive && client.state && client.state[data.fragment]) {
                    const [prop, value] = data.state;
                    client.state[data.fragment][prop] = value;
                    
                    if (data.fragment === 'player' && prop === 'score' && data.linesCleared >= 2) {
                        const garbageLines = data.linesCleared - 1;
                        client.broadcast({
                            type: 'garbage-attack',
                            lines: garbageLines,
                            fromPlayer: client.id
                        });
                    }
                    
                    client.broadcast(data);
                }
            }
            else if (data.type === 'player-died') {
                client.isAlive = false;
                console.log(`Player ${client.username} (ID: ${client.userId}) died`);
                
                const session = client.session;
                if (session) {
                    const allPlayers = Array.from(session.clients);
                    const alivePlayers = allPlayers.filter(c => c.isAlive);
                    
                    //Broadcast that this player died
                    client.broadcast({
                        type: 'player-died',
                        playerId: client.id
                    });
                    
                    //Check if game is over
                    if (allPlayers.length === 2) {
                        const deadPlayer = client;
                        const winner = alivePlayers[0] || null;
                        
                        console.log(`Game over! Winner: ${winner ? winner.username : 'None'} (ID: ${winner ? winner.userId : 'N/A'}), Loser: ${deadPlayer.username} (ID: ${deadPlayer.userId})`);
                        
                        //Prepare complete winner and loser data
                        const winnerData = winner ? {
                            id: winner.id,
                            username: winner.username,
                            userId: winner.userId,
                            score: winner.state && winner.state.player ? winner.state.player.score : 0
                        } : null;
                        
                        const loserData = {
                            id: deadPlayer.id,
                            username: deadPlayer.username,
                            userId: deadPlayer.userId,
                            score: deadPlayer.state && deadPlayer.state.player ? deadPlayer.state.player.score : 0
                        };
                        
                        (async () => {
                            try {
                                if (winnerData && winnerData.userId && loserData.userId) {
                                    console.log(`Saving game to database - Winner ID: ${winnerData.userId}, Loser ID: ${loserData.userId}`);
                                    
                                    //Insert game record
                                    const [gameResult] = await db.execute(
                                        'INSERT INTO games (player_1_id, player_2_id, status, winner_id, ended_at) VALUES (?, ?, ?, ?, NOW())',
                                        [winnerData.userId, loserData.userId, 'finished', winnerData.userId]
                                    );
                                    
                                    console.log(`✓ Game saved successfully with ID: ${gameResult.insertId}`);
                                    
                                    //Save game states
                                    const gameId = gameResult.insertId;
                                    const emptyGrid = JSON.stringify(Array(20).fill(null).map(() => Array(12).fill(0)));
                                    
                                    await db.execute(
                                        'INSERT INTO game_states (game_id, player_id, grid, score, is_alive) VALUES (?, ?, ?, ?, ?)',
                                        [gameId, winnerData.userId, emptyGrid, winnerData.score, true]
                                    );
                                    
                                    await db.execute(
                                        'INSERT INTO game_states (game_id, player_id, grid, score, is_alive) VALUES (?, ?, ?, ?, ?)',
                                        [gameId, loserData.userId, emptyGrid, loserData.score, false]
                                    );
                                    
                                    console.log(`✓ Game states saved for game ${gameId}`);
                                } else {
                                    console.error('Cannot save game - missing userId:', { winnerData, loserData });
                                }
                            } catch (err) {
                                console.error('Failed to save game to database:', err);
                            }
                        })();
                        
                        console.log('Sending game-over with winner:', winnerData, 'loser:', loserData);
                        
                        //Send game-over to ALL players in session
                        session.clients.forEach(c => {
                            c.send({
                                type: 'game-over',
                                winner: winnerData,
                                loser: loserData
                            });
                        });
                        
                        //Clean up after 5 seconds
                        setTimeout(() => {
                            session.clients.forEach(c => {
                                c.send({ type: 'return-to-lobby' });
                            });
                            sessions.delete(session.id);
                            gameSessions.delete(session.id);
                            console.log(`Session ${session.id} cleaned up`);
                        }, 5000);
                    }
                }
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    conn.on('close', () => {
        console.log('WebSocket connection closed');
        
        if (client.inLobby && lobbyClients.has(client.id)) {
            console.log(`${client.username} left lobby`);
            lobbyClients.delete(client.id);
            broadcastLobbyState();
        }
        
        const session = client.session;
        if (session) {
            //If player disconnects during game, they lose
            if (client.isAlive && gameSessions.has(session.id)) {
                client.isAlive = false;
                const alivePlayers = Array.from(session.clients).filter(c => c.isAlive && c !== client);
                
                if (alivePlayers.length === 1) {
                    const winner = alivePlayers[0];
                    
                    const winnerData = {
                        id: winner.id,
                        username: winner.username,
                        userId: winner.userId,
                        score: winner.state && winner.state.player ? winner.state.player.score : 0
                    };
                    
                    const loserData = {
                        id: client.id,
                        username: client.username,
                        userId: client.userId,
                        score: client.state && client.state.player ? client.state.player.score : 0
                    };
                    
                    (async () => {
                        try {
                            if (winnerData.userId && loserData.userId) {
                                console.log(`Saving game to database (disconnect) - Winner ID: ${winnerData.userId}, Loser ID: ${loserData.userId}`);
                                
                                const [gameResult] = await db.execute(
                                    'INSERT INTO games (player_1_id, player_2_id, status, winner_id, ended_at) VALUES (?, ?, ?, ?, NOW())',
                                    [winnerData.userId, loserData.userId, 'finished', winnerData.userId]
                                );
                                
                                console.log(`✓ Game saved on disconnect with ID: ${gameResult.insertId}`);
                                
                                //Save game states
                                const gameId = gameResult.insertId;
                                const emptyGrid = JSON.stringify(Array(20).fill(null).map(() => Array(12).fill(0)));
                                
                                await db.execute(
                                    'INSERT INTO game_states (game_id, player_id, grid, score, is_alive) VALUES (?, ?, ?, ?, ?)',
                                    [gameId, winnerData.userId, emptyGrid, winnerData.score, true]
                                );
                                
                                await db.execute(
                                    'INSERT INTO game_states (game_id, player_id, grid, score, is_alive) VALUES (?, ?, ?, ?, ?)',
                                    [gameId, loserData.userId, emptyGrid, loserData.score, false]
                                );
                                
                                console.log(`✓ Game states saved on disconnect for game ${gameId}`);
                            }
                        } catch (err) {
                            console.error('Failed to save game on disconnect:', err);
                        }
                    })();
                    
                    session.clients.forEach(c => {
                        if (c !== client) {
                            c.send({
                                type: 'game-over',
                                winner: winnerData,
                                loser: loserData
                            });
                        }
                    });
                    
                    setTimeout(() => {
                        session.clients.forEach(c => {
                            if (c !== client) {
                                c.send({ type: 'return-to-lobby' });
                            }
                        });
                        sessions.delete(session.id);
                        gameSessions.delete(session.id);
                    }, 3000);
                }
            }
            
            session.leave(client);
            
            if (session.clients.size === 0) {
                sessions.delete(session.id);
                gameSessions.delete(session.id);
                console.log(`Session ${session.id} removed (no players)`);
            }
        }
    });

    conn.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

//Start server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`HTTP: http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}`);
});