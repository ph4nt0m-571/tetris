const WebSocketServer = require('ws').Server;
const Session = require('./session');
const Client = require('./client');
require('dotenv').config();

const WS_PORT = process.env.WS_PORT || 9000;
const server = new WebSocketServer({ port: WS_PORT });

const sessions = new Map();

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

server.on('connection', conn => {
    console.log('WebSocket connection established');
    const client = createClient(conn);

    conn.on('message', msg => {
        console.log('WebSocket message received:', msg);
        const data = JSON.parse(msg);

        if (data.type === 'create-session') {
            const session = new Session(createId());
            sessions.set(session.id, session);

            session.join(client);
            client.state = data.state;

            client.send({
                type: 'session-created',
                id: session.id,
            });
        } else if (data.type === 'join-session') {
            const session = sessions.get(data.id);
            if (session) {
                session.join(client);
                client.state = data.state;
            } else {
                console.error('Session not found:', data.id);
                client.send({
                    type: 'session-error',
                    message: 'Session not found'
                });
            }
        } else if (data.type === 'state-update') {
            if (client.state && client.state[data.fragment]) {
                const [prop, value] = data.state;
                client.state[data.fragment][prop] = value;
                client.broadcast(data);
            }
        } else if (data.type === 'chat-message') {
            //Handle chat messages via WebSocket
            if (client.session) {
                client.broadcast({
                    type: 'chat-message',
                    message: data.message,
                    sender: client.id,
                    timestamp: Date.now()
                });
            }
        }
    });

    conn.on('close', () => {
        console.log('WebSocket connection closed');
        const session = client.session;
        if (session) {
            session.leave(client);
            if (session.clients.size === 0) {
                sessions.delete(session.id);
            }
        }
    });

    conn.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

console.log(`WebSocket Server running on port ${WS_PORT}`);
console.log(`Connect via ws://localhost:${WS_PORT}`);