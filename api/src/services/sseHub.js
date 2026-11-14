/**
 * In-memory SSE Hub for Live Classroom Companion.
 * Delivers real-time captions, board notes, and questions with low latency (<1.5s).
 * Supports Last-Event-ID replay for students reconnecting over unstable 3G networks.
 */

class LiveSessionHub {
  constructor() {
    // Map: pin -> { clients: Set(res), history: Array<{ id, event, data, ts }> }
    this.sessions = new Map();
    this.heartbeatInterval = null;
    this.startHeartbeat();
  }

  getOrCreateSession(pin) {
    if (!this.sessions.has(pin)) {
      this.sessions.set(pin, {
        clients: new Set(),
        history: [],
        createdAt: Date.now()
      });
    }
    return this.sessions.get(pin);
  }

  addClient(pin, res, lastEventId) {
    const session = this.getOrCreateSession(pin);
    session.clients.add(res);

    // Disable proxy buffering and set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // NGINX disable buffering
    res.flushHeaders?.();

    // Send initial connected event
    res.write(`event: connected\ndata: ${JSON.stringify({ pin, connectedAt: Date.now() })}\n\n`);

    // Replay missed events if client reconnected with Last-Event-ID
    if (lastEventId) {
      const lastIndex = session.history.findIndex((h) => String(h.id) === String(lastEventId));
      if (lastIndex !== -1 && lastIndex + 1 < session.history.length) {
        const missed = session.history.slice(lastIndex + 1);
        missed.forEach((evt) => {
          res.write(`id: ${evt.id}\nevent: ${evt.event}\ndata: ${JSON.stringify(evt.data)}\n\n`);
        });
      }
    }

    // Clean up on disconnect
    res.on('close', () => {
      session.clients.delete(res);
    });
  }

  broadcast(pin, eventName, data) {
    const session = this.getOrCreateSession(pin);
    const eventId = `${Date.now()}-${session.history.length + 1}`;
    const entry = { id: eventId, event: eventName, data, ts: Date.now() };

    session.history.push(entry);

    // Keep memory bounded to last 1000 events per session
    if (session.history.length > 1000) {
      session.history.shift();
    }

    const payload = `id: ${eventId}\nevent: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;

    session.clients.forEach((client) => {
      try {
        client.write(payload);
      } catch (err) {
        session.clients.delete(client);
      }
    });

    return eventId;
  }

  endSession(pin, recordedVideoId) {
    const session = this.sessions.get(pin);
    if (!session) return;

    const payload = `event: session-ended\ndata: ${JSON.stringify({ pin, recordedVideoId })}\n\n`;
    session.clients.forEach((client) => {
      try {
        client.write(payload);
        client.end();
      } catch (err) {
        // ignore
      }
    });

    this.sessions.delete(pin);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  startHeartbeat() {
    if (this.heartbeatInterval) return;
    // Send comment heartbeat every 15 seconds to keep 3G connections alive
    this.heartbeatInterval = setInterval(() => {
      this.sessions.forEach((session) => {
        session.clients.forEach((client) => {
          try {
            client.write(': heartbeat\n\n');
          } catch (err) {
            session.clients.delete(client);
          }
        });
      });
    }, 15000);

    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }
}

module.exports = new LiveSessionHub();
