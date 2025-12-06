class Tetris{
    constructor(element){

        this.element = element
        this.canvas = element.querySelector('canvas');
        this.context = this.canvas.getContext('2d');
        this.context.scale(20, 20);

        this.arena = new Arena(12, 20);

        this.player = new Player(this);


        this.colors = [
            null, 
            'purple',
            'yellow',
            'orange',
            'blue',
            'cyan',
            'green',
            'red',
            'grey',
        ];

        let lastTime=0;
        const update = (time = 0) => {
        const deltaTime = time - lastTime;
            lastTime = time;

            this.player.update(deltaTime);

            this.draw();
            requestAnimationFrame(update);
        }

        this._updateProxy = update;
    }

    run(){
        this._updateProxy();
    }

    serialize(){
        return {
            arena: {
                matrix: this.arena.matrix,
            },
            player: {
                matrix: this.player.matrix,
                pos: this.player.pos,
                score: this.player.score,
            },
        };
    }

    unserialize(state){
        this.arena.matrix = state.arena.matrix;
        this.player.matrix = state.player.matrix;
        this.player.pos = state.player.pos;
        this.player.score = state.player.score;
        this.updateScore(this.player.score);
        this.draw();
    }

draw(){
    this.context.fillStyle = '#000';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawMatrix(this.arena.matrix, {x:0, y:0});
    this.drawMatrix(this.player.matrix, this.player.pos);
}

drawMatrix(matrix, offset){
matrix.forEach((row, y)=>{
    row.forEach((value, x)=>{
        if(value !== 0){
            this.context.fillStyle = this.colors[value];
            this.context.fillRect(x + offset.x, 
                             y + offset.y, 1, 1);
        }
    });
});
}

updateScore(score){
    this.element.querySelector('.score').innerText = `Score: ${score}`;
}


}