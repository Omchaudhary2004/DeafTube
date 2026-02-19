const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const auth = require('../middleware/auth');

// Storage config for videos
const videoStorage = multer.diskStorage({
    destination: 'uploads/videos/',
    filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const thumbnailStorage = multer.diskStorage({
    destination: 'uploads/thumbnails/',
    filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const captionStorage = multer.diskStorage({
    destination: 'uploads/captions/',
    filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});

const uploadVideo = multer({ storage: videoStorage, limits: { fileSize: 500 * 1024 * 1024 } });
const uploadThumb = multer({ storage: thumbnailStorage });
const uploadCaption = multer({ storage: captionStorage });

const multiUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            if (file.fieldname === 'video') cb(null, 'uploads/videos/');
            else if (file.fieldname === 'thumbnail') cb(null, 'uploads/thumbnails/');
            else if (file.fieldname === 'caption') cb(null, 'uploads/captions/');
        },
        filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
    }),
    limits: { fileSize: 500 * 1024 * 1024 }
});

// Get all videos (feed)
router.get('/', (req, res) => {
    const { category, search, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;
    let query = `
    SELECT v.*, u.username, u.avatar 
    FROM videos v 
    JOIN users u ON v.user_id = u.id
  `;
    const params = [];
    if (category && category !== 'All') {
        query += ' WHERE v.category = ?';
        params.push(category);
    }
    if (search) {
        query += params.length ? ' AND' : ' WHERE';
        query += ' (v.title LIKE ? OR v.description LIKE ? OR v.tags LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    db.all(query, params, (err, videos) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch videos' });
        res.json(videos);
    });
});

// Get single video
router.get('/:id', (req, res) => {
    db.get(
        'SELECT v.*, u.username, u.avatar, u.subscribers FROM videos v JOIN users u ON v.user_id = u.id WHERE v.id = ?',
        [req.params.id],
        (err, video) => {
            if (err || !video) return res.status(404).json({ error: 'Video not found' });
            // Increment views
            db.run('UPDATE videos SET views = views + 1 WHERE id = ?', [req.params.id]);
            res.json(video);
        }
    );
});

// Upload video
router.post('/upload', auth, multiUpload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
    { name: 'caption', maxCount: 1 }
]), (req, res) => {
    if (!req.files?.video) return res.status(400).json({ error: 'Video file required' });
    const { title, description, category, tags, has_sign_language } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const id = uuidv4();
    const videoFile = req.files.video[0].filename;
    const thumbnailFile = req.files?.thumbnail?.[0]?.filename || null;
    const captionFile = req.files?.caption?.[0]?.filename || null;

    db.run(
        `INSERT INTO videos (id, user_id, title, description, filename, thumbnail, caption_file, category, tags, has_sign_language)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, req.user.id, title, description || '', videoFile, thumbnailFile, captionFile, category || 'General', tags || '', has_sign_language ? 1 : 0],
        function (err) {
            if (err) return res.status(500).json({ error: 'Upload failed' });
            res.json({ id, message: 'Video uploaded successfully' });
        }
    );
});

// Like/Dislike video
router.post('/:id/like', auth, (req, res) => {
    const { type } = req.body; // 'like' or 'dislike'
    const likeId = uuidv4();
    db.get('SELECT * FROM likes WHERE user_id = ? AND video_id = ?', [req.user.id, req.params.id], (err, existing) => {
        if (existing) {
            if (existing.type === type) {
                // Remove like/dislike
                db.run('DELETE FROM likes WHERE id = ?', [existing.id]);
                db.run(`UPDATE videos SET ${type}s = ${type}s - 1 WHERE id = ?`, [req.params.id]);
                return res.json({ message: 'Removed' });
            } else {
                // Switch like/dislike
                db.run('UPDATE likes SET type = ? WHERE id = ?', [type, existing.id]);
                const opposite = type === 'like' ? 'dislike' : 'like';
                db.run(`UPDATE videos SET ${type}s = ${type}s + 1, ${opposite}s = ${opposite}s - 1 WHERE id = ?`, [req.params.id]);
                return res.json({ message: 'Switched' });
            }
        }
        db.run('INSERT INTO likes (id, user_id, video_id, type) VALUES (?, ?, ?, ?)', [likeId, req.user.id, req.params.id, type]);
        db.run(`UPDATE videos SET ${type}s = ${type}s + 1 WHERE id = ?`, [req.params.id]);
        res.json({ message: 'Success' });
    });
});

// Get user's like status for a video
router.get('/:id/like-status', auth, (req, res) => {
    db.get('SELECT type FROM likes WHERE user_id = ? AND video_id = ?', [req.user.id, req.params.id], (err, row) => {
        res.json({ status: row ? row.type : null });
    });
});

// Get videos by user
router.get('/user/:userId', (req, res) => {
    db.all(
        'SELECT v.*, u.username, u.avatar FROM videos v JOIN users u ON v.user_id = u.id WHERE v.user_id = ? ORDER BY v.created_at DESC',
        [req.params.userId],
        (err, videos) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch' });
            res.json(videos);
        }
    );
});

// Delete video
router.delete('/:id', auth, (req, res) => {
    db.get('SELECT * FROM videos WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, video) => {
        if (!video) return res.status(404).json({ error: 'Not found or unauthorized' });
        db.run('DELETE FROM videos WHERE id = ?', [req.params.id]);
        res.json({ message: 'Deleted' });
    });
});

module.exports = router;
