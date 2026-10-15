/* ==========================================================================
   PEER-TO-PEER (v24)
   Ingen server i skyen: den der laver et party, kører spil-serveren i sin egen app (desktop/main.js).
   Vennerne forbinder direkte til værtens app via WebRTC, og værtens app sender trafikken videre til
   sin lokale server. PeerJS' gratis offentlige server bruges kun til at finde hinanden ud fra party-koden –
   selve spillet går direkte mellem spillerne.
   ========================================================================== */
const PREFIX = 'whitedust-lk-';   // party-kode 1234 → peer-id "whitedust-lk-1234"
const OPTS = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ]
  }
};

let hostPeer = null, hostCode = null;
// Spillet pinger hvert 2. sekund og serveren svarer/sender snapshots, så 8 s stilhed = forbindelsen er død
// (en WebRTC-forbindelse til en computer der er slukket, kan ellers tage meget længe om at lukke)
const SILENCE_MS = 8000;

// Værtens side: én WebRTC-forbindelse pr. ven ↔ én WebSocket til den lokale server
function bridge(conn, localUrl) {
  const b = (conn.metadata && conn.metadata.b) || '';
  let ws = null, queue = [], lastRx = Date.now();
  const watch = setInterval(() => { if (Date.now() - lastRx > SILENCE_MS) closeBoth(); }, 2000);
  const closeBoth = () => {
    clearInterval(watch);
    try { ws && ws.close(); } catch (e) {}
    try { conn.close(); } catch (e) {}
  };
  conn.on('open', () => {
    ws = new WebSocket(localUrl + '?b=' + encodeURIComponent(b));
    ws.onopen = () => { for (const d of queue) ws.send(d); queue = []; };
    ws.onmessage = e => { if (conn.open) conn.send(e.data); };
    ws.onclose = () => setTimeout(() => { try { conn.close(); } catch (e) {} }, 300);   // lad en sidste fejlbesked nå frem
  });
  conn.on('data', d => { lastRx = Date.now(); if (ws && ws.readyState === 1) ws.send(d); else queue.push(d); });
  conn.on('close', closeBoth);
  conn.on('error', closeBoth);
}

export const P2P = {
  get on() { return !!window.WD_P2P && typeof window.Peer === 'function'; },

  // Værten: tag imod venner på party-koden
  host(code, localUrl) {
    if (hostPeer && hostCode === code && !hostPeer.destroyed) return Promise.resolve();
    this.stopHost();
    hostCode = code;
    return new Promise((resolve, reject) => {
      let tries = 0;
      const start = () => {
        const peer = new window.Peer(PREFIX + code, OPTS);
        hostPeer = peer;
        peer.on('open', () => resolve());
        peer.on('connection', conn => bridge(conn, localUrl));
        // mister vi forbindelsen til "telefonbogen", spiller vennerne videre – vi melder os bare til igen
        peer.on('disconnected', () => setTimeout(() => { if (!peer.destroyed && hostPeer === peer) try { peer.reconnect(); } catch (e) {} }, 2000));
        peer.on('error', err => {
          if (hostPeer !== peer) return;
          // id'et kan være optaget et øjeblik lige efter en genindlæsning
          if (err.type === 'unavailable-id' && tries++ < 6) { try { peer.destroy(); } catch (e) {} setTimeout(start, 1500); return; }
          if (err.type === 'peer-unavailable') return;
          reject(err);
        });
      };
      start();
    });
  },
  stopHost() {
    if (hostPeer) try { hostPeer.destroy(); } catch (e) {}
    hostPeer = null; hostCode = null;
  }
};

// Vennens side: opfører sig som en WebSocket, så netværkskoden ikke skal vide forskel
export class PeerSocket {
  constructor(code) {
    this.readyState = 0;
    this.onopen = this.onmessage = this.onclose = this.onerror = null;
    this.reason = '';
    const peer = this.peer = new window.Peer(undefined, OPTS);
    peer.on('open', () => {
      if (this.readyState === 3) return;
      const conn = this.conn = peer.connect(PREFIX + code, {
        reliable: true, serialization: 'raw',
        metadata: { b: window.WD_BUILD || '', v: window.WD_APP || '' }
      });
      conn.on('open', () => {
        if (this.readyState !== 0) return;
        this.readyState = 1; this.lastRx = Date.now();
        this._watch = setInterval(() => { if (Date.now() - this.lastRx > SILENCE_MS) this._end('timeout'); }, 2000);
        this.onopen && this.onopen();
      });
      conn.on('data', d => { this.lastRx = Date.now(); if (this.readyState === 1 && this.onmessage) this.onmessage({ data: d }); });
      conn.on('close', () => this._end('closed'));
      conn.on('error', () => this._end('error'));
    });
    peer.on('error', err => this._end(err.type || 'error'));   // 'peer-unavailable' = intet party med den kode
  }
  _end(why) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.reason = why;
    clearInterval(this._watch);
    try { this.peer.destroy(); } catch (e) {}
    if (this.onclose) this.onclose({ reason: why });
  }
  send(d) { if (this.readyState === 1) this.conn.send(d); }
  close() { this._end('closed'); }
}
