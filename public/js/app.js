// ===== STATE =====
let currentUser = null;
let currentPage = 'home';
let currentCategory = 'All';
let sidebarOpen = true;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  createToastContainer();
  await initAuth();
  setupSidebar();
  setupSearch();
  navigate('home');
});

async function initAuth() {
  if (api.token) {
    try {
      const user = await api.getMe();
      if (!user.error) {
        currentUser = user;
        updateHeaderAuth();
      } else {
        api.setToken(null);
      }
    } catch { api.setToken(null); }
  }
}

function updateHeaderAuth() {
  const authBtns = document.getElementById('auth-buttons');
  const userMenu = document.getElementById('user-menu');
  const avatar = document.getElementById('header-avatar');
  if (currentUser) {
    authBtns.classList.add('hidden');
    userMenu.classList.remove('hidden');
    avatar.src = currentUser.avatar ? `/uploads/avatars/${currentUser.avatar}` : generateAvatarUrl(currentUser.username);
  } else {
    authBtns.classList.remove('hidden');
    userMenu.classList.add('hidden');
  }
}

function generateAvatarUrl(name) {
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%236366f1"/><text x="50%25" y="55%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="18" font-family="Inter,sans-serif">${encodeURIComponent((name || 'U')[0].toUpperCase())}</text></svg>`;
}

// Safe onerror handler — reads username from data-username attribute to avoid
// embedding SVG data URIs (which contain special chars) directly in HTML attributes.
function setFallbackAvatar(img) {
  img.onerror = null; // prevent infinite loop
  img.src = generateAvatarUrl(img.dataset.username || 'U');
}

function setupSidebar() {
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main-content');
    sidebarOpen = !sidebarOpen;
    if (sidebarOpen) {
      sidebar.classList.remove('collapsed');
      main.classList.remove('full-width');
    } else {
      sidebar.classList.add('collapsed');
      main.classList.add('full-width');
    }
  });
}

function setupSearch() {
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
  });
}

function performSearch() {
  const q = document.getElementById('search-input').value.trim();
  if (q) navigate('home', { search: q });
}

function toggleUserDropdown() {
  document.getElementById('user-dropdown').classList.toggle('hidden');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.avatar-wrapper')) {
    document.getElementById('user-dropdown')?.classList.add('hidden');
  }
});

function logout() {
  currentUser = null;
  api.setToken(null);
  updateHeaderAuth();
  navigate('home');
  showToast('Signed out successfully', 'info');
}

// ===== NAVIGATION =====
function navigate(page, params = {}) {
  currentPage = page;
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';

  // Update sidebar active state
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  switch (page) {
    case 'home': renderHome(params); break;
    case 'trending': renderHome({ sort: 'views' }); break;
    case 'video': renderVideoPage(params.id); break;
    case 'upload': renderUploadPage(); break;
    case 'login': renderLoginPage(); break;
    case 'register': renderRegisterPage(); break;
    case 'profile': renderProfilePage(params.userId || currentUser?.id); break;
    case 'accessibility': renderAccessibilityPage(); break;
    default: renderHome({});
  }
}

function filterCategory(cat) {
  currentCategory = cat;
  navigate('home', { category: cat });
}

// ===== HOME PAGE =====
async function renderHome(params = {}) {
  const main = document.getElementById('main-content');
  const isSearch = !!params.search;
  const category = params.category || (currentCategory !== 'All' ? currentCategory : null);

  const categories = ['All', 'Technology', 'ASL Lessons', 'Education', 'Lifestyle', 'Art & Culture', 'News', 'General'];

  let html = '';

  if (!isSearch && !category) {
    html += `
    <div class="hero">
      <div class="hero-badge">🤟 Built for the Deaf Community</div>
      <h1>Share Your Story<br>in <span>Sign Language</span></h1>
      <p>The first video platform designed exclusively for deaf and hard-of-hearing creators. Upload tutorials, tech guides, and more with full caption and ASL support.</p>
      <div class="hero-actions">
        <button class="btn btn-primary" style="font-size:1rem;padding:12px 28px;" onclick="navigate('${currentUser ? 'upload' : 'register'}')">
          ${currentUser ? '📤 Upload Your Video' : '🚀 Get Started Free'}
        </button>
        <button class="btn btn-ghost" style="font-size:1rem;padding:12px 28px;" onclick="navigate('accessibility')">
          ♿ Accessibility Features
        </button>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="num">100%</div><div class="label">Caption Support</div></div>
        <div class="hero-stat"><div class="num">ASL</div><div class="label">Sign Language Ready</div></div>
        <div class="hero-stat"><div class="num">Free</div><div class="label">Forever</div></div>
      </div>
    </div>`;
  }

  html += `<div class="category-chips">`;
  categories.forEach(cat => {
    const active = (cat === 'All' && !category && !isSearch) || cat === category ? 'active' : '';
    html += `<button class="chip ${active}" onclick="filterCategory('${cat}')">${cat}</button>`;
  });
  html += `</div>`;

  html += `<div class="section-header">
    <h2 class="section-title">${isSearch ? `Results for "<span>${params.search}</span>"` : category ? `<span>${category}</span> Videos` : 'Latest Videos'}</h2>
  </div>`;

  html += `<div class="video-grid" id="video-grid"><div class="loading"><div class="spinner"></div></div></div>`;
  main.innerHTML = html;

  // Fetch videos
  const queryParams = {};
  if (params.search) queryParams.search = params.search;
  if (category && category !== 'All') queryParams.category = category;

  const videos = await api.getVideos(queryParams);
  const grid = document.getElementById('video-grid');
  if (!grid) return;

  if (!videos || videos.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="icon">🎬</div>
      <h3>No videos yet</h3>
      <p>${currentUser ? 'Be the first to upload!' : 'Sign up and be the first to upload!'}</p>
      ${currentUser ? `<button class="btn btn-primary" style="margin-top:16px" onclick="navigate('upload')">Upload Video</button>` : ''}
    </div>`;
    return;
  }

  grid.innerHTML = videos.map(v => videoCard(v)).join('');
}

