import { networkInterfaces } from 'os';
import localtunnel from 'localtunnel';
import { createServer } from './create-server.js';

function getLocalIp(): string {
  const nets = networkInterfaces();
  for (const interfaces of Object.values(nets)) {
    if (!interfaces) continue;
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

export interface EmbeddedServerInfo {
  port: number;
  localWsBase: string;
  tunnelWsBase: Promise<string | null>;
  stop: () => Promise<void>;
}

export async function startEmbeddedServer(preferredPort = 3001): Promise<EmbeddedServerInfo> {
  const { app, sessionManager } = createServer();

  // Try preferred port, fall back to OS-assigned
  try {
    await app.listen({ port: preferredPort, host: '0.0.0.0' });
  } catch {
    await app.listen({ port: 0, host: '0.0.0.0' });
  }

  const port = (app.server.address() as { port: number }).port;
  const localIp = getLocalIp();
  const localWsBase = `ws://${localIp}:${port}`;

  const tunnelWsBase: Promise<string | null> = localtunnel({ port })
    .then((tunnel) => {
      tunnel.on('error', () => {});
      return tunnel.url.replace('https://', 'wss://').replace('http://', 'ws://');
    })
    .catch(() => null);

  const stop = async () => {
    sessionManager.stopCleanup();
    await app.close();
  };

  return { port, localWsBase, tunnelWsBase, stop };
}
