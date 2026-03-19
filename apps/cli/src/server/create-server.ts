import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { createWsHandler } from './ws-handler.js';
import { SessionManager } from './session-manager.js';

export function createServer() {
  // Silent logger — we're running inside a TUI
  const app = Fastify({ logger: false });
  const sessionManager = new SessionManager();
  sessionManager.startCleanup();

  void app.register(websocket);
  void app.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, createWsHandler(sessionManager));
  });

  app.get('/health', async () => ({ status: 'ok' }));

  return { app, sessionManager };
}