function videoCard(v) {
  const thumb = v.thumbnail
    ? `<img src="/uploads/thumbnails/${v.thumbnail}" alt="${v.title}" loading="lazy" />`
    : `<div class="thumbnail-placeholder">🎬</div>`;
  const aslBadge = v.has_sign_language ? `<span class="badge badge-asl">ASL</span>` : '';
  const ccBadge = v.caption_file ? `<span class="badge badge-cc">CC</span>` : '';
  const views = formatNum(v.views);
  const timeAgo = getTimeAgo(v.created_at);
  const avatar = v.avatar ? `/uploads/avatars/${v.avatar}` : generateAvatarUrl(v.username);

  return `
  <div class="video-card" onclick="navigate('video', {id:'${v.id}'})">
    <div class="video-thumbnail">
      ${thumb}
      <div class="video-badges">${aslBadge}${ccBadge}</div>
    </div>
    <div class="video-info">
      <div class="video-title">${escHtml(v.title)}</div>
      <div class="video-meta">
        <img class="channel-avatar" src="${avatar}" alt="${escHtml(v.username)}" data-username="${escHtml(v.username)}" onerror="setFallbackAvatar(this)" />
        <div class="video-meta-text">
          <div class="channel-name" onclick="event.stopPropagation();navigate('profile',{userId:'${v.user_id}'})">${escHtml(v.username)}</div>
          <div class="video-stats">${views} views • ${timeAgo}</div>
        </div>
      </div>
    </div>
  </div>`;
}

