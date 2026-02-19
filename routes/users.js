const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const auth = require('../middleware/auth');

const avatarStorage = multer.diskStorage({
    destination: 'uploads/avatars/',
    filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const uploadAvatar = multer({ storage: avatarStorage });

// Get user profile
router.get('/:id', (req, res) => {
    db.get(
        'SELECT id, username, email, avatar, bio, sign_language, subscribers, created_at FROM users WHERE id = ?',
        [req.params.id],
        (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'User not found' });
            res.json(user);
        }
    );
});

// Update profile
router.put('/profile', auth, uploadAvatar.single('avatar'), (req, res) => {
    const { bio, sign_language } = req.body;
    const avatar = req.file ? req.file.filename : undefined;
    let query = 'UPDATE users SET bio = ?, sign_language = ?';
    const params = [bio || '', sign_language || 'ASL'];
    if (avatar) { query += ', avatar = ?'; params.push(avatar); }
    query += ' WHERE id = ?';
    params.push(req.user.id);
    db.run(query, params, function (err) {
        if (err) return res.status(500).json({ error: 'Update failed' });
        res.json({ message: 'Profile updated' });
    });
});

// Subscribe/Unsubscribe
router.post('/:id/subscribe', auth, (req, res) => {
    const channelId = req.params.id;
    if (channelId === req.user.id) return res.status(400).json({ error: 'Cannot subscribe to yourself' });
    db.get('SELECT * FROM subscriptions WHERE subscriber_id = ? AND channel_id = ?', [req.user.id, channelId], (err, sub) => {
        if (sub) {
            db.run('DELETE FROM subscriptions WHERE subscriber_id = ? AND channel_id = ?', [req.user.id, channelId]);
            db.run('UPDATE users SET subscribers = subscribers - 1 WHERE id = ?', [channelId]);
            return res.json({ subscribed: false });
        }
        db.run('INSERT INTO subscriptions (id, subscriber_id, channel_id) VALUES (?, ?, ?)', [uuidv4(), req.user.id, channelId]);
        db.run('UPDATE users SET subscribers = subscribers + 1 WHERE id = ?', [channelId]);
        res.json({ subscribed: true });
    });
});

// Check subscription status
router.get('/:id/subscription-status', auth, (req, res) => {
    db.get('SELECT * FROM subscriptions WHERE subscriber_id = ? AND channel_id = ?', [req.user.id, req.params.id], (err, sub) => {
        res.json({ subscribed: !!sub });
    });
});

module.exports = router;
