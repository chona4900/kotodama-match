import assert from 'node:assert/strict';

const baseUrl = String(process.argv[2] || 'http://127.0.0.1:8788').replace(/\/$/, '');
const socketBaseUrl = baseUrl.replace(/^http/, 'ws');
const snapshot = { form: 'adult_1', hp: 100, attack: 10, evasionRate: 5, criticalRate: 5, wins: 0 };

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.ok, true, JSON.stringify(payload));
  return payload;
}

function openPlayerSocket(code, token) {
  const socket = new WebSocket(`${socketBaseUrl}/v1/rooms/${code}/socket`);
  const messages = [];
  const listeners = new Set();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    messages.push(message);
    listeners.forEach(listener => listener(message));
  });
  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'auth', token }));
      resolve();
    }, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const waitFor = (predicate, timeoutMs = 3000, startIndex = 0) => {
    const existing = messages.slice(startIndex).find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        listeners.delete(onMessage);
        reject(new Error(`Timed out waiting for message. Received: ${JSON.stringify(messages)}`));
      }, timeoutMs);
      const onMessage = (message) => {
        if (!predicate(message)) return;
        clearTimeout(timeout);
        listeners.delete(onMessage);
        resolve(message);
      };
      listeners.add(onMessage);
    });
  };
  return { socket, opened, waitFor, messages };
}

const hostRoom = await post('/v1/rooms', { snapshot });
const host = openPlayerSocket(hostRoom.code, hostRoom.playerToken);
await host.opened;
await host.waitFor(message => message.type === 'room' && message.room.phase === 'waiting');

const guestRoom = await post(`/v1/rooms/${hostRoom.code}`, { snapshot: { ...snapshot, form: 'adult_2' } });
const connecting = await host.waitFor(message => message.type === 'room' && message.room.phase === 'connecting');
assert.equal(connecting.room.host.connected, true);
assert.equal(connecting.room.guest.connected, false);

const guest = openPlayerSocket(hostRoom.code, guestRoom.playerToken);
await guest.opened;
const [hostReady, guestReady] = await Promise.all([
  host.waitFor(message => message.type === 'room' && message.room.phase === 'choosing'),
  guest.waitFor(message => message.type === 'room' && message.room.phase === 'choosing')
]);
assert.equal(hostReady.room.host.connected && hostReady.room.guest.connected, true);
assert.equal(guestReady.room.host.connected && guestReady.room.guest.connected, true);

const disconnectStartIndex = host.messages.length;
guest.socket.close(1000, 'integration check');
const peerDisconnected = await host.waitFor(
  message => message.type === 'room' && message.room.phase === 'connecting',
  3000,
  disconnectStartIndex
);
assert.equal(peerDisconnected.room.guest.connected, false);

const reconnectStartIndex = host.messages.length;
const reconnectedGuest = openPlayerSocket(hostRoom.code, guestRoom.playerToken);
await reconnectedGuest.opened;
await Promise.all([
  host.waitFor(message => message.type === 'room' && message.room.phase === 'choosing', 3000, reconnectStartIndex),
  reconnectedGuest.waitFor(message => message.type === 'room' && message.room.phase === 'choosing')
]);

host.socket.send(JSON.stringify({ type: 'choose', action: 'attack' }));
await host.waitFor(message => message.type === 'waiting' && message.seat === 'host');
reconnectedGuest.socket.send(JSON.stringify({ type: 'choose', action: 'guard' }));
await Promise.all([
  host.waitFor(message => message.type === 'result'),
  reconnectedGuest.waitFor(message => message.type === 'result')
]);

reconnectedGuest.socket.close(1000, 'integration check');
host.socket.close(1000, 'integration check');
console.log('Online room integration check passed.');
