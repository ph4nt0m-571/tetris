const express = require('express');
const Message = require('../models/Message');
const Game = require('../models/Game');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

//Send Chat Message
router.post('/message', authenticateToken, async (req, res) => {
    try {
        const { sender_id, game_id, message } = req.body;

        //Validation
        if (!sender_id || !message || message.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Empty message'
            });
        }

        //Verify sender is authenticated user
        if (req.user.id !== sender_id) {
            return res.status(403).json({
                status: 'error',
                message: 'Unauthorized sender'
            });
        }

        //If game_id provided, verify player is in game
        if (game_id) {
            const isInGame = await Game.isPlayerInGame(game_id, sender_id);
            if (!isInGame) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Unauthorized sender'
                });
            }
        }

        //Create message
        await Message.create(sender_id, game_id, message);

        res.status(200).json({
            status: 'success',
            message: 'Message sent'
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error sending message'
        });
    }
});

//Get Game Messages
router.get('/messages/:game_id', authenticateToken, async (req, res) => {
    try {
        const { game_id } = req.params;

        const messages = await Message.getGameMessages(parseInt(game_id));

        res.status(200).json({
            status: 'success',
            messages
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error getting messages'
        });
    }
});

//Get Lobby Messages
router.get('/lobby-messages', authenticateToken, async (req, res) => {
    try {
        const messages = await Message.getLobbyMessages();

        res.status(200).json({
            status: 'success',
            messages
        });
    } catch (error) {
        console.error('Get lobby messages error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error getting lobby messages'
        });
    }
});

module.exports = router;