// ===== VIDEO PAGE =====
async function renderVideoPage(videoId) {
  const main = document.getElementById('main-content');
  const [video, comments, allVideos] = await Promise.all([
    api.getVideo(videoId),
    api.getComments(videoId),
    api.getVideos({ limit: 8 })
  ]);

  if (video.error) {
    main.innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>Video not found</h3></div>`;
    return;
  }

  let likeStatus = null;
  let subStatus = false;
  if (currentUser) {
    const [ls, ss] = await Promise.all([
      api.getLikeStatus(videoId),
      api.getSubscriptionStatus(video.user_id)
    ]);
    likeStatus = ls.status;
    subStatus = ss.subscribed;
  }

  const avatar = video.avatar ? `/uploads/avatars/${video.avatar}` : generateAvatarUrl(video.username);
  const isOwner = currentUser?.id === video.user_id;

  const captionTrack = video.caption_file
    ? `<track kind="subtitles" src="/uploads/captions/${video.caption_file}" default label="Captions" />`
    : '';

  main.innerHTML = `
  <div class="video-page">
    <div class="video-main">
      <div class="video-player-container">
        <video controls autoplay id="main-video" crossorigin="anonymous">
          <source src="/uploads/videos/${video.filename}" type="video/mp4" />
          ${captionTrack}
          Your browser does not support video playback.
        </video>
      </div>

      <div class="video-details">
        <h1 class="video-page-title">${escHtml(video.title)}</h1>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
          <span style="color:var(--text-muted);font-size:0.875rem;">${formatNum(video.views)} views • ${getTimeAgo(video.created_at)}</span>
          ${video.has_sign_language ? '<span class="badge badge-asl">ASL Included</span>' : ''}
          ${video.caption_file ? '<span class="badge badge-cc">Captions Available</span>' : ''}
          <span style="background:var(--bg-card);border:1px solid var(--border);border-radius:50px;padding:3px 12px;font-size:0.78rem;color:var(--text-muted);">${video.category}</span>
        </div>

        <div class="video-actions">
          <button class="action-btn ${likeStatus === 'like' ? 'active' : ''}" id="like-btn" onclick="handleLike('like', '${videoId}')">
            👍 <span id="like-count">${formatNum(video.likes)}</span>
          </button>
          <button class="action-btn ${likeStatus === 'dislike' ? 'active' : ''}" id="dislike-btn" onclick="handleLike('dislike', '${videoId}')">
            👎 <span id="dislike-count">${formatNum(video.dislikes)}</span>
          </button>
          <button class="action-btn" onclick="shareVideo('${videoId}')">
            🔗 Share
          </button>
          ${isOwner ? `<button class="action-btn" style="color:var(--danger);border-color:var(--danger)" onclick="deleteVideo('${videoId}')">🗑️ Delete</button>` : ''}
        </div>

        <div class="channel-info">
          <img class="channel-info-avatar" src="${avatar}" alt="${escHtml(video.username)}" data-username="${escHtml(video.username)}" onerror="setFallbackAvatar(this)" onclick="navigate('profile',{userId:'${video.user_id}'})" style="cursor:pointer" />
          <div class="channel-info-text" style="flex:1">
            <div class="name" onclick="navigate('profile',{userId:'${video.user_id}'})" style="cursor:pointer">${escHtml(video.username)}</div>
            <div class="subs">${formatNum(video.subscribers)} subscribers</div>
          </div>
          ${!isOwner ? `
          <button class="btn ${subStatus ? 'btn-ghost' : 'btn-primary'}" id="sub-btn" onclick="handleSubscribe('${video.user_id}')">
            ${subStatus ? '✓ Subscribed' : '+ Subscribe'}
          </button>` : ''}
        </div>

        <div class="video-description">
          <div class="views-date">${formatNum(video.views)} views • ${new Date(video.created_at).toLocaleDateString()}</div>
          ${video.tags ? `<div style="margin-bottom:8px;">${video.tags.split(',').map(t => `<span style="color:var(--accent);margin-right:8px;font-size:0.85rem;">#${t.trim()}</span>`).join('')}</div>` : ''}
          ${escHtml(video.description || 'No description provided.')}
        </div>

        <!-- Comments -->
        <div class="comments-section">
          <h3 class="comments-title">💬 ${comments.length} Comments</h3>
          ${currentUser ? `
          <div class="comment-input-area">
            <img src="${generateAvatarUrl(currentUser.username)}" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;" />
            <div style="flex:1;display:flex;flex-direction:column;gap:10px;">
              <textarea id="comment-input" placeholder="Add a comment... (sign language descriptions welcome!)" rows="3"></textarea>
              <div style="display:flex;justify-content:flex-end;">
                <button class="btn btn-primary" onclick="submitComment('${videoId}')">Post Comment</button>
              </div>
            </div>
          </div>` : `<p style="color:var(--text-muted);margin-bottom:20px;"><a href="#" onclick="navigate('login')" style="color:var(--accent)">Sign in</a> to comment</p>`}
          <div id="comments-list">
            ${comments.map(c => commentHtml(c)).join('') || '<p style="color:var(--text-muted)">No comments yet. Be the first!</p>'}
          </div>
        </div>
      </div>
    </div>

    <!-- Related Videos -->
    <div class="video-sidebar">
      <h3 style="font-size:1rem;font-weight:700;margin-bottom:16px;">Related Videos</h3>
      ${allVideos.filter(v => v.id !== videoId).slice(0, 8).map(v => relatedVideoHtml(v)).join('')}
    </div>
  </div>`;

  // Enable captions by default if available
  const videoEl = document.getElementById('main-video');
  if (videoEl && video.caption_file) {
    videoEl.addEventListener('loadedmetadata', () => {
      if (videoEl.textTracks[0]) videoEl.textTracks[0].mode = 'showing';
    });
  }
}

function commentHtml(c) {
  const avatar = c.avatar ? `/uploads/avatars/${c.avatar}` : generateAvatarUrl(c.username);
  const isOwn = currentUser?.id === c.user_id;
  return `
  <div class="comment" id="comment-${c.id}">
    <img class="comment-avatar" src="${avatar}" alt="${escHtml(c.username)}" data-username="${escHtml(c.username)}" onerror="setFallbackAvatar(this)" />
    <div class="comment-body">
      <div class="comment-header">
        <span class="comment-author">${escHtml(c.username)}</span>
        <span class="comment-time">${getTimeAgo(c.created_at)}</span>
        ${isOwn ? `<button onclick="deleteComment('${c.id}')" style="color:var(--danger);font-size:0.78rem;margin-left:auto;">Delete</button>` : ''}
      </div>
      <div class="comment-text">${escHtml(c.content)}</div>
    </div>
  </div>`;
}

function relatedVideoHtml(v) {
  const thumb = v.thumbnail
    ? `<img class="related-thumb" src="/uploads/thumbnails/${v.thumbnail}" alt="${v.title}" />`
    : `<div class="related-thumb">🎬</div>`;
  return `
  <div class="related-video" onclick="navigate('video',{id:'${v.id}'})">
    ${thumb}
    <div class="related-info">
      <div class="related-title">${escHtml(v.title)}</div>
      <div class="related-channel">${escHtml(v.username)} • ${formatNum(v.views)} views</div>
    </div>
  </div>`;
}

async function handleLike(type, videoId) {
  if (!currentUser) { navigate('login'); return; }
  const result = await api.likeVideo(videoId, type);
  // Refresh video page
  navigate('video', { id: videoId });
}

async function handleSubscribe(userId) {
  if (!currentUser) { navigate('login'); return; }
  const result = await api.subscribe(userId);
  const btn = document.getElementById('sub-btn');
  if (btn) {
    btn.textContent = result.subscribed ? '✓ Subscribed' : '+ Subscribe';
    btn.className = `btn ${result.subscribed ? 'btn-ghost' : 'btn-primary'}`;
  }
  showToast(result.subscribed ? 'Subscribed!' : 'Unsubscribed', 'success');
}

async function submitComment(videoId) {
  if (!currentUser) { navigate('login'); return; }
  const input = document.getElementById('comment-input');
  const content = input?.value.trim();
  if (!content) return;
  const comment = await api.postComment(videoId, content);
  if (comment.error) { showToast(comment.error, 'error'); return; }
  input.value = '';
  const list = document.getElementById('comments-list');
  if (list) list.insertAdjacentHTML('afterbegin', commentHtml(comment));
  showToast('Comment posted!', 'success');
}

async function deleteComment(id) {
  await api.deleteComment(id);
  document.getElementById('comment-' + id)?.remove();
  showToast('Comment deleted', 'info');
}

async function deleteVideo(id) {
  if (!confirm('Delete this video? This cannot be undone.')) return;
  await api.deleteVideo(id);
  showToast('Video deleted', 'info');
  navigate('home');
}

function shareVideo(id) {
  const url = window.location.origin + '/#video/' + id;
  navigator.clipboard?.writeText(url).then(() => showToast('Link copied to clipboard!', 'success'));
}

// ===== UPLOAD PAGE =====
function renderUploadPage() {
  if (!currentUser) { navigate('login'); return; }
  const main = document.getElementById('main-content');
  main.innerHTML = `
  <div class="upload-page">
    <h1 class="page-title">📤 Upload Video</h1>
    <p class="page-subtitle">Share your knowledge with the deaf community</p>

    <div class="upload-zone" id="upload-zone" onclick="document.getElementById('video-file').click()">
      <div class="upload-icon">🎬</div>
      <h3>Drag & drop your video here</h3>
      <p>or click to browse files</p>
      <p class="file-types">MP4, WebM, MOV • Max 500MB</p>
      <input type="file" id="video-file" accept="video/*" style="display:none" onchange="handleVideoSelect(this)" />
    </div>

    <div id="video-preview" style="display:none;margin-bottom:20px;">
      <video id="preview-player" controls style="width:100%;border-radius:12px;background:#000;max-height:300px;"></video>
      <p id="video-filename" style="color:var(--text-muted);font-size:0.85rem;margin-top:8px;"></p>
    </div>

    <div class="upload-progress" id="upload-progress">
      <p style="font-weight:600;margin-bottom:4px;">Uploading...</p>
      <div class="progress-bar-container">
        <div class="progress-bar" id="progress-bar"></div>
      </div>
      <p id="progress-text" style="color:var(--text-muted);font-size:0.82rem;margin-top:6px;">0%</p>
    </div>

    <form id="upload-form" onsubmit="submitUpload(event)">
      <div class="form-group">
        <label class="form-label">Video Title *</label>
        <input type="text" class="form-input" id="video-title" placeholder="e.g. Python Tutorial for Beginners" required />
      </div>

      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="video-desc" placeholder="Describe your video content..."></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-select" id="video-category">
            <option>Technology</option>
            <option>ASL Lessons</option>
            <option>Education</option>
            <option>Lifestyle</option>
            <option>Art & Culture</option>
            <option>News</option>
            <option>General</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tags (comma separated)</label>
          <input type="text" class="form-input" id="video-tags" placeholder="e.g. python, coding, tutorial" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Thumbnail Image (optional)</label>
        <input type="file" class="form-input" id="thumb-file" accept="image/*" style="padding:8px;" />
        <p class="form-hint">Recommended: 1280×720px JPG or PNG</p>
      </div>

      <div class="form-group">
        <label class="form-label">Caption / Subtitle File (optional)</label>
        <input type="file" class="form-input" id="caption-file" accept=".vtt,.srt,.txt" style="padding:8px;" />
        <p class="form-hint">Upload a .vtt or .srt file for captions. Highly recommended for accessibility!</p>
      </div>

      <div class="form-group">
        <div class="checkbox-group">
          <input type="checkbox" id="has-asl" />
          <label for="has-asl">🤟 This video includes Sign Language (ASL/BSL/etc.)</label>
        </div>
      </div>

      <button type="submit" class="btn btn-primary" style="width:100%;padding:14px;font-size:1rem;border-radius:12px;" id="upload-btn">
        📤 Upload Video
      </button>
    </form>
  </div>`;

  // Drag and drop
  const zone = document.getElementById('upload-zone');
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      document.getElementById('video-file').files = e.dataTransfer.files;
      handleVideoSelect({ files: e.dataTransfer.files });
    }
  });
}

function handleVideoSelect(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('video-preview');
  const player = document.getElementById('preview-player');
  const fname = document.getElementById('video-filename');
  preview.style.display = 'block';
  player.src = URL.createObjectURL(file);
  fname.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
}

async function submitUpload(e) {
  e.preventDefault();
  const videoFile = document.getElementById('video-file').files[0];
  if (!videoFile) { showToast('Please select a video file', 'error'); return; }

  const formData = new FormData();
  formData.append('video', videoFile);
  formData.append('title', document.getElementById('video-title').value);
  formData.append('description', document.getElementById('video-desc').value);
  formData.append('category', document.getElementById('video-category').value);
  formData.append('tags', document.getElementById('video-tags').value);
  formData.append('has_sign_language', document.getElementById('has-asl').checked ? '1' : '0');

  const thumbFile = document.getElementById('thumb-file').files[0];
  if (thumbFile) formData.append('thumbnail', thumbFile);

  const captionFile = document.getElementById('caption-file').files[0];
  if (captionFile) formData.append('caption', captionFile);

  const progressDiv = document.getElementById('upload-progress');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const uploadBtn = document.getElementById('upload-btn');

  progressDiv.style.display = 'block';
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Uploading...';

  try {
    const result = await api.postForm('/videos/upload', formData, (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = pct + '%';
        progressText.textContent = pct + '%';
      }
    });

    if (result.error) {
      showToast(result.error, 'error');
      uploadBtn.disabled = false;
      uploadBtn.textContent = '📤 Upload Video';
      progressDiv.style.display = 'none';
    } else {
      showToast('Video uploaded successfully! 🎉', 'success');
      navigate('video', { id: result.id });
    }
  } catch {
    showToast('Upload failed. Please try again.', 'error');
    uploadBtn.disabled = false;
    uploadBtn.textContent = '📤 Upload Video';
  }
}

// ===== AUTH PAGES =====
function renderLoginPage() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">
        <div class="logo-icon">🤟</div>
        <div class="logo-text">Deaf<span class="logo-accent">Tube</span></div>
      </div>
      <h2 class="auth-title">Welcome back!</h2>
      <p class="auth-subtitle">Sign in to your account</p>
      <form onsubmit="handleLogin(event)">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="login-email" placeholder="your@email.com" required />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" id="login-password" placeholder="••••••••" required />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;padding:13px;font-size:1rem;border-radius:12px;margin-top:8px;" id="login-btn">
          Sign In
        </button>
      </form>
      <div class="auth-footer">
        Don't have an account? <a href="#" onclick="navigate('register')">Join DeafTube</a>
      </div>
    </div>
  </div>`;
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Signing in...';
  const result = await api.login({
    email: document.getElementById('login-email').value,
    password: document.getElementById('login-password').value
  });
  if (result.error) {
    showToast(result.error, 'error');
    btn.disabled = false; btn.textContent = 'Sign In';
  } else {
    api.setToken(result.token);
    currentUser = result.user;
    updateHeaderAuth();
    showToast(`Welcome back, ${result.user.username}! 🤟`, 'success');
    navigate('home');
  }
}

function renderRegisterPage() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">
        <div class="logo-icon">🤟</div>
        <div class="logo-text">Deaf<span class="logo-accent">Tube</span></div>
      </div>
      <h2 class="auth-title">Join DeafTube</h2>
      <p class="auth-subtitle">Create your free account today</p>
      <form onsubmit="handleRegister(event)">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input type="text" class="form-input" id="reg-username" placeholder="your_username" required />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="reg-email" placeholder="your@email.com" required />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" id="reg-password" placeholder="Min 6 characters" minlength="6" required />
        </div>
        <div class="form-group">
          <label class="form-label">Preferred Sign Language</label>
          <select class="form-select" id="reg-sl">
            <option value="ASL">ASL (American Sign Language)</option>
            <option value="BSL">BSL (British Sign Language)</option>
            <option value="ISL">ISL (Indian Sign Language)</option>
            <option value="Auslan">Auslan (Australian)</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;padding:13px;font-size:1rem;border-radius:12px;margin-top:8px;" id="reg-btn">
          🚀 Create Account
        </button>
      </form>
      <div class="auth-footer">
        Already have an account? <a href="#" onclick="navigate('login')">Sign in</a>
      </div>
    </div>
  </div>`;
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('reg-btn');
  btn.disabled = true; btn.textContent = 'Creating account...';
  const result = await api.register({
    username: document.getElementById('reg-username').value,
    email: document.getElementById('reg-email').value,
    password: document.getElementById('reg-password').value,
    sign_language: document.getElementById('reg-sl').value
  });
  if (result.error) {
    showToast(result.error, 'error');
    btn.disabled = false; btn.textContent = '🚀 Create Account';
  } else {
    api.setToken(result.token);
    currentUser = result.user;
    updateHeaderAuth();
    showToast(`Welcome to DeafTube, ${result.user.username}! 🤟`, 'success');
    navigate('home');
  }
}

// ===== PROFILE PAGE =====
async function renderProfilePage(userId) {
  if (!userId) { navigate('login'); return; }
  const main = document.getElementById('main-content');
  const [user, videos] = await Promise.all([
    api.getUser(userId),
    api.getUserVideos(userId)
  ]);

  if (user.error) {
    main.innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>User not found</h3></div>`;
    return;
  }

  const avatar = user.avatar ? `/uploads/avatars/${user.avatar}` : generateAvatarUrl(user.username);
  const isOwn = currentUser?.id === userId;

  main.innerHTML = `
  <div class="profile-header">
    <img class="profile-avatar" src="${avatar}" alt="${escHtml(user.username)}" data-username="${escHtml(user.username)}" onerror="setFallbackAvatar(this)" />
    <div style="flex:1">
      <div class="profile-name">${escHtml(user.username)}</div>
      <div style="color:var(--text-muted);font-size:0.85rem;">🤟 ${user.sign_language} • Joined ${new Date(user.created_at).toLocaleDateString()}</div>
      ${user.bio ? `<div class="profile-bio">${escHtml(user.bio)}</div>` : ''}
      <div class="profile-stats">
        <div class="profile-stat"><div class="num">${formatNum(user.subscribers)}</div><div class="label">Subscribers</div></div>
        <div class="profile-stat"><div class="num">${videos.length}</div><div class="label">Videos</div></div>
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-direction:column;">
      ${isOwn ? `<button class="btn btn-ghost" onclick="navigate('upload')">📤 Upload Video</button>` : `<button class="btn btn-primary" onclick="handleSubscribe('${userId}')">+ Subscribe</button>`}
    </div>
  </div>

  <div class="section-header">
    <h2 class="section-title">Videos by <span>${escHtml(user.username)}</span></h2>
  </div>
  <div class="video-grid">
    ${videos.length ? videos.map(v => videoCard(v)).join('') : `<div class="empty-state" style="grid-column:1/-1"><div class="icon">🎬</div><h3>No videos yet</h3>${isOwn ? '<button class="btn btn-primary" style="margin-top:16px" onclick="navigate(\'upload\')">Upload your first video</button>' : ''}</div>`}
  </div>`;
}

