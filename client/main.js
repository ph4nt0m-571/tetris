const tetrisManager = new TetrisManager(document);
const localTetris = tetrisManager.createPlayer();
localTetris.element.classList.add('local');
localTetris.run();

const connectionManager = new ConnectionManager(tetrisManager);
connectionManager.connect('ws://localhost:9000');
connectionManager.localTetris = localTetris;

const keyListener = (event) => {
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