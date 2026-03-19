import React from 'react';
import { Box, Text } from 'ink';

interface ErrorScreenProps {
  message: string;
}

export function ErrorScreen({ message }: ErrorScreenProps): React.ReactElement {
  return (
    <Box flexDirection="column" padding={2} borderStyle="round" borderColor="red">
      <Text color="red" bold>
        Error
      </Text>
      <Text color="white">{message}</Text>
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Press Ctrl+C to exit
        </Text>
      </Box>
    </Box>
  );
}
