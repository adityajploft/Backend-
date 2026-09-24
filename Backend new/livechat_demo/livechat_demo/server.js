const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));
app.use(express.json());


const users = new Map();        // socket.id -> { id, name, avatar, online:true }
const groups = new Map();       // groupId -> { id, name, members:Set(userIds) }

const contactsOf = new Map(); // ownerSocketId -> Set(contactSocketId)

function sendContacts(sock) {
  const set = contactsOf.get(sock.id) || new Set();
  const contacts = [...set].map(id => {
    const u = users.get(id);
    return u ? { id: u.id, name: u.name, avatar: u.avatar, online: true }
             : { id, name: '(offline)', avatar: '', online: false };
  });
  sock.emit('contacts', contacts);
}


function broadcastRoster() {
  const roster = [...users.values()].map(u => ({ id: u.id, name: u.name, avatar: u.avatar, online: u.online }));
  io.emit('roster', roster);
}

io.on('connection', socket => {
  socket.on('join', ({ name, avatar }) => {
    const u = { id: socket.id, name, avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`, online: true };
    users.set(socket.id, u);
    if (!contactsOf.has(socket.id)) contactsOf.set(socket.id, new Set());
    socket.emit('joined', { self: u, groups: [...groups.values()] });
    sendContacts(socket);
    broadcastRoster();


    socket.emit('joined', { self: u, groups: [...groups.values()] });
    broadcastRoster();

    socket.on('addContact', ({ contactId }) => {
    if (!contactsOf.has(socket.id)) contactsOf.set(socket.id, new Set());
    contactsOf.get(socket.id).add(contactId);
    sendContacts(socket);
    });

    socket.on('getContacts', () => sendContacts(socket));

  });

  socket.on('typing', ({ to, isGroup }) => {
    if (isGroup) io.to(to).emit('typing', { from: socket.id });
    else io.to(to).emit('typing', { from: socket.id });
  });

  socket.on('pm', ({ to, payload }) => {
    const msg = { id: uuidv4(), from: socket.id, to, ts: Date.now(), ...payload };
    io.to(to).emit('pm', msg);
    io.to(socket.id).emit('pm', msg); // echo for sender window
  });

  socket.on('createGroup', ({ name, memberIds }) => {
    const id = 'g_' + uuidv4();
    const memberSet = new Set(memberIds);
    groups.set(id, { id, name, members: memberSet });
    for (const [sid, u] of users.entries()) if (memberSet.has(sid)) io.to(sid).emit('groupCreated', { id, name, members: [...memberSet] });
  });

  socket.on('gm', ({ groupId, payload }) => {
    const g = groups.get(groupId);
    if (!g) return;
    const msg = { id: uuidv4(), from: socket.id, groupId, ts: Date.now(), ...payload };
    for (const sid of g.members) io.to(sid).emit('gm', msg);
  });

  socket.on('joinRoom', room => socket.join(room));
  socket.on('leaveRoom', room => socket.leave(room));

  socket.on('disconnect', () => {
    const u = users.get(socket.id);
    if (u) { u.online = false; users.delete(socket.id); }
    broadcastRoster();
  });
});

app.post('/api/contacts/auto-add', (req, res) => {
  const { owner_id, contact_id } = req.body || {};
  if (!owner_id || !contact_id) return res.status(400).json({ error: 'owner_id and contact_id required' });
  if (!contactsOf.has(owner_id)) contactsOf.set(owner_id, new Set());
  contactsOf.get(owner_id).add(contact_id);
  const sock = io.sockets.sockets.get(owner_id);
  if (sock) sendContacts(sock);
  return res.json({ ok: true });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
