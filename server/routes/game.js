const express = require('express');
const Game = require('../models/Game');
const User = require('../models/User');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

//Start Game
router.post('/start_game', authenticateToken, async (req, res) => {
    try {
        const { player_1_id, player_2_id } = req.body;

        //Validation
        if (!player_1_id || !player_2_id) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing player IDs'
            });
        }

        //Check if players exist
        const player1 = await User.findById(player_1_id);
        const player2 = await User.findById(player_2_id);

        if (!player1 || !player2) {
            return res.status(404).json({
                status: 'error',
                message: 'Player/Players not found'
            });
        }

        //Check for active game
        const activeGame = await Game.getActiveGameForPlayers(player_1_id, player_2_id);
        if (activeGame) {
            return res.status(409).json({
                status: 'error',
                message: 'Active game already exists',
                game_id: activeGame.id
            });
        }

        //Create game
        const gameId = await Game.create(player_1_id, player_2_id);

        res.status(201).json({
            status: 'game_started',
            game_id: gameId
        });
    } catch (error) {
        console.error('Start game error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error starting game'
        });
    }
});

//Submit Player Move
router.post('/move', authenticateToken, async (req, res) => {
    try {
        const { game_id, player_id, grid, lines_cleared, combo } = req.body;

        //Validation
        if (!game_id || !player_id || !grid) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing/Invalid IDs'
            });
        }

        //Check if player is in game
        const isInGame = await Game.isPlayerInGame(game_id, player_id);
        if (!isInGame) {
            return res.status(403).json({
                status: 'error',
                message: 'Player not in the game'
            });
        }

        //Check game status
        const game = await Game.findById(game_id);
        if (game.status === 'finished') {
            return res.status(409).json({
                status: 'error',
                message: 'Game Over'
            });
        }

        //Validate grid format
        if (!Array.isArray(grid) || grid.length !== 20 || !grid[0] || grid[0].length !== 12) {
            return res.status(422).json({
                status: 'error',
                message: 'Invalid grid/move format'
            });
        }

        //Update player state
        await Game.updatePlayerState(game_id, player_id, grid, lines_cleared || 0, combo || 0);

        //Update game status to playing if it was waiting
        if (game.status === 'waiting') {
            await Game.updateStatus(game_id, 'playing');
        }

        res.status(200).json({
            status: 'success',
            message: 'Move recorded'
        });
    } catch (error) {
        console.error('Submit move error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error submitting move'
        });
    }
});

//Get Game State
router.get('/game-state/:game_id/:player_id', authenticateToken, async (req, res) => {
    try {
        const { game_id, player_id } = req.params;

        //Check if player is in game
        const isInGame = await Game.isPlayerInGame(parseInt(game_id), parseInt(player_id));
        if (!isInGame) {
            return res.status(403).json({
                status: 'error',
                message: 'Not a player'
            });
        }

        //Get game state
        const gameState = await Game.getGameState(parseInt(game_id), parseInt(player_id));
        if (!gameState) {
            return res.status(404).json({
                status: 'error',
                message: 'Game not found'
            });
        }

        res.status(200).json(gameState);
    } catch (error) {
        console.error('Get game state error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error getting game state'
        });
    }
});

//End Game
router.post('/end_game', authenticateToken, async (req, res) => {
    try {
        const { game_id, winner_id } = req.body;

        if (!game_id || !winner_id) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing game_id or winner_id'
            });
        }

        await Game.setWinner(game_id, winner_id);

        res.status(200).json({
            status: 'success',
            message: 'Game ended'
        });
    } catch (error) {
        console.error('End game error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error ending game'
        });
    }
});

module.exports = router;