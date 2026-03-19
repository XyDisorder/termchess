import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const TYPE_COLORS: Record<StatusBarProps['type'], string> = {
  info: 'cyan',
  success: 'green',
  error: 'red',
  warning: 'yellow',
};

const TYPE_PREFIXES: Record<StatusBarProps['type'], string> = {
  info: 'i',
  success: '✓',
  error: '✗',
  warning: '!',
};

export function StatusBar({ message, type }: StatusBarProps): React.ReactElement {
  const color = TYPE_COLORS[type];
  const prefix = TYPE_PREFIXES[type];

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text color={color}>[{prefix}] {message}</Text>
    </Box>
  );
}
