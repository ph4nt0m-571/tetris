const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    static async create(username, email, password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.execute(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );
        return result.insertId;
    }

    static async findByUsername(username) {
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        return rows[0];
    }

    static async findByEmail(email) {
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await db.execute(
            'SELECT id, username, email, created_at FROM users WHERE id = ?',
            [id]
        );
        return rows[0];
    }

    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    static async usernameExists(username) {
        const [rows] = await db.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        return rows.length > 0;
    }

    static async emailExists(email) {
        const [rows] = await db.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );
        return rows.length > 0;
    }
}

module.exports = User;