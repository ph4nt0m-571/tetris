const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

//User Registration
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        //Validation
        if (!username || !email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing fields'
            });
        }

        //Check if username exists
        if (await User.usernameExists(username)) {
            return res.status(409).json({
                status: 'error',
                message: 'Username already exists'
            });
        }

        //Check if email exists
        if (await User.emailExists(email)) {
            return res.status(409).json({
                status: 'error',
                message: 'Email already exists'
            });
        }

        //Create user
        const userId = await User.create(username, email, password);

        res.status(201).json({
            status: 'success',
            message: 'Registration successful',
            userId
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error during registration'
        });
    }
});

//User Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        //Validation
        if (!username || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing fields'
            });
        }

        //Find user
        const user = await User.findByUsername(username);
        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials'
            });
        }

        //Verify password
        const isValid = await User.verifyPassword(password, user.password);
        if (!isValid) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials'
            });
        }

        //Generate JWT
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(200).json({
            status: 'success',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error during login'
        });
    }
});

module.exports = router;