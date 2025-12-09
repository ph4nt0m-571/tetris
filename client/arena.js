class Arena{
    constructor(w, h){
        const matrix = [];
        while(h--){
            matrix.push(new Array(w).fill(0));
        }
        this.matrix = matrix;
        this.events = new Events();
    }


sweep()
{
    let rowCount = 1;
    let score = 0;
    let linesCleared = 0;
    
   outer: for(let y = this.matrix.length - 1; y > 0; y--){
        for(let x = 0; x < this.matrix[y].length; x++){
            if (this.matrix[y][x] === 0){
                continue outer;
            }
        }

        const row = this.matrix.splice(y, 1)[0].fill(0);
        this.matrix.unshift(row);
        y++;

        score += rowCount * 10;
        rowCount *= 2;
        linesCleared++;
    }
    
    //Return both score and lines cleared
    return { score, linesCleared };
}

clear(){
    this.matrix.forEach(row => row.fill(0));
    this.events.emit('matrix', this.matrix);
}

merge(player){
    player.matrix.forEach((row, y)=>{
        row.forEach((value, x)=>{
            if (value !==0){
                this.matrix[y+ player.pos.y][x+player.pos.x] = value;
            }
        });
    });
    this.events.emit('matrix', this.matrix);
}


collide(player){
    const [m, o]= [player.matrix, player.pos];
    for(let y = 0; y < m.length; y++){
        for (let x = 0; x < m[y].length; x++){
            if (m[y][x] !== 0 &&
                (this.matrix[y+o.y]&&
                this.matrix[y+o.y][x+o.x]) !==0){
                    return true;
                }
        }
    }
    return false;
}

addGarbage(lines){
    //Remove top rows
    this.matrix.splice(0, lines);
    
    //Add garbage rows at bottom
    for(let i = 0; i < lines; i++){
        const garbageRow = new Array(this.matrix[0].length).fill(8);
        //Add one random hole in each garbage line
        const holePos = Math.floor(Math.random() * this.matrix[0].length);
        garbageRow[holePos] = 0;
        this.matrix.push(garbageRow);
    }
    
    this.events.emit('matrix', this.matrix);
}


}