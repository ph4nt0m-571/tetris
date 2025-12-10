const express = require('express');
const db = require('../config/database');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

//Get Player Statistics
router.get('/stats/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('=== STATS REQUEST ===');
        console.log('Requested userId:', userId, 'Type:', typeof userId);

        const [gamesPlayed] = await db.execute(
            `SELECT COUNT(*) as total 
             FROM games 
             WHERE (player_1_id = ? OR player_2_id = ?) 
             AND status = 'finished'`,
            [parseInt(userId), parseInt(userId)]
        );
        
        console.log('Games played query result:', gamesPlayed);

        const [wins] = await db.execute(
            'SELECT COUNT(*) as total FROM games WHERE winner_id = ? AND status = "finished"',
            [parseInt(userId)]
        );
        
        console.log('Wins query result:', wins);

        const totalGames = parseInt(gamesPlayed[0].total) || 0;
        const totalWins = parseInt(wins[0].total) || 0;
        
        console.log('Final calculated stats - Games:', totalGames, 'Wins:', totalWins);

        res.status(200).json({
            status: 'success',
            total_games: totalGames,
            total_wins: totalWins
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error getting statistics',
            total_games: 0,
            total_wins: 0
        });
    }
});

module.exports = router;