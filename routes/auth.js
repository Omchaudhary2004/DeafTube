const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'deaftube_secret_2024';

// Register
router.post('/register', async (req, res) => {
    const { username, email, password, sign_language } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields required' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = uuidv4();
        db.run(
            'INSERT INTO users (id, username, email, password, sign_language) VALUES (?, ?, ?, ?, ?)',
            [id, username, email, hashedPassword, sign_language || 'ASL'],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Username or email already exists' });
                    }
                    return res.status(500).json({ error: 'Registration failed' });
                }
                const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' });
                res.json({ token, user: { id, username, email, sign_language: sign_language || 'ASL' } });
            }
        );
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, sign_language: user.sign_language } });
    });
});

// Get current user
router.get('/me', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        db.get('SELECT id, username, email, avatar, bio, sign_language, subscribers, created_at FROM users WHERE id = ?', [decoded.id], (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'User not found' });
            res.json(user);
        });
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;
