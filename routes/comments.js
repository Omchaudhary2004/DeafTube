const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const auth = require('../middleware/auth');

// Get comments for a video
router.get('/:videoId', (req, res) => {
    db.all(
        `SELECT c.*, u.username, u.avatar FROM comments c 
     JOIN users u ON c.user_id = u.id 
     WHERE c.video_id = ? ORDER BY c.created_at DESC`,
        [req.params.videoId],
        (err, comments) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch comments' });
            res.json(comments);
        }
    );
});

// Post a comment
router.post('/:videoId', auth, (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Comment content required' });
    const id = uuidv4();
    db.run(
        'INSERT INTO comments (id, video_id, user_id, content) VALUES (?, ?, ?, ?)',
        [id, req.params.videoId, req.user.id, content],
        function (err) {
            if (err) return res.status(500).json({ error: 'Failed to post comment' });
            db.get(
                'SELECT c.*, u.username, u.avatar FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?',
                [id],
                (err, comment) => res.json(comment)
            );
        }
    );
});

// Delete a comment
router.delete('/:id', auth, (req, res) => {
    db.get('SELECT * FROM comments WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, comment) => {
        if (!comment) return res.status(404).json({ error: 'Not found or unauthorized' });
        db.run('DELETE FROM comments WHERE id = ?', [req.params.id]);
        res.json({ message: 'Deleted' });
    });
});

module.exports = router;
