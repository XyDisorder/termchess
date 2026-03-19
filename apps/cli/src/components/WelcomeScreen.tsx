import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './Spinner.js';

interface WelcomeScreenProps {
  status: 'connecting' | 'ready';
}

const LOGO = [
  '  ████████╗███████╗██████╗ ███╗   ███╗ ██████╗██╗  ██╗███████╗███████╗███████╗',
  '     ██╔══╝██╔════╝██╔══██╗████╗ ████║██╔════╝██║  ██║██╔════╝██╔════╝██╔════╝',
  '     ██║   █████╗  ██████╔╝██╔████╔██║██║     ███████║█████╗  ███████╗███████╗',
  '     ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║     ██╔══██║██╔══╝  ╚════██║╚════██║',
  '     ██║   ███████╗██║  ██║██║ ╚═╝ ██║╚██████╗██║  ██║███████╗███████║███████║',
  '     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝',
];

export function WelcomeScreen({ status }: WelcomeScreenProps): React.ReactElement {
  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      <Box flexDirection="column" alignItems="flex-start" marginBottom={2}>
        {LOGO.map((line, i) => (
          <Text key={i} color="cyan" bold>
            {line}
          </Text>
        ))}
      </Box>

      <Text color="gray">Terminal-native multiplayer chess</Text>

      <Box marginTop={2} flexDirection="column" alignItems="center">
        {status === 'connecting' ? (
          <Spinner label="Connecting to server..." />
        ) : (
          <Box flexDirection="column" alignItems="center" gap={1}>
            <Text color="green">Connected.</Text>
            <Text color="white">
              Type <Text color="yellow">/help</Text> for commands
            </Text>
            <Text color="gray" dimColor>
              Commands: /help  host: termchess host  join: termchess join CODE
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
