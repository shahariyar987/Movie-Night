const socket = io();

// ---- DOM references ----
const joinScreen = document.getElementById('join-screen');
const appScreen = document.getElementById('app-screen');
const joinForm = document.getElementById('join-form');
const nameInput = document.getElementById('name-input');
const roomInput = document.getElementById('room-input');

const videoEl = document.getElementById('video');
const videoUrlForm = document.getElementById('video-url-form');
const videoUrlInput = document.getElementById('video-url-input');
const serverMoviesForm = document.getElementById('server-movies-form');
const serverMoviesSelect = document.getElementById('server-movies-select');

const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

const emojiButtons = document.querySelectorAll('.emoji-btn');
const emojiLayer = document.getElementById('emoji-layer');

const userListEl = document.getElementById('user-list');
const roomLabel = document.getElementById('room-label');
const resumeOverlay = document.getElementById('resume-overlay');

// Mobile browsers block programmatic play() unless it happens right inside
// a user gesture (a tap) on THAT device. A play() triggered by a socket
// event from someone else's tap doesn't count, so it gets silently
// rejected. When that happens, show a button — tapping it IS a real user
// gesture on this device, so play() succeeds from there.
function attemptPlay() {
  const playPromise = videoEl.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise
      .then(() => resumeOverlay.classList.add('hidden'))
      .catch(() => resumeOverlay.classList.remove('hidden'));
  }
}
resumeOverlay.addEventListener('click', () => {
  applyRemoteChange(() => attemptPlay());
});

let roomId = null;
let myName = null;

// Guard flag: true while WE are applying a change that came from the
// server. Without this, setting videoEl.currentTime or calling .play()
// would fire our own 'play'/'pause'/'seeked' listeners below and
// re-broadcast the same event right back out — an infinite echo.
let applyingRemote = false;
function applyRemoteChange(fn) {
  applyingRemote = true;
  fn();
  // seeked/play/pause events fire asynchronously; give them a moment
  // to happen (and be ignored) before we start listening again.
  setTimeout(() => (applyingRemote = false), 300);
}

// ---- Join room ----
joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  myName = nameInput.value.trim() || 'Guest';
  roomId = roomInput.value.trim() || 'default-room';

  socket.emit('join-room', { roomId, name: myName });

  joinScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  roomLabel.textContent = roomId;
});

// ---- Catching up when we join (or reconnect) ----
socket.on('room-state', ({ videoUrl, isPlaying, position, users }) => {
  if (videoUrl) {
    applyRemoteChange(() => {
      videoEl.src = videoUrl;
      videoEl.currentTime = position;
      if (isPlaying) attemptPlay();
    });
  }
  renderUserList(users);
});

socket.on('user-list', renderUserList);
function renderUserList(users) {
  userListEl.textContent = users.join(', ');
}

socket.on('user-joined', ({ name }) => addSystemMessage(`${name} joined`));
socket.on('user-left', ({ name }) => addSystemMessage(`${name} left`));

// ---- Setting / changing the video source ----
// Kept simple for v1: anyone in the room can set the video URL.
videoUrlForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const url = videoUrlInput.value.trim();
  if (!url) return;
  socket.emit('set-video', { roomId, videoUrl: url });
});

// ---- Movies dropped into the server's movies/ folder ----
// A relative URL (not http://localhost:...) so it resolves correctly no
// matter which address a phone is actually using — LAN IP or ngrok URL.
fetch('/api/movies')
  .then((res) => res.json())
  .then(({ movies }) => {
    movies.forEach((filename) => {
      const option = document.createElement('option');
      option.value = filename;
      option.textContent = filename;
      serverMoviesSelect.appendChild(option);
    });
  })
  .catch(() => {}); // no movies folder yet — dropdown just stays empty

serverMoviesForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const filename = serverMoviesSelect.value;
  if (!filename) return;
  socket.emit('set-video', { roomId, videoUrl: `/movies/${encodeURIComponent(filename)}` });
});

socket.on('video-changed', ({ videoUrl }) => {
  applyRemoteChange(() => {
    videoEl.src = videoUrl;
    videoEl.currentTime = 0;
  });
});

// ---- Local playback actions -> tell the server ----
videoEl.addEventListener('play', () => {
  if (applyingRemote) return;
  socket.emit('video-action', { roomId, type: 'play', position: videoEl.currentTime });
});

videoEl.addEventListener('pause', () => {
  if (applyingRemote) return;
  socket.emit('video-action', { roomId, type: 'pause', position: videoEl.currentTime });
});

videoEl.addEventListener('seeked', () => {
  if (applyingRemote) return;
  socket.emit('video-action', { roomId, type: 'seek', position: videoEl.currentTime });
});

// ---- Remote playback actions -> apply locally ----
socket.on('video-action', ({ type, position }) => {
  applyRemoteChange(() => {
    // Only jump if we've actually drifted — avoids a visible micro-stutter
    // on every single play/pause when we're already in sync.
    if (Math.abs(videoEl.currentTime - position) > 0.5) {
      videoEl.currentTime = position;
    }
    if (type === 'play') attemptPlay();
    if (type === 'pause') videoEl.pause();
  });
});

// ---- Chat ----
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;
  socket.emit('chat-message', { roomId, message });
  chatInput.value = '';
});

socket.on('chat-message', ({ name, message }) => {
  const line = document.createElement('div');
  line.className = 'chat-line';
  line.innerHTML = `<strong>${escapeHtml(name)}:</strong> ${escapeHtml(message)}`;
  chatLog.appendChild(line);
  chatLog.scrollTop = chatLog.scrollHeight;
});

function addSystemMessage(text) {
  const line = document.createElement('div');
  line.className = 'chat-line system';
  line.textContent = text;
  chatLog.appendChild(line);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Emoji reactions ----
emojiButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    socket.emit('emoji', { roomId, emoji: btn.dataset.emoji });
  });
});

socket.on('emoji', ({ emoji }) => showFloatingEmoji(emoji));

function showFloatingEmoji(emoji) {
  const el = document.createElement('div');
  el.className = 'floating-emoji';
  el.textContent = emoji;
  el.style.left = `${20 + Math.random() * 60}%`;
  emojiLayer.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}
