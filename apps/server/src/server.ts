import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { createWsHandler } from './ws-handler.js';
import { SessionManager } from './session-manager.js';

export function createServer() {
  const app = Fastify({ logger: { level: 'info' } });
  const sessionManager = new SessionManager();
  sessionManager.startCleanup();

  void app.register(websocket);
  void app.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, createWsHandler(sessionManager));
  });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  return { app, sessionManager };
}
