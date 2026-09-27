const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MOVIES_DIR = path.join(__dirname, '..', 'movies');

// Only these play natively in a browser <video> tag without extra work.
// .mkv/.avi are deliberately excluded — browsers can't play them directly.
const PLAYABLE_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.mov', '.m4v']);

// Serve the frontend (public/index.html, style.css, client.js)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve whatever movie files the host drops in the movies/ folder.
// express.static handles HTTP range requests automatically, which is what
// lets the browser seek around in a large video instead of downloading the
// whole thing first.
app.use('/movies', express.static(MOVIES_DIR));

// Lets the frontend show a "movies available on this server" list instead
// of everyone needing to know/paste the exact filename.
app.get('/api/movies', (req, res) => {
  fs.readdir(MOVIES_DIR, (err, files) => {
    if (err) return res.json({ movies: [] }); // folder missing/empty is fine
    const movies = files.filter((f) => PLAYABLE_EXTENSIONS.has(path.extname(f).toLowerCase()));
    res.json({ movies });
  });
});

// In-memory room state. No database needed for v1 — everything lives here
// and resets if the server restarts.
//   rooms[roomId] = {
//     videoUrl, isPlaying, position (seconds as of updatedAt),
//     updatedAt (ms timestamp), users: Map<socketId, name>
//   }
const rooms = {};

function getRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      videoUrl: '',
      isPlaying: false,
      position: 0,
      updatedAt: Date.now(),
      users: new Map(),
    };
  }
  return rooms[roomId];
}

// If the video is currently playing, the "real" position keeps advancing
// even though nobody sent a new event. This computes where it actually is
// right now, so a client joining mid-playback lands in the right spot.
function getLivePosition(room) {
  if (!room.isPlaying) return room.position;
  const elapsedSeconds = (Date.now() - room.updatedAt) / 1000;
  return room.position + elapsedSeconds;
}

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentName = null;

  socket.on('join-room', ({ roomId, name }) => {
    currentRoom = roomId;
    currentName = name || 'Guest';
    socket.join(roomId);

    const room = getRoom(roomId);
    room.users.set(socket.id, currentName);

    // Catch the new client up on where things stand right now.
    socket.emit('room-state', {
      videoUrl: room.videoUrl,
      isPlaying: room.isPlaying,
      position: getLivePosition(room),
      users: Array.from(room.users.values()),
    });

    socket.to(roomId).emit('user-joined', { name: currentName });
    io.to(roomId).emit('user-list', Array.from(room.users.values()));
  });

  socket.on('set-video', ({ roomId, videoUrl }) => {
    const room = getRoom(roomId);
    room.videoUrl = videoUrl;
    room.isPlaying = false;
    room.position = 0;
    room.updatedAt = Date.now();
    io.to(roomId).emit('video-changed', { videoUrl });
  });

  // type: 'play' | 'pause' | 'seek', position: seconds
  socket.on('video-action', ({ roomId, type, position }) => {
    const room = getRoom(roomId);
    room.position = position;
    room.updatedAt = Date.now();
    if (type === 'play') room.isPlaying = true;
    if (type === 'pause') room.isPlaying = false;

    // Broadcast to everyone else in the room. The sender already applied
    // the change locally, so it doesn't need it echoed back.
    socket.to(roomId).emit('video-action', { type, position });
  });

  socket.on('chat-message', ({ roomId, message }) => {
    io.to(roomId).emit('chat-message', { name: currentName, message, ts: Date.now() });
  });

  socket.on('emoji', ({ roomId, emoji }) => {
    io.to(roomId).emit('emoji', { name: currentName, emoji });
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = rooms[currentRoom];
    if (!room) return;
    room.users.delete(socket.id);
    socket.to(currentRoom).emit('user-left', { name: currentName });
    io.to(currentRoom).emit('user-list', Array.from(room.users.values()));
    if (room.users.size === 0) delete rooms[currentRoom];
  });
});

server.listen(PORT, () => {
  console.log(`Watch party server running on http://localhost:${PORT}`);
});
