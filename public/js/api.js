// ===== API CLIENT =====
const API_BASE = '/api';

const api = {
    token: localStorage.getItem('dt_token'),

    setToken(token) {
        this.token = token;
        if (token) localStorage.setItem('dt_token', token);
        else localStorage.removeItem('dt_token');
    },

    headers(isFormData = false) {
        const h = {};
        if (this.token) h['Authorization'] = `Bearer ${this.token}`;
        if (!isFormData) h['Content-Type'] = 'application/json';
        return h;
    },

    async get(path) {
        const res = await fetch(API_BASE + path, { headers: this.headers() });
        return res.json();
    },

    async post(path, body) {
        const res = await fetch(API_BASE + path, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(body)
        });
        return res.json();
    },

    async postForm(path, formData, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', API_BASE + path);
            if (this.token) xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
            if (onProgress) xhr.upload.onprogress = onProgress;
            xhr.onload = () => resolve(JSON.parse(xhr.responseText));
            xhr.onerror = reject;
            xhr.send(formData);
        });
    },

    async put(path, body) {
        const isFormData = body instanceof FormData;
        const res = await fetch(API_BASE + path, {
            method: 'PUT',
            headers: this.headers(isFormData),
            body: isFormData ? body : JSON.stringify(body)
        });
        return res.json();
    },

    async delete(path) {
        const res = await fetch(API_BASE + path, { method: 'DELETE', headers: this.headers() });
        return res.json();
    },

    // Auth
    async register(data) { return this.post('/auth/register', data); },
    async login(data) { return this.post('/auth/login', data); },
    async getMe() { return this.get('/auth/me'); },

    // Videos
    async getVideos(params = {}) {
        const q = new URLSearchParams(params).toString();
        return this.get('/videos' + (q ? '?' + q : ''));
    },
    async getVideo(id) { return this.get('/videos/' + id); },
    async getUserVideos(userId) { return this.get('/videos/user/' + userId); },
    async likeVideo(id, type) { return this.post('/videos/' + id + '/like', { type }); },
    async getLikeStatus(id) { return this.get('/videos/' + id + '/like-status'); },
    async deleteVideo(id) { return this.delete('/videos/' + id); },

    // Comments
    async getComments(videoId) { return this.get('/comments/' + videoId); },
    async postComment(videoId, content) { return this.post('/comments/' + videoId, { content }); },
    async deleteComment(id) { return this.delete('/comments/' + id); },

    // Users
    async getUser(id) { return this.get('/users/' + id); },
    async subscribe(id) { return this.post('/users/' + id + '/subscribe', {}); },
    async getSubscriptionStatus(id) { return this.get('/users/' + id + '/subscription-status'); },
};
