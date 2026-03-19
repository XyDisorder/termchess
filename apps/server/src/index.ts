import { createServer } from './server.js';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

const { app, sessionManager } = createServer();

const shutdown = async (signal: string): Promise<void> => {
  app.log.info(`Received ${signal}, shutting down gracefully…`);
  sessionManager.stopCleanup();
  await app.close();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`TermChess server listening on ${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
