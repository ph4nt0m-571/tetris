const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const messageRoutes = require('./routes/message');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/client', express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api', authRoutes);
app.use('/api', gameRoutes);
app.use('/api', messageRoutes);

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error'
    });
});

app.listen(PORT, () => {
    console.log(`HTTP Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}`);
});