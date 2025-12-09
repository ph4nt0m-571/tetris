const tetrisManager = new TetrisManager(document);
const localTetris = tetrisManager.createPlayer();
localTetris.element.classList.add('local');

//Update label for local player
const localLabel = localTetris.element.querySelector('.player-label');
if (localLabel) {
    localLabel.textContent = 'You';
}

//Start the local game
localTetris.run();

const connectionManager = new ConnectionManager(tetrisManager);
//Connect without specifying address - will use same port as HTTP
connectionManager.connect();
connectionManager.localTetris = localTetris;

let isLocalPlayerAlive = true;

const keyListener = (event) => {
    if (!isLocalPlayerAlive) return;
    
    [
        [37, 39, 40, 67],
        [65, 68, 83, 16],
    ].forEach((key, index) =>{
        const player = localTetris.player;
        if(event.type === 'keydown'){
        if(event.keyCode === key[0]){
            player.move(-1);
        }else if(event.keyCode === key[1]){
            player.move(+1);
        }else if(event.keyCode === key[3]){
            player.rotate(-1)
        }
    }
        if(event.keyCode === key[2]){
            if(event.type === 'keydown'){
                if(player.dropInterval !== player.FASTDROP){
                    player.drop();
                    player.dropInterval = player.FASTDROP;
        }
        }else{
            player.dropInterval = player.SLOWDROP;
            }
        }
    });
};

document.addEventListener('keydown', keyListener);
document.addEventListener('keyup', keyListener);