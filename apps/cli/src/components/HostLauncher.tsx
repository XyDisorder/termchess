import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './Spinner.js';
import { App } from './App.js';
import { startEmbeddedServer, type EmbeddedServerInfo } from '../server/start-embedded.js';

export function HostLauncher(): React.ReactElement {
  const [serverInfo, setServerInfo] = useState<EmbeddedServerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let info: EmbeddedServerInfo | null = null;

    startEmbeddedServer()
      .then((i) => {
        info = i;
        if (!stopped) setServerInfo(i);
      })
      .catch((e: unknown) => {
        if (!stopped) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      stopped = true;
      info?.stop().catch(() => {});
    };
  }, []);

  if (error) {
    return (
      <Box paddingY={1}>
        <Text color="red">Failed to start server: {error}</Text>
      </Box>
    );
  }

  if (!serverInfo) {
    return (
      <Box paddingY={1}>
        <Spinner label="Starting server..." />
      </Box>
    );
  }

  return (
    <App
      serverUrl={`ws://localhost:${serverInfo.port}/ws`}
      initialMode="host"
      localWsBase={serverInfo.localWsBase}
      tunnelWsBase={serverInfo.tunnelWsBase}
    />
  );
}
