import { DurableObject } from 'cloudflare:workers';
import { ACTIONS, sanitizeSnapshot, simulateBattle } from './battle-engine.mjs';
import { createSafeDisplayName, isAllowedStamp } from './ranking-rules.mjs';
import {
  createProfile,
  deleteProfile,
  getActiveAwardRank,
  getProfile,
  getWeeklyRankings,
  recordRankedMatch
} from './ranking-store.mjs';

const ROOM_TTL_MS = 15 * 60 * 1000;
const RANKING_RETRY_MS = 30 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=300',
  'x-content-type-options': 'nosniff'
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

function html(body, status = 200) {
  return new Response(body, { status, headers: HTML_HEADERS });
}

function legalPage(title, content) {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{max-width:760px;margin:0 auto;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;line-height:1.75;color:#182817;background:#f7faf4}h1{font-size:1.8rem}h2{margin-top:2rem;font-size:1.2rem}a{color:#196b35}.updated{color:#536353;font-size:.9rem}</style></head><body>${content}</body></html>`;
}

const SUPPORT_PAGE = legalPage('コトダマっち サポート', `
  <h1>コトダマっち サポート</h1>
  <h2>お問い合わせ</h2>
  <p>不具合の報告やご意見は、<a href="mailto:chona4900@gmail.com">chona4900@gmail.com</a> までお送りください。</p>
  <p>お問い合わせの際は、利用中の端末とOSのバージョン、発生した状況を添えていただけると確認がスムーズです。</p>
  <h2>マイクが反応しないとき</h2>
  <ol><li>端末の「設定」から、このアプリのマイク使用を許可してください。</li><li>端末が消音中の場合は、音量を上げてお試しください。</li><li>改善しない場合は、アプリを終了して再度起動してください。</li></ol>
  <h2>データを最初からやり直す</h2>
  <p>ゲーム画面の「B リセット」を選ぶと、キャラクターをタマゴへ戻し、「心のごはん」と今回の進化回数を0にできます。魂のおやつ、戦歴、図鑑、神器などの解放状況、コトダマ杯の記録は残ります。</p>
  <p>コトダマ杯の匿名プロフィール、週間戦績、対戦記録、入賞・受賞履歴を削除したいときだけ、コトダマ杯の画面にある「コトダマ杯のデータを削除」を選んでください。これはBリセットとは別の操作です。サーバー側の削除には通信が必要です。通信エラーが表示された場合は、通信できる状態でもう一度この操作を行ってください。アプリを削除しただけでは、サーバー側の情報は削除されません。</p>
  <h2>データの削除について問い合わせる</h2>
  <p>再操作できない場合や削除できたか確認したい場合は、<a href="mailto:chona4900@gmail.com">chona4900@gmail.com</a> までご連絡ください。分かる場合に限り、ランキング画面の問い合わせ用IDをお知らせください。パスワードや認証用トークンは送らないでください。</p>
  <h2>プライバシー</h2>
  <p><a href="/privacy">プライバシーポリシーを読む</a></p>`);

const PRIVACY_PAGE = legalPage('コトダマっち プライバシーポリシー', `
  <h1>コトダマっち プライバシーポリシー</h1>
  <p class="updated">最終更新日: 2026年8月27日</p>
  <h2>収集する情報</h2>
  <p>コトダマっちは、育成の進行状況、発話した言霊の回数、戦績などのゲームデータを端末内に保存します。聞き取り状況を本人が確認できるよう、端末が文字に変換した直近20件の音声認識結果と、反応した言霊も端末内だけに保存します。音声そのものは保存しません。聞き取り記録はアプリ内の情報画面からいつでも削除できます。通常プレイでは、開発者が運営するサーバーへ、これらのゲームデータ、音声、音声認識結果を送信・保存することはありません。オンライン対戦や「コトダマ杯」を利用する場合だけの通信内容は、下記「オンライン対戦とコトダマ杯」をご確認ください。</p>
  <h2>マイクと音声認識</h2>
  <p>言霊の判定のため、利用者が許可した場合に限りマイクと端末の音声認識機能を使用します。音声認識の処理にはAppleが提供する機能が使用される場合があります。Appleによる情報の取扱いについては、<a href="https://www.apple.com/legal/privacy/" rel="noopener">Appleのプライバシーポリシー</a>をご確認ください。</p>
  <h2>通知と正午のことだま</h2>
  <p>利用者が許可した場合、毎日の「正午のことだま」をお知らせするローカル通知を端末上で予約します。2つの言霊の達成回数と、その日の徳の受取状況は端末内だけに保存され、開発者のサーバーへ送信されません。</p>
  <h2>第三者提供・広告・解析</h2>
  <p>本アプリは、広告SDK、行動解析SDK、利用者の識別を目的としたトラッキングを使用しません。利用者の情報を販売しません。また、サービスの運営に必要な通信・保管と、下記のランキング表示を除き、利用者の情報を第三者へ提供しません。</p>
  <p>オンライン対戦とランキングの通信・保管基盤にはCloudflareのサービスを利用します。送信された情報は、オンライン対戦とランキングの提供、安全確保、不正防止のためだけに取り扱い、広告や行動追跡には利用しません。</p>
  <h2>データの削除</h2>
  <p>ゲーム画面の「B リセット」は、キャラクターをタマゴの状態へ戻し、「心のごはん」とその回の進化回数をリセットします。魂のおやつ、戦歴、図鑑、神器などの解放状況、コトダマ杯の記録、聞き取り記録は残ります。</p>
  <p>オンライン対戦とランキングのためのデータ保存への同意は、コトダマ杯の画面にある「コトダマ杯のデータを削除」からいつでも取り消せます。この操作では、サーバーへ削除を要求し、匿名プロフィール、週間戦績、対戦記録、入賞・受賞履歴と端末内のランキング表示用キャッシュを削除します。通信できない状態や通信エラーのときは、サーバー側の削除が完了しないことがあります。通信できる状態で、もう一度この操作を行ってください。アプリを削除すると端末内のアプリデータは削除されますが、サーバーへは通知できないため、サーバー側の情報は自動では削除されません。再操作できない場合や、削除できたか確認したい場合は、下記のお問い合わせ先までご連絡ください。</p>
  <h2>オンライン対戦とコトダマ杯</h2>
  <p>オンライン対戦またはコトダマ杯を初めて利用するときは、保存する情報と、ほかの利用者へ表示する情報をアプリ内で説明します。コトダマ杯への参加に同意すると、サーバーは無作為なプレイヤーIDと認証用トークンを発行します。認証用トークンそのものは端末内だけに保存し、サーバーには元へ戻せない形に変換した値を保存します。ランキングとオンライン対戦で表示する名前も、安全な言葉の一覧からサーバーが自動で作ります。コトダマ杯への参加に同意しない場合も、匿名プロフィールを使わない一時的なオンライン対戦、育成、CPU戦は遊べます。</p>
  <p>招待コードを使う対戦では、コトダマ杯への参加の有無にかかわらず、対戦の進行に必要なキャラクターの見た目、対戦用ステータス、選択した作戦、招待コードをサーバーへ送信します。対戦用の部屋は2人限定で、部屋の情報と対戦後に送った定型スタンプは、作成から15分以内に削除されます。自由入力の名前、文章、画像、チャットを送る機能はありません。</p>
  <p>週間ランキング「コトダマ杯」の運営と不正防止のため、サーバーが確認した対戦記録（対戦した2人の匿名プレイヤーID、勝敗、対戦日時）を保存します。この記録から、週間の勝利数・対戦した相手の人数と順位を集計します。匿名プロフィール、過去の対戦記録、週間集計、上位3名の入賞記録は、利用者が削除するまで保存します。</p>
  <p>コトダマ杯の画面では、今週の上位100名について、順位、自動生成された表示名、勝利数、対戦した相手の人数（ご縁）をほかの利用者にも表示します。オンライン対戦では、コトダマ杯参加者の自動生成された表示名と、直前大会で上位3名になったことを表す王冠・オーラを対戦相手にも表示します。匿名プレイヤーIDや認証用トークンは対戦相手へ送りません。毎週の集計が終わると新しい週の勝利数は0から始まり、過去の金・銀・銅の入賞回数は本人の画面に残ります。王冠とオーラの表示は次の大会期間中だけです。</p>
  <p>通信できないときにも前回の結果を確認できるよう、最後に読み込んだランキングを端末内に一時保存します。この情報は「コトダマ杯のデータを削除」またはアプリの削除で端末から削除されます。</p>
  <p>音声、音声認識結果、マイク録音、利用者が入力した名前・文章・画像、Apple AccountまたはGoogleアカウントの情報、メールアドレス、連絡先、位置情報は、オンライン対戦やランキングのためにサーバーへ送信・保存しません。</p>
  <h2>お問い合わせ</h2>
  <p>サーバー側のデータの削除、確認、本ポリシーについてのお問い合わせは、<a href="mailto:chona4900@gmail.com">chona4900@gmail.com</a> までご連絡ください。削除のご相談では、分かる場合に限り、アプリのランキング画面に表示される問い合わせ用IDをお知らせください。パスワードや認証用トークンは送らないでください。</p>
  <h2>ポリシーの変更</h2>
  <p>本ポリシーを変更した場合は、このページを更新してお知らせします。</p>
  <p><a href="/support">サポートページへ</a></p>`);

function randomString(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

function randomHex(byteLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
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
  try { return await request.json(); } catch { throw new ApiError(400, 'invalid JSON body'); }
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function constantTimeEqual(first, second) {
  const encoder = new TextEncoder();
  const firstBytes = encoder.encode(typeof first === 'string' ? first : '');
  const secondBytes = encoder.encode(typeof second === 'string' ? second : '');
  if (firstBytes.byteLength !== secondBytes.byteLength) {
    return !crypto.subtle.timingSafeEqual(firstBytes, firstBytes);
  }
  return crypto.subtle.timingSafeEqual(firstBytes, secondBytes);
}

async function authenticateProfile(env, playerId, playerToken, {
  includeActiveAward = false,
  notFoundStatus = 401
} = {}) {
  if (typeof playerId !== 'string' || typeof playerToken !== 'string' || !playerToken) {
    throw new ApiError(401, 'プロフィールの確認に失敗しました。');
  }
  const profile = await getProfile(env.RANKINGS_DB, playerId);
  const suppliedHash = await tokenHash(playerToken);
  const expectedHash = profile?.token_hash || '0'.repeat(64);
  const tokenMatches = constantTimeEqual(expectedHash, suppliedHash);
  if (!profile) {
    throw new ApiError(notFoundStatus, notFoundStatus === 404
      ? 'プロフィールが見つかりません。'
      : 'プロフィールの確認に失敗しました。');
  }
  if (!tokenMatches) {
    throw new ApiError(401, 'プロフィールの確認に失敗しました。');
  }
  const authenticated = {
    playerId: profile.player_id,
    displayName: profile.display_name
  };
  if (includeActiveAward) {
    authenticated.activeAwardRank = await getActiveAwardRank(env.RANKINGS_DB, profile.player_id);
  }
  return authenticated;
}

async function optionalRoomProfile(env, value) {
  if (value == null) return null;
  if (!value || typeof value !== 'object') {
    throw new ApiError(400, 'プロフィールが正しくありません。');
  }
  return authenticateProfile(env, value.playerId, value.playerToken, { includeActiveAward: true });
}

function bearerToken(request) {
  const match = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
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

  async create({ code, matchId, snapshot, tokenHash: hostTokenHash, profile }) {
    if (await this.load()) return json({ error: 'room already exists' }, 409);
    const now = Date.now();
    const room = {
      code,
      matchId,
      createdAt: now,
      expiresAt: now + ROOM_TTL_MS,
      phase: 'waiting',
      host: { snapshot: sanitizeSnapshot(snapshot), tokenHash: hostTokenHash, action: null, stamp: null, profile: profile || null },
      guest: null,
      result: null,
      ranking: null
    };
    await this.save(room);
    await this.ctx.storage.setAlarm(room.expiresAt);
    return json(this.publicRoom(room, 'host'));
  }

  async join({ snapshot, tokenHash: guestTokenHash, profile }) {
    const room = await this.load();
    if (!room || room.expiresAt <= Date.now()) return json({ error: 'room not found or expired' }, 404);
    if (room.guest) return json({ error: 'room is already full' }, 409);
    room.guest = { snapshot: sanitizeSnapshot(snapshot), tokenHash: guestTokenHash, action: null, stamp: null, profile: profile || null };
    room.phase = 'choosing';
    await this.save(room);
    this.broadcast({ type: 'room', room: this.publicRoom(room) });
    return json(this.publicRoom(room, 'guest'));
  }

  async status() {
    const room = await this.load();
    if (!room || room.expiresAt <= Date.now()) return json({ error: 'room not found or expired' }, 404);
    return json(this.publicRoom(room, null, { includeProfile: false }));
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
      const seat = constantTimeEqual(room.host.tokenHash, hash)
        ? 'host'
        : constantTimeEqual(room.guest?.tokenHash, hash) ? 'guest' : null;
      if (!seat) {
        this.send(socket, { type: 'error', message: '入室確認に失敗しました。' });
        socket.close(1008, 'authentication failed');
        return;
      }
      socket.serializeAttachment({ seat });
      return this.send(socket, { type: 'room', room: this.publicRoom(room, seat), seat });
    }

    if (payload.type === 'choose') {
      if (!attachment.seat) return this.send(socket, { type: 'error', message: '先に入室確認が必要です。' });
      return this.choose(socket, room, attachment.seat, payload.action);
    }
    if (payload.type === 'stamp') {
      if (!attachment.seat) return this.send(socket, { type: 'error', message: '先に入室確認が必要です。' });
      if (room.phase !== 'finished') return this.send(socket, { type: 'error', message: 'スタンプは対戦後に送れます。' });
      if (!isAllowedStamp(payload.stamp)) return this.send(socket, { type: 'error', message: 'スタンプが正しくありません。' });
      if (room[attachment.seat].stamp) return this.send(socket, { type: 'error', message: 'スタンプは1回だけ送れます。' });
      room[attachment.seat].stamp = payload.stamp;
      await this.save(room);
      this.broadcast({ type: 'stamp', seat: attachment.seat, stamp: payload.stamp });
      return;
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

    room.result = {
      ...simulateBattle({
        host: room.host.snapshot,
        guest: room.guest.snapshot,
        hostAction: room.host.action,
        guestAction: room.guest.action,
        random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000
      }),
      finishedAt: Date.now()
    };
    room.phase = 'finalizing';
    await this.save(room);

    try {
      room.ranking = await this.recordRoomRanking(room);
    } catch (error) {
      console.error(JSON.stringify({ event: 'ranking-record-failed', matchId: room.matchId, error: String(error) }));
      room.ranking = { eligible: Boolean(room.host.profile && room.guest.profile), counted: false, pending: true };
    }
    room.phase = 'finished';
    await this.save(room);
    await this.scheduleNextAlarm(room);
    this.broadcast({ type: 'result', result: room.result, room: this.publicRoom(room) });
  }

  async alarm() {
    const room = await this.load();
    if (!room || room.expiresAt <= Date.now()) {
      await this.ctx.storage.deleteAll();
      this.broadcast({ type: 'expired' }, { includeUnauthenticated: true });
      for (const socket of this.ctx.getWebSockets()) socket.close(1000, 'room expired');
      return;
    }

    if (room.ranking?.pending) {
      try {
        room.ranking = await this.recordRoomRanking(room);
        await this.save(room);
      } catch (error) {
        console.error(JSON.stringify({ event: 'ranking-retry-failed', matchId: room.matchId, error: String(error) }));
      }
    }
    await this.scheduleNextAlarm(room);
  }

  async recordRoomRanking(room) {
    const hostId = room.host.profile?.playerId;
    const guestId = room.guest.profile?.playerId;
    if (!hostId || !guestId || hostId === guestId) {
      return { eligible: false, counted: false, pending: false };
    }
    const winnerId = room.result.hostWon ? hostId : guestId;
    const loserId = room.result.hostWon ? guestId : hostId;
    const recorded = await recordRankedMatch(this.env.RANKINGS_DB, {
      matchId: room.matchId,
      hostId,
      guestId,
      winnerId,
      loserId,
      finishedAt: room.result.finishedAt || Date.now()
    });
    return { ...recorded, pending: false };
  }

  async scheduleNextAlarm(room) {
    const retryAt = room.ranking?.pending ? Date.now() + RANKING_RETRY_MS : room.expiresAt;
    await this.ctx.storage.setAlarm(Math.min(retryAt, room.expiresAt));
  }

  publicRoom(room, seat, { includeProfile = true } = {}) {
    const player = (name) => room[name] ? {
      form: room[name].snapshot.form,
      wins: room[name].snapshot.wins,
      displayName: includeProfile ? room[name].profile?.displayName || null : null,
      awardRank: includeProfile ? room[name].profile?.activeAwardRank || null : null,
      selected: Boolean(room[name].action),
      isYou: seat === name
    } : null;
    return {
      code: room.code,
      phase: room.phase,
      expiresAt: room.expiresAt,
      ranking: room.ranking,
      host: player('host'),
      guest: player('guest')
    };
  }

  send(socket, payload) {
    try { socket.send(JSON.stringify(payload)); } catch { /* socket was closed */ }
  }

  broadcast(payload, { includeUnauthenticated = false } = {}) {
    const encoded = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      if (!includeUnauthenticated && !socket.deserializeAttachment()?.seat) continue;
      try { socket.send(encoded); } catch { /* socket was closed */ }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'GET' && (url.pathname === '/support' || url.pathname === '/support/')) return html(SUPPORT_PAGE);
    if (request.method === 'GET' && (url.pathname === '/privacy' || url.pathname === '/privacy/')) return html(PRIVACY_PAGE);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        ...cors,
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        'access-control-allow-headers': 'content-type, authorization'
      }});
    }
    if (url.pathname === '/health') return withCors(json({ ok: true }), request, env);

    const profileMatch = url.pathname.match(/^\/v1\/profiles(?:\/([^/]+))?$/);
    const isWeeklyRankings = url.pathname === '/v1/rankings/weekly';
    const match = url.pathname.match(/^\/v1\/rooms(?:\/([A-Z2-9]{6})(\/socket)?)?$/);

    try {
      if (profileMatch && !profileMatch[1] && request.method === 'POST') {
        const playerId = crypto.randomUUID();
        const playerToken = randomHex(32);
        const displayName = createSafeDisplayName(crypto.getRandomValues(new Uint8Array(4)));
        await createProfile(env.RANKINGS_DB, {
          playerId,
          tokenHash: await tokenHash(playerToken),
          displayName,
          createdAt: Date.now()
        });
        return withCors(json({ playerId, playerToken, displayName }, 201), request, env);
      }

      if (profileMatch?.[1] && request.method === 'DELETE') {
        const playerId = decodeURIComponent(profileMatch[1]);
        await authenticateProfile(env, playerId, bearerToken(request), { notFoundStatus: 404 });
        await deleteProfile(env.RANKINGS_DB, playerId);
        return withCors(new Response(null, { status: 204 }), request, env);
      }

      if (profileMatch) {
        return withCors(json({ error: 'method not allowed' }, 405), request, env);
      }

      if (isWeeklyRankings && request.method === 'GET') {
        const playerId = url.searchParams.get('playerId') || null;
        if (playerId) await authenticateProfile(env, playerId, bearerToken(request));
        const rankings = await getWeeklyRankings(env.RANKINGS_DB, playerId);
        return withCors(json(rankings), request, env);
      }

      if (isWeeklyRankings) {
        return withCors(json({ error: 'method not allowed' }, 405), request, env);
      }

      if (!match) return withCors(json({ error: 'not found' }, 404), request, env);
      const [, code, socketPath] = match;

      if (!code && request.method === 'POST') {
        const body = await readJson(request);
        const roomCode = randomString(6);
        const playerToken = randomString(48);
        const profile = await optionalRoomProfile(env, body.profile);
        const stub = env.BATTLE_ROOM.getByName(roomCode);
        const response = await stub.fetch('https://room/internal/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            code: roomCode,
            matchId: crypto.randomUUID(),
            snapshot: body.snapshot,
            tokenHash: await tokenHash(playerToken),
            profile
          })
        });
        const data = await response.json();
        return withCors(json({ ...data, playerToken }, response.status), request, env);
      }

      if (code && !socketPath && request.method === 'POST') {
        const body = await readJson(request);
        const playerToken = randomString(48);
        const profile = await optionalRoomProfile(env, body.profile);
        const stub = env.BATTLE_ROOM.getByName(code);
        const response = await stub.fetch('https://room/internal/join', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ snapshot: body.snapshot, tokenHash: await tokenHash(playerToken), profile })
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
      if (error instanceof ApiError) {
        return withCors(json({ error: error.message }, error.status), request, env);
      }
      console.error(JSON.stringify({ event: 'battle-api-error', error: String(error) }));
      return withCors(json({ error: '通信処理に失敗しました。時間をおいて再試行してください。' }, 500), request, env);
    }
  }
};
