import { WebSocket, WebSocketServer } from "ws";

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    try {
      client.send(msg);
    } catch (err) {
      console.error("Failed to send to client", err);
    }
  }
}

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  // heartbeat: detect and remove stale/unresponsive connections
  function noop() {}
  const intervalMs = 30_000;

  wss.on("connection", (socket) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    sendJson(socket, { type: "welcome" });

    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState !== WebSocket.OPEN) continue;

      if (client.isAlive === false) {
        try {
          client.terminate();
        } catch (err) {
          console.error("Failed to terminate stale socket", err);
        }
        continue;
      }

      client.isAlive = false;
      try {
        client.ping(noop);
      } catch (err) {
        console.error("Ping failed", err);
      }
    }
  }, intervalMs);

  wss.on("close", () => clearInterval(interval));

  function broadCastMatchCreated(match) {
    broadcast(wss, { type: "matchCreated", data: match });
  }

  return { broadCastMatchCreated };
}
