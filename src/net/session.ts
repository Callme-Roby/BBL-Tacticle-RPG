import type { MatchLink } from '../game/match';
import type { Action } from '../rules/battle';
import { NetLink, NET_VERSION, type NetMsg } from './peer';

type Status = 'open' | 'closed';

/**
 * Online battle session over a NetLink (turn-based: only the actions travel).
 *
 *  - every action carries its index in the battle's log; duplicates are
 *    dropped, a gap asks the other side to resend (`sync`);
 *  - when the connection drops, the host keeps its room open and the guest
 *    joins it again by itself; both then exchange their log length and resend
 *    what the other missed;
 *  - after each end of turn a checksum of the battle is compared; on a
 *    mismatch the guest asks the host for its whole state.
 */
export class OnlineSession implements MatchLink {
  onMessage: ((m: { t: string; a?: unknown; state?: unknown; n?: number; h?: string }) => void) | null = null;
  onStatus: ((s: Status) => void) | null = null;
  /** every action of the battle, in order (sent and received) */
  readonly log: Action[] = [];
  /** received from the other side but not applied yet (out of order) */
  private pending = new Map<number, Action>();
  private offs: (() => void)[] = [];
  private closed = false;
  private rejoining = false;
  /** host: the battle screen gives its state (sent to a desynced guest) */
  getState: (() => unknown) | null = null;

  constructor(
    private link: NetLink,
    readonly isHost: boolean,
    private code: string,
  ) {
    this.wire();
  }

  private wire() {
    for (const f of this.offs.splice(0)) f();
    this.offs.push(this.link.on((m) => this.receive(m)));
    this.offs.push(this.link.onClose(() => this.dropped()));
    if (this.isHost) this.link.onReconnect = () => this.reconnected();
  }

  private receive(m: NetMsg) {
    switch (m.t) {
      case 'act': {
        const n = m.n;
        if (n < this.log.length) return; // already have it
        this.pending.set(n, m.a as Action);
        if (n > this.log.length) {
          // a hole: ask for the missing ones
          this.link.send({ t: 'sync', n: this.log.length });
          return;
        }
        this.flush();
        return;
      }
      case 'sync':
        // the other side has m.n actions: resend the rest
        for (let i = m.n; i < this.log.length; i++) this.link.send({ t: 'act', a: this.log[i], n: i });
        return;
      case 'hash':
        // the battle screen compares once it has applied the same number of actions
        this.onMessage?.({ t: 'hash', n: m.n, h: m.h });
        return;
      case 'needState':
        if (this.isHost && this.getState) this.link.send({ t: 'state', state: this.getState(), n: this.log.length });
        return;
      case 'state':
        this.log.length = Math.min(this.log.length, m.n);
        this.onMessage?.({ t: 'state', state: m.state });
        return;
      case 'leave':
        this.onMessage?.({ t: 'leave' });
        return;
      default:
        this.onMessage?.(m as { t: string });
    }
  }

  /** delivers the actions that are now in order */
  private flush() {
    while (this.pending.has(this.log.length)) {
      const a = this.pending.get(this.log.length)!;
      this.pending.delete(this.log.length);
      this.log.push(a);
      this.onMessage?.({ t: 'act', a });
    }
  }

  send(m: { t: 'act'; a: Action }) {
    const n = this.log.length;
    this.log.push(m.a);
    this.link.send({ t: 'act', a: m.a, n });
  }

  /** after an end of turn: compare the battle state */
  sendHash(h: string) {
    this.link.send({ t: 'hash', n: this.log.length, h });
  }

  /** guest: the battles differ, get the host's */
  requestState() {
    this.link.send({ t: 'needState' });
  }

  private dropped() {
    if (this.closed) return;
    this.onStatus?.('closed');
    if (!this.isHost) void this.rejoin();
  }

  /** guest: join the host's room again (it keeps trying for 90 s each time) */
  private async rejoin() {
    if (this.rejoining || this.closed) return;
    this.rejoining = true;
    for (let attempt = 0; attempt < 5 && !this.closed; attempt++) {
      try {
        const link = await NetLink.join(this.code);
        if (this.closed) {
          link.close();
          return;
        }
        this.link = link;
        this.wire();
        this.reconnected();
        this.rejoining = false;
        return;
      } catch (e) {
        console.warn('[en ligne] reconnexion impossible', e);
      }
    }
    this.rejoining = false;
    this.onMessage?.({ t: 'lost' });
  }

  private reconnected() {
    this.link.send({ t: 'hello', version: NET_VERSION, name: '' });
    this.link.send({ t: 'sync', n: this.log.length });
    this.onStatus?.('open');
  }

  close() {
    this.closed = true;
    for (const f of this.offs.splice(0)) f();
    this.link.close();
  }
}

/** short checksum of a battle state (desync detection) */
export function stateHash(s: unknown): string {
  const str = JSON.stringify(s);
  let h1 = 0x811c9dc5;
  let h2 = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = (h2 * 31 + c) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}
