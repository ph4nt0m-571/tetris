const db = require('../config/database');

class Message {
    static async create(senderId, gameId, message) {
        const [result] = await db.execute(
            'INSERT INTO messages (sender_id, game_id, message) VALUES (?, ?, ?)',
            [senderId, gameId, message]
        );
        return result.insertId;
    }

    static async getGameMessages(gameId) {
        const [rows] = await db.execute(
            `SELECT m.*, u.username 
             FROM messages m 
             JOIN users u ON m.sender_id = u.id 
             WHERE m.game_id = ? 
             ORDER BY m.created_at ASC`,
            [gameId]
        );
        return rows;
    }

    static async getLobbyMessages() {
        const [rows] = await db.execute(
            `SELECT m.*, u.username 
             FROM messages m 
             JOIN users u ON m.sender_id = u.id 
             WHERE m.game_id IS NULL 
             ORDER BY m.created_at DESC 
             LIMIT 50`
        );
        return rows.reverse();
    }
}

module.exports = Message;