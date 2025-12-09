const db = require('../config/database');

class Game {
    static async create(player1Id, player2Id) {
        const [result] = await db.execute(
            'INSERT INTO games (player_1_id, player_2_id, status) VALUES (?, ?, ?)',
            [player1Id, player2Id, 'waiting']
        );
        
        const gameId = result.insertId;
        
        //Initialize game states for both players
        const emptyGrid = JSON.stringify(Array(20).fill(null).map(() => Array(12).fill(0)));
        
        await db.execute(
            'INSERT INTO game_states (game_id, player_id, grid, score, is_alive) VALUES (?, ?, ?, 0, TRUE)',
            [gameId, player1Id, emptyGrid]
        );
        
        await db.execute(
            'INSERT INTO game_states (game_id, player_id, grid, score, is_alive) VALUES (?, ?, ?, 0, TRUE)',
            [gameId, player2Id, emptyGrid]
        );
        
        return gameId;
    }

    static async findById(gameId) {
        const [rows] = await db.execute(
            'SELECT * FROM games WHERE id = ?',
            [gameId]
        );
        return rows[0];
    }

    static async getActiveGameForPlayers(player1Id, player2Id) {
        const [rows] = await db.execute(
            `SELECT * FROM games 
             WHERE (player_1_id = ? AND player_2_id = ?) 
                OR (player_1_id = ? AND player_2_id = ?)
             AND status IN ('waiting', 'playing')`,
            [player1Id, player2Id, player2Id, player1Id]
        );
        return rows[0];
    }

    static async updateStatus(gameId, status) {
        await db.execute(
            'UPDATE games SET status = ? WHERE id = ?',
            [status, gameId]
        );
    }

    static async setWinner(gameId, winnerId) {
        await db.execute(
            'UPDATE games SET status = ?, winner_id = ?, ended_at = NOW() WHERE id = ?',
            ['finished', winnerId, gameId]
        );
    }

    static async getGameState(gameId, playerId) {
        const game = await this.findById(gameId);
        if (!game) return null;

        const [states] = await db.execute(
            'SELECT * FROM game_states WHERE game_id = ?',
            [gameId]
        );

        const player1State = states.find(s => s.player_id === game.player_1_id);
        const player2State = states.find(s => s.player_id === game.player_2_id);

        return {
            game_id: gameId,
            status: game.status,
            player_1: {
                player_id: game.player_1_id,
                grid: JSON.parse(player1State.grid),
                score: player1State.score,
                is_alive: player1State.is_alive
            },
            player_2: {
                player_id: game.player_2_id,
                grid: JSON.parse(player2State.grid),
                score: player2State.score,
                is_alive: player2State.is_alive
            }
        };
    }

    static async updatePlayerState(gameId, playerId, grid, linesCleared, combo) {
        const gridJson = JSON.stringify(grid);
        const [currentState] = await db.execute(
            'SELECT score FROM game_states WHERE game_id = ? AND player_id = ?',
            [gameId, playerId]
        );

        const newScore = currentState[0].score + (linesCleared * 100 * (combo || 1));

        await db.execute(
            'UPDATE game_states SET grid = ?, score = ? WHERE game_id = ? AND player_id = ?',
            [gridJson, newScore, gameId, playerId]
        );

        //Record the move
        const moveData = JSON.stringify({ grid, linesCleared, combo });
        await db.execute(
            'INSERT INTO moves (game_id, player_id, move_data, lines_cleared, combo) VALUES (?, ?, ?, ?, ?)',
            [gameId, playerId, moveData, linesCleared, combo]
        );
    }

    static async setPlayerDead(gameId, playerId) {
        await db.execute(
            'UPDATE game_states SET is_alive = FALSE WHERE game_id = ? AND player_id = ?',
            [gameId, playerId]
        );
    }

    static async isPlayerInGame(gameId, playerId) {
        const game = await this.findById(gameId);
        return game && (game.player_1_id === playerId || game.player_2_id === playerId);
    }
}

module.exports = Game;