// ===== ACCESSIBILITY PAGE =====
function renderAccessibilityPage() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
  <div class="accessibility-page">
    <h1 class="page-title">♿ Accessibility Features</h1>
    <p class="page-subtitle" style="margin-bottom:32px;">DeafTube is built from the ground up for the deaf and hard-of-hearing community.</p>

    <div class="feature-card">
      <div class="feature-icon">📝</div>
      <div>
        <div class="feature-title">Closed Captions & Subtitles</div>
        <div class="feature-desc">Every video can have a .vtt or .srt caption file uploaded. Captions are automatically enabled by default so you never miss a word. Creators are encouraged to provide accurate captions.</div>
      </div>
    </div>

    <div class="feature-card">
      <div class="feature-icon">🤟</div>
      <div>
        <div class="feature-title">Sign Language Support</div>
        <div class="feature-desc">Creators can mark their videos as containing ASL, BSL, ISL, Auslan, or other sign languages. Filter and discover content in your preferred sign language. The ASL badge makes it easy to find signed content.</div>
      </div>
    </div>

    <div class="feature-card">
      <div class="feature-icon">👁️</div>
      <div>
        <div class="feature-title">Visual Notifications Only</div>
        <div class="feature-desc">All notifications on DeafTube are visual — no audio alerts, no sound-based cues. Toast notifications appear on screen for all actions like uploads, comments, and subscriptions.</div>
      </div>
    </div>

    <div class="feature-card">
      <div class="feature-icon">🌙</div>
      <div>
        <div class="feature-title">High Contrast Dark Mode</div>
        <div class="feature-desc">Our dark theme with high-contrast text and accent colors is designed for comfortable viewing. The interface uses clear visual hierarchy to make navigation intuitive.</div>
      </div>
    </div>

    <div class="feature-card">
      <div class="feature-icon">🌍</div>
      <div>
        <div class="feature-title">Multi Sign Language Community</div>
        <div class="feature-desc">DeafTube supports creators from around the world using ASL, BSL, ISL, Auslan, and more. Set your preferred sign language in your profile to connect with your community.</div>
      </div>
    </div>

    <div class="feature-card">
      <div class="feature-icon">📱</div>
      <div>
        <div class="feature-title">Fully Responsive Design</div>
        <div class="feature-desc">Access DeafTube from any device — desktop, tablet, or mobile. The layout adapts to give you the best viewing experience on any screen size.</div>
      </div>
    </div>
  </div>`;
}

// ===== NOTIFICATIONS =====
function showNotification(text) {
  const banner = document.getElementById('notification-banner');
  document.getElementById('notification-text').textContent = text;
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 5000);
}
function closeNotification() {
  document.getElementById('notification-banner').classList.add('hidden');
}

// ===== TOAST =====
function createToastContainer() {
  const div = document.createElement('div');
  div.className = 'toast-container';
  div.id = 'toast-container';
  document.body.appendChild(div);
}
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ===== HELPERS =====
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatNum(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}
function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
