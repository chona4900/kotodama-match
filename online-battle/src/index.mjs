import { DurableObject } from 'cloudflare:workers';
import { ACTIONS, sanitizeSnapshot, simulateBattle } from './battle-engine.mjs';

const ROOM_TTL_MS = 15 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

function randomString(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

async function tokenHash(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim());
  if (origin && allowed.includes(origin)) {
    return { 'access-control-allow-origin': origin, 'vary': 'Origin' };
  }
  return {};
}

function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(request, env))) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}

async function readJson(request) {
  try { return await request.json(); } catch { throw new Error('invalid JSON body'); }
}

export class BattleRoom extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/internal/create' && request.method === 'POST') return this.create(await readJson(request));
    if (url.pathname === '/internal/join' && request.method === 'POST') return this.join(await readJson(request));
    if (url.pathname === '/internal/status' && request.method === 'GET') return this.status();
    if (url.pathname === '/internal/socket' && request.headers.get('Upgrade') === 'websocket') return this.connect();
    return json({ error: 'not found' }, 404);
  }

  async load() { return this.ctx.storage.get('room'); }
  async save(room) { await this.ctx.storage.put('room', room); }

  async create({ code, snapshot, tokenHash: hostTokenHash }) {
    if (await this.load()) return json({ error: 'room already exists' }, 409);
    const now = Date.now();
    const room = {
      code,
      createdAt: now,
      expiresAt: now + ROOM_TTL_MS,
      phase: 'waiting',
      host: { snapshot: sanitizeSnapshot(snapshot), tokenHash: hostTokenHash, action: null },
      guest: null,
      result: null
    };
    await this.save(room);
    await this.ctx.storage.setAlarm(room.expiresAt);
    return json(this.publicRoom(room, 'host'));
  }

  async join({ snapshot, tokenHash: guestTokenHash }) {
    const room = await this.load();
    if (!room || room.expiresAt <= Date.now()) return json({ error: 'room not found or expired' }, 404);
    if (room.guest) return json({ error: 'room is already full' }, 409);
    room.guest = { snapshot: sanitizeSnapshot(snapshot), tokenHash: guestTokenHash, action: null };
    room.phase = 'choosing';
    await this.save(room);
    this.broadcast({ type: 'room', room: this.publicRoom(room) });
    return json(this.publicRoom(room, 'guest'));
  }

  async status() {
    const room = await this.load();
    if (!room || room.expiresAt <= Date.now()) return json({ error: 'room not found or expired' }, 404);
    return json(this.publicRoom(room));
  }

  connect() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ seat: null });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, message) {
    let payload;
    try { payload = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message)); }
    catch { return this.send(socket, { type: 'error', message: '通信データを読み取れませんでした。' }); }

    const room = await this.load();
    if (!room || room.expiresAt <= Date.now()) return this.send(socket, { type: 'expired' });
    const attachment = socket.deserializeAttachment() || {};

    if (payload.type === 'auth') {
      const hash = await tokenHash(String(payload.token || ''));
      const seat = room.host.tokenHash === hash ? 'host' : room.guest?.tokenHash === hash ? 'guest' : null;
      if (!seat) return this.send(socket, { type: 'error', message: '入室確認に失敗しました。' });
      socket.serializeAttachment({ seat });
      return this.send(socket, { type: 'room', room: this.publicRoom(room, seat), seat });
    }

    if (payload.type === 'choose') {
      if (!attachment.seat) return this.send(socket, { type: 'error', message: '先に入室確認が必要です。' });
      return this.choose(socket, room, attachment.seat, payload.action);
    }
    return this.send(socket, { type: 'error', message: '不明な操作です。' });
  }

  async choose(socket, room, seat, action) {
    if (!ACTIONS.has(action)) return this.send(socket, { type: 'error', message: '作戦が正しくありません。' });
    if (room.phase !== 'choosing' || !room.host || !room.guest) return this.send(socket, { type: 'error', message: 'まだ対戦を始められません。' });
    if (room[seat].action) return this.send(socket, { type: 'error', message: '作戦は一度だけ選べます。' });
    room[seat].action = action;

    if (!room.host.action || !room.guest.action) {
      await this.save(room);
      this.broadcast({ type: 'waiting', seat, room: this.publicRoom(room) });
      return;
    }

    room.result = simulateBattle({
      host: room.host.snapshot,
      guest: room.guest.snapshot,
      hostAction: room.host.action,
      guestAction: room.guest.action,
      random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000
    });
    room.phase = 'finished';
    await this.save(room);
    this.broadcast({ type: 'result', result: room.result, room: this.publicRoom(room) });
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
    this.broadcast({ type: 'expired' });
    for (const socket of this.ctx.getWebSockets()) socket.close(1000, 'room expired');
  }

  publicRoom(room, seat) {
    const player = (name) => room[name] ? {
      form: room[name].snapshot.form,
      wins: room[name].snapshot.wins,
      selected: Boolean(room[name].action),
      isYou: seat === name
    } : null;
    return {
      code: room.code,
      phase: room.phase,
      expiresAt: room.expiresAt,
      host: player('host'),
      guest: player('guest')
    };
  }

  send(socket, payload) {
    try { socket.send(JSON.stringify(payload)); } catch { /* socket was closed */ }
  }

  broadcast(payload) {
    const encoded = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(encoded); } catch { /* socket was closed */ }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        ...cors,
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type'
      }});
    }
    if (url.pathname === '/health') return withCors(json({ ok: true }), request, env);

    const match = url.pathname.match(/^\/v1\/rooms(?:\/([A-Z2-9]{6})(\/socket)?)?$/);
    if (!match) return withCors(json({ error: 'not found' }, 404), request, env);
    const [, code, socketPath] = match;

    try {
      if (!code && request.method === 'POST') {
        const body = await readJson(request);
        const roomCode = randomString(6);
        const playerToken = randomString(48);
        const stub = env.BATTLE_ROOM.getByName(roomCode);
        const response = await stub.fetch('https://room/internal/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: roomCode, snapshot: body.snapshot, tokenHash: await tokenHash(playerToken) })
        });
        const data = await response.json();
        return withCors(json({ ...data, playerToken }, response.status), request, env);
      }

      if (code && !socketPath && request.method === 'POST') {
        const body = await readJson(request);
        const playerToken = randomString(48);
        const stub = env.BATTLE_ROOM.getByName(code);
        const response = await stub.fetch('https://room/internal/join', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ snapshot: body.snapshot, tokenHash: await tokenHash(playerToken) })
        });
        const data = await response.json();
        return withCors(json({ ...data, playerToken }, response.status), request, env);
      }

      if (code && !socketPath && request.method === 'GET') {
        const stub = env.BATTLE_ROOM.getByName(code);
        return withCors(await stub.fetch('https://room/internal/status'), request, env);
      }

      if (code && socketPath && request.headers.get('Upgrade') === 'websocket') {
        const stub = env.BATTLE_ROOM.getByName(code);
        return stub.fetch('https://room/internal/socket', request);
      }
      return withCors(json({ error: 'method not allowed' }, 405), request, env);
    } catch (error) {
      console.error('battle-api-error', error);
      return withCors(json({ error: '通信処理に失敗しました。時間をおいて再試行してください。' }, 500), request, env);
    }
  }
};
