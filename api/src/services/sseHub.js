/**
 * In-memory SSE Hub for Live Classroom Companion.
 * Delivers real-time captions, board notes, and questions with low latency (<1.5s).
 * Supports Last-Event-ID replay for students reconnecting over unstable 3G networks.
 */

class LiveSessionHub {
  constructor() {
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

    // Mock mode streaming: send a board event and periodic captions every 2 seconds
    let mockInterval = null;
    let mockBoardTimeout = null;

    if (process.env.MOCK_API === 'true') {
      const sampleCaptions = [
        { text: "Welcome everyone to our live accessible session.", isFinal: false },
        { text: "Welcome everyone to our live accessible session.", isFinal: true },
        { text: "Today we are demonstrating zero-runtime accessibility.", isFinal: false },
        { text: "Today we are demonstrating zero-runtime accessibility.", isFinal: true },
        { text: "Please use the questions box below to ask questions.", isFinal: true }
      ];
      let captionIndex = 0;

      mockBoardTimeout = setTimeout(() => {
        try {
          const boardData = {
            id: `board-${Date.now()}`,
            text: "Lesson Note: 1. Zero runtime dependencies. 2. Native WebVTT and live speech recognition.",
            ts: Date.now()
          };
          res.write(`id: mock-board-1\nevent: board\ndata: ${JSON.stringify(boardData)}\n\n`);
        } catch (e) {
          // Client disconnected
        }
      }, 500);

      mockInterval = setInterval(() => {
        try {
          const cap = sampleCaptions[captionIndex % sampleCaptions.length];
          captionIndex++;
          const data = {
            ...cap,
            ts: Date.now()
          };
          res.write(`id: mock-cap-${Date.now()}\nevent: caption\ndata: ${JSON.stringify(data)}\n\n`);
        } catch (e) {
          clearInterval(mockInterval);
        }
      }, 2000);

      if (mockInterval.unref) mockInterval.unref();
      if (mockBoardTimeout.unref) mockBoardTimeout.unref();
    }

    // Clean up on disconnect
    res.on('close', () => {
      session.clients.delete(res);
      if (mockInterval) clearInterval(mockInterval);
      if (mockBoardTimeout) clearTimeout(mockBoardTimeout);
    });
  }

  broadcast(pin, eventName, data) {
    const session = this.getOrCreateSession(pin);
    const eventId = `${Date.now()}-${session.history.length + 1}`;
    const entry = { id: eventId, event: eventName, data, ts: Date.now() };

    session.history.push(entry);

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

  endSession(pin, videoId) {
    const session = this.sessions.get(pin);
    if (!session) return;

    const payload = `event: session-ended\ndata: ${JSON.stringify({ pin, videoId })}\n\n`;
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
