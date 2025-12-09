class Client{
    constructor(conn, id){
        this.conn = conn;
        this.id = id;
        this.session = null;
        this.state = null;
        this.username = null;
        this.userId = null;
        this.inLobby = false;
    }

    broadcast(data){
        if(!this.session){
            throw new Error('Cannot broadcast without session');
        }

        data.clientId = this.id;

        this.session.clients.forEach(client => {
            if(this === client){
                return;
            }
            client.send(data);
        });
    }

    send(data){
        if (this.conn.readyState === 1) { //WebSocket.OPEN
            const msg = JSON.stringify(data);
            console.log(`Sending message to client ${this.id}: ${msg.substring(0, 100)}...`);
            this.conn.send(msg, function ack(err){
                if (err){
                    console.error('Message failed', err);
                } 
            });
        } else {
            console.warn(`Cannot send to client ${this.id}, connection not open (state: ${this.conn.readyState})`);
        }
    }
}
module.exports = Client;