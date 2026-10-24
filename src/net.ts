import Peer, { type DataConnection } from 'peerjs';

/** A message between devices: `k` says what it is. */
export interface Msg {
  k: string;
  [key: string]: unknown;
}

/** One line to one other device. */
interface Link {
  id: string;
  send(m: Msg): void;
  close(): void;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O, easy to read out loud

export function makeRoomCode(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

/**
 * Host-run multiplayer plumbing. One device hosts a room (a short code); the others join it. Messages go over a WebRTC data channel
 * (through PeerJS's free signalling server), or over a BroadcastChannel between tabs of one browser when `?net=local` is used for testing.
 */
export class Net {
  role: 'off' | 'host' | 'client' = 'off';
  code = '';
  /** Host: every connected client. Client: just the host. */
  private links = new Map<string, Link>();
  private peer: Peer | null = null;
  private bc: BroadcastChannel | null = null;
  private localId = '';
  readonly local = new URLSearchParams(location.search).get('net') === 'local';

  onMessage: (from: string, m: Msg) => void = () => {};
  /** Host: a device connected / went away. */
  onJoin: (id: string) => void = () => {};
  onLeave: (id: string) => void = () => {};
  /** Client: the line to the host dropped. */
  onHostLost: () => void = () => {};

  get active(): boolean {
    return this.role !== 'off';
  }
  get clients(): string[] {
    return [...this.links.keys()];
  }

  // ---------------------------------------------------------------- host ----

  /** Open a room and start listening. Resolves with the code once joiners can find it. */
  host(code: string): Promise<string> {
    this.role = 'host';
    this.code = code;
    return this.local ? this.hostLocal(code) : this.hostPeer(code);
  }

  private hostPeer(code: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const peer = new Peer('pgm-' + code, { debug: 0 });
      this.peer = peer;
      peer.on('open', () => resolve(code));
      peer.on('error', (e) => reject(e));
      peer.on('connection', (conn) => this.adopt(conn, true));
    });
  }

  private adopt(conn: DataConnection, asHost: boolean) {
    const link: Link = { id: conn.peer, send: (m) => { try { if (conn.open) conn.send(m); } catch { /* the line is going down */ } }, close: () => conn.close() };
    const up = () => {
      this.links.set(conn.peer, link);
      if (asHost) this.onJoin(conn.peer);
    };
    if (conn.open) up();
    else conn.on('open', up);
    conn.on('data', (d) => this.onMessage(conn.peer, d as Msg));
    const down = () => {
      if (!this.links.delete(conn.peer)) return;
      if (asHost) this.onLeave(conn.peer);
      else this.onHostLost();
    };
    conn.on('close', down);
    conn.on('error', down);
  }

  // -------------------------------------------------------------- client ----

  join(code: string): Promise<void> {
    this.role = 'client';
    this.code = code;
    return this.local ? this.joinLocal(code) : this.joinPeer(code);
  }

  private joinPeer(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const peer = new Peer({ debug: 0 });
      this.peer = peer;
      const timer = window.setTimeout(() => reject(new Error('timeout')), 12000);
      peer.on('error', (e) => { clearTimeout(timer); reject(e); });
      peer.on('open', () => {
        const conn = peer.connect('pgm-' + code, { serialization: 'json', reliable: true });
        conn.on('open', () => { clearTimeout(timer); resolve(); });
        this.adopt(conn, false);
      });
    });
  }

  // ------------------------------------------------- local (same browser) ----

  private hostLocal(code: string): Promise<string> {
    this.localId = 'host';
    const bc = new BroadcastChannel('pgm-' + code);
    this.bc = bc;
    bc.onmessage = (e) => {
      const d = e.data as { to: string; from: string; m: Msg };
      if (d.to !== 'host') return;
      if (d.m.k === 'hello-link') {
        const id = d.from;
        if (!this.links.has(id)) {
          this.links.set(id, { id, send: (m) => bc.postMessage({ to: id, from: 'host', m }), close: () => this.links.delete(id) });
          this.onJoin(id);
        }
        return;
      }
      this.onMessage(d.from, d.m);
    };
    return Promise.resolve(code);
  }

  private joinLocal(code: string): Promise<void> {
    this.localId = 'c' + Math.random().toString(36).slice(2, 7);
    const bc = new BroadcastChannel('pgm-' + code);
    this.bc = bc;
    this.links.set('host', { id: 'host', send: (m) => bc.postMessage({ to: 'host', from: this.localId, m }), close: () => this.links.delete('host') });
    bc.onmessage = (e) => {
      const d = e.data as { to: string; from: string; m: Msg };
      if (d.to !== this.localId) return;
      this.onMessage('host', d.m);
    };
    bc.postMessage({ to: 'host', from: this.localId, m: { k: 'hello-link' } });
    return Promise.resolve();
  }

  // ------------------------------------------------------------- sending ----

  /** Client: to the host. */
  sendHost(m: Msg) {
    for (const l of this.links.values()) l.send(m);
  }
  /** Host: to everybody. */
  sendAll(m: Msg) {
    for (const l of this.links.values()) l.send(m);
  }
  /** Host: to one device. */
  sendTo(id: string, m: Msg) {
    this.links.get(id)?.send(m);
  }
  kick(id: string) {
    this.links.get(id)?.close();
    this.links.delete(id);
  }

  close() {
    for (const l of this.links.values()) l.close();
    this.links.clear();
    this.peer?.destroy();
    this.bc?.close();
    this.peer = null;
    this.bc = null;
    this.role = 'off';
  }
}

export const net = new Net();
