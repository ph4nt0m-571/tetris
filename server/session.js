class Session{
    constructor(id){
        this.id = id;
        this.clients = new Set;
    }
    join(client){
        if(client.session){
            throw new Error('Client already in session');
        }
        this.clients.add(client);
        client.session = this;

        this.broadcastSession();
    }
    leave(client){
        if(client.session !== this){
            throw new Error('Client not in session');
        }
        this.clients.delete(client);
        client.session = null;

        this.broadcastSession();
    }

    broadcastSession(){
        const clients = [...this.clients];
        clients.forEach(client => {
            client.send({
                type: 'session-broadcast',
                peers: {
                    you: client.id,
                    clients: clients.map(client => {
                        return {
                            id: client.id,
                            state: client.state,
                        };
                    }),
                },
            });
        });
    }
}

module.exports = Session;