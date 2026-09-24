// client.js
const socket = io();
const qs = new URLSearchParams(location.search);
const myName = qs.get('u') || ('User' + Math.floor(Math.random() * 1000));

const meEl = document.getElementById('me');
const contactsEl = document.getElementById('contacts');
const groupsEl = document.getElementById('groups');
const dockEl = document.getElementById('dock');
const beep = document.getElementById('beep');
const pane = document.getElementById('contactsPane');

// optional new UI refs (safe if missing)
const searchEl = document.getElementById('contactSearch');
const addBtn = document.getElementById('addContact');

meEl.textContent = `Signed in as ${myName}`;
document.getElementById('togglePane').onclick = () => pane.classList.toggle('open');

const state = {
  self: null,
  roster: [],
  groups: new Map(),
  chats: new Map(),
  contacts: [] // saved contacts list (with online/offline)
};

// join
socket.emit('join', { name: myName });
socket.emit('getContacts');

socket.on('joined', ({ self, groups }) => {
  state.self = self;
  groups.forEach(g => state.groups.set(g.id, g));
  renderContacts();
  renderGroups();
});

socket.on('roster', roster => {
  state.roster = roster.filter(r => r.id !== state.self?.id);
  // roster is used for Add Contact prompt and presence updates
  // refresh contacts presence if IDs match
  refreshContactsPresence();
  renderContacts();
});

socket.on('contacts', list => {
  state.contacts = Array.isArray(list) ? list : [];
  refreshContactsPresence();
  renderContacts();
});

socket.on('groupCreated', g => {
  state.groups.set(g.id, g);
  renderGroups();
});

function refreshContactsPresence() {
  const onlineIds = new Set(state.roster.map(r => r.id));
  state.contacts = state.contacts.map(c => ({ ...c, online: onlineIds.has(c.id) }));
}

function renderContacts() {
  const q = (searchEl?.value || '').toLowerCase();
  contactsEl.innerHTML = '';
  state.contacts
    .filter(c => (c.name || '').toLowerCase().includes(q))
    .forEach(c => {
      const row = document.createElement('div');
      row.className = 'item';
      const dot = c.online ? 'online' : 'offline';
      const avatar = c.avatar || '';
      row.innerHTML =
        `<img class="avatar" src="${avatar}">
         <div class="name">${c.name}</div>
         <div class="presence ${dot}"></div>`;
      row.onclick = () => openChat({ id: c.id, name: c.name, isGroup: false });
      contactsEl.appendChild(row);
    });
}

function renderGroups() {
  groupsEl.innerHTML = '';
  [...state.groups.values()].forEach(g => {
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML =
      `<div class="avatar" style="background:#c7d2fe"></div>
       <div class="name">${g.name}</div>`;
    row.onclick = () => openChat({ id: g.id, name: g.name, isGroup: true });
    groupsEl.appendChild(row);
  });
}

// quick group maker
document.getElementById('newGroup').onclick = () => {
  const name = prompt('Group name?');
  if (!name) return;
  const memberIds = state.roster.slice(0, 5).map(u => u.id).concat(state.self.id);
  socket.emit('createGroup', { name, memberIds });
};

// search + add contact
searchEl?.addEventListener('input', renderContacts);
addBtn?.addEventListener('click', () => {
  const choice = prompt('Add contact by name');
  if (!choice) return;
  const u = state.roster.find(x => (x.name || '').toLowerCase() === choice.toLowerCase());
  if (!u) return alert('User not found online.');
  socket.emit('addContact', { contactId: u.id });
});

// open chat box
function openChat(target) {
  const key = (target.isGroup ? 'G:' : 'U:') + target.id;
  if (state.chats.has(key)) return;

  const el = document.createElement('div');
  el.className = 'chatbox';
  el.innerHTML = `
    <div class="cb-header">
      <div class="cb-title">${target.isGroup ? 'Group: ' : ''}${target.name}</div>
      <div class="cb-actions">
        <button class="btn-video">🎥</button>
        <button class="btn-min">▁</button>
        <button class="btn-close">✕</button>
      </div>
    </div>
    <div class="typing"></div>
    <div class="cb-log"></div>
    <div class="cb-input">
      <input class="text" placeholder="Type a message…" />
      <label class="btn-file">📎<input class="file" type="file" accept="image/*,video/*,.pdf,.txt"/></label>
      <button class="btn-emoji" title="Emoji">😀</button>
      <button class="btn-send">Send</button>
      <div class="emoji-pop hidden"></div>
    </div>
  `;
  dockEl.appendChild(el);

  const log = el.querySelector('.cb-log');
  const typing = el.querySelector('.typing');
  const text = el.querySelector('.text');
  const file = el.querySelector('.file');
  const emojiBtn = el.querySelector('.btn-emoji');
  const pop = el.querySelector('.emoji-pop');

  const handlers = {
    send(payload) {
      if (target.isGroup) socket.emit('gm', { groupId: target.id, payload });
      else socket.emit('pm', { to: target.id, payload });
      beep.play().catch(() => {});
    },
    append(fromSelf, contentHtml) {
      const m = document.createElement('div');
      m.className = 'msg' + (fromSelf ? ' me' : '');
      m.innerHTML = `<div class="bubble">${contentHtml}</div>`;
      log.appendChild(m);
      log.scrollTop = log.scrollHeight;
    }
  };

  // typing
  text.addEventListener('input', () =>
    socket.emit('typing', { to: target.id, isGroup: target.isGroup, typing: true })
  );

  // send text
  el.querySelector('.btn-send').onclick = () => {
    const val = text.value.trim();
    if (!val) return;
    handlers.send({ kind: 'text', text: val });
    handlers.append(true, escapeHtml(val));
    text.value = '';
  };

  // send file
  file.onchange = async () => {
    const f = file.files[0];
    if (!f) return;
    const b64 = await toDataURL(f);
    const html = f.type.startsWith('image/')
      ? `<img src="${b64}" style="max-width:220px; border-radius:8px;">`
      : `<a download href="${b64}">${f.name}</a>`;
    handlers.send({ kind: 'file', name: f.name, mime: f.type, dataUrl: b64 });
    handlers.append(true, html);
    file.value = '';
  };

  // window actions
  el.querySelector('.btn-close').onclick = () => { dockEl.removeChild(el); state.chats.delete(key); };
  el.querySelector('.btn-min').onclick = () => { el.style.height = el.style.height ? '' : '42px'; };
  el.querySelector('.btn-video').onclick = () => openJitsiFor(target);

  // emoji picker (simple)
  const EMOJI = ['😀','😁','😂','🤣','😊','🙂','😉','😍','😘','😎','🤩','🤔','🤨','😴','😇','😢','😭','😡','👍','👋','🙏','👏','🔥','❤️','💯','🚀','🤝','🎯','📎','📝'];
  pop.innerHTML = EMOJI.map(e => `<button type="button">${e}</button>`).join('');
  emojiBtn.onclick = () => { pop.classList.toggle('hidden'); };
  pop.addEventListener('click', e => {
    if (e.target.tagName === 'BUTTON') {
      insertAtCursor(text, e.target.textContent);
      pop.classList.add('hidden');
      text.focus();
    }
  });

  state.chats.set(key, { el, target, handlers });
}

// typing indicator receive
socket.on('typing', ({ from }) => {
  for (const c of state.chats.values()) {
    if (c.target.id === from) {
      c.el.querySelector('.typing').textContent = 'typing…';
      setTimeout(() => (c.el.querySelector('.typing').textContent = ''), 800);
    }
  }
});

// incoming PM
socket.on('pm', msg => {
  const fromUser = state.roster.find(u => u.id === msg.from) || state.self;
  const target = { id: msg.from, name: fromUser?.name || 'User', isGroup: false };
  ensureChatAndRender(target, msg);
});

// incoming GM
socket.on('gm', msg => {
  const g = state.groups.get(msg.groupId);
  if (!g) return;
  const target = { id: g.id, name: g.name, isGroup: true };
  ensureChatAndRender(target, msg);
});

function ensureChatAndRender(target, msg) {
  const key = (target.isGroup ? 'G:' : 'U:') + target.id;
  if (!state.chats.has(key)) openChat(target);
  const { handlers } = state.chats.get(key);
  const content =
    msg.kind === 'file'
      ? (msg.mime?.startsWith('image/')
          ? `<img src="${msg.dataUrl}" style="max-width:220px; border-radius:8px;">`
          : `<a download href="${msg.dataUrl}">${msg.name || 'file'}</a>`)
      : escapeHtml(msg.text || '');
  handlers.append(false, content);
  beep.play().catch(() => {});
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function toDataURL(file) {
  return new Promise(r => {
    const fr = new FileReader();
    fr.onload = () => r(fr.result);
    fr.readAsDataURL(file);
  });
}

function insertAtCursor(input, toInsert) {
  const s = input.selectionStart, e = input.selectionEnd;
  const v = input.value;
  input.value = v.slice(0, s) + toInsert + v.slice(e);
  const caret = s + toInsert.length;
  input.setSelectionRange(caret, caret);
}

// Jitsi
let jitsiApi = null;
function openJitsiFor(target) {
  const room = 'Demo_' + (target.isGroup ? target.id : [state.self.id, target.id].sort().join('_'));
  let cont = document.getElementById('jitsiContainer');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'jitsiContainer';
    document.body.appendChild(cont);
  }
  cont.style.display = 'block';
  if (!document.getElementById('jitsiApi')) {
    const s = document.createElement('script');
    s.id = 'jitsiApi';
    s.src = 'https://meet.jit.si/external_api.js';
    s.onload = () => spawn();
    document.body.appendChild(s);
  } else {
    spawn();
  }

  function spawn() {
    if (jitsiApi) jitsiApi.dispose();
    jitsiApi = new JitsiMeetExternalAPI('meet.jit.si', {
      roomName: room,
      parentNode: document.getElementById('jitsiContainer'),
      interfaceConfigOverwrite: { TILE_VIEW_MAX_COLUMNS: 3 },
      userInfo: { displayName: state.self.name }
    });
  }
}
