const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 10000);
const ROOT = __dirname;
const rooms = new Map();
const MAX_PLAYERS = 10;

function roomCode() {
  let code;
  do code = crypto.randomBytes(2).toString('hex').toUpperCase();
  while (rooms.has(code));
  return code;
}

function cleanName(value) {
  return String(value || 'Anónimo').replace(/[<>]/g, '').trim().slice(0, 14) || 'Anónimo';
}

function cleanMode(value) {
  return value === 'boom' ? 'boom' : 'classic';
}

function snapshot(room) {
  return {
    type: 'room-state',
    room: room.code,
    mode: room.mode,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      hue: p.hue,
      alive: p.alive,
      tx: p.tx,
      ty: p.ty,
      cells: p.cells,
      updatedAt: p.updatedAt
    }))
  };
}

function broadcast(room) {
  const message = JSON.stringify(snapshot(room));
  for (const p of room.players.values()) {
    if (p.ws.readyState === p.ws.OPEN) p.ws.send(message);
  }
}

function send(ws, value) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(value));
}

function createPlayer(ws, data) {
  return {
    id: crypto.randomUUID(),
    ws,
    name: cleanName(data.name),
    hue: Number.isFinite(data.hue) ? Math.max(0, Math.min(359, data.hue)) : Math.floor(Math.random() * 360),
    alive: true,
    tx: 2000,
    ty: 2000,
    cells: [{ x: 2000, y: 2000, m: 22, dr: 28 }],
    updatedAt: Date.now()
  };
}

function joinRoom(ws, data) {
  const requested = String(data.room || '').trim().toUpperCase().slice(0, 8);
  const code = requested || roomCode();
  let room = rooms.get(code);
  if (!room) room = { code, mode: cleanMode(data.mode), players: new Map(), createdAt: Date.now() };
  if (room.players.size >= MAX_PLAYERS) return send(ws, { type: 'error', message: 'La sala está llena.' });
  if (data.mode) room.mode = cleanMode(data.mode);

  const player = createPlayer(ws, data);
  room.players.set(player.id, player);
  rooms.set(code, room);
  ws.room = room;
  ws.player = player;
  send(ws, { type: 'joined', id: player.id, room: code, mode: room.mode, maxPlayers: MAX_PLAYERS });
  broadcast(room);
}

function leaveRoom(ws) {
  const room = ws.room;
  if (!room || !ws.player) return;
  room.players.delete(ws.player.id);
  if (room.players.size === 0) rooms.delete(room.code);
  else broadcast(room);
  ws.room = null;
  ws.player = null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: [...rooms.values()].reduce((n, r) => n + r.players.size, 0) }));
  }
  let file = url.pathname === '/' ? 'Células Voraces.html' : decodeURIComponent(url.pathname.slice(1));
  if (file.includes('..') || file.includes('/') || file.includes('\\')) file = 'Células Voraces.html';
  const full = path.join(ROOT, file);
  fs.readFile(full, (err, body) => {
    if (err) return res.writeHead(404).end('Not found');
    const type = full.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
    res.end(body);
  });
});

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return send(ws, { type: 'error', message: 'Mensaje inválido.' }); }
    if (data.type === 'join' && !ws.room) return joinRoom(ws, data);
    if (!ws.room || !ws.player) return;
    if (data.type === 'input') {
      const p = ws.player;
      if (Number.isFinite(data.tx)) p.tx = Math.max(0, Math.min(4000, data.tx));
      if (Number.isFinite(data.ty)) p.ty = Math.max(0, Math.min(4000, data.ty));
      if (Array.isArray(data.cells)) p.cells = data.cells.slice(0, 16).map((c) => ({ x: Number(c.x) || 0, y: Number(c.y) || 0, m: Number(c.m) || 1, dr: Number(c.dr) || 6 }));
      p.alive = Boolean(data.alive);
      p.updatedAt = Date.now();
      if (data.mode) ws.room.mode = cleanMode(data.mode);
    }
    if (data.type === 'leave') leaveRoom(ws);
  });
  ws.on('close', () => leaveRoom(ws));
});

setInterval(() => {
  const cutoff = Date.now() - 15000;
  for (const room of rooms.values()) {
    for (const p of room.players.values()) if (p.updatedAt < cutoff) p.alive = false;
    broadcast(room);
  }
}, 1000);

server.listen(PORT, '0.0.0.0', () => console.log(`Células Voraces server listening on ${PORT}`));
