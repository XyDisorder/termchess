import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface MoveInputProps {
  onSubmit: (input: string) => void;
  disabled: boolean;
  placeholder?: string;
}

export function MoveInput({ onSubmit, disabled, placeholder }: MoveInputProps): React.ReactElement {
  const [value, setValue] = useState('');

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.return) {
        const trimmed = value.trim();
        if (trimmed) {
          onSubmit(trimmed);
          setValue('');
        }
        return;
      }

      if (key.backspace || key.delete) {
        setValue((prev) => prev.slice(0, -1));
        return;
      }

      if (key.ctrl && input === 'c') {
        process.exit(0);
      }

      // Only accept printable characters
      if (!key.ctrl && !key.meta && !key.escape && input) {
        setValue((prev) => prev + input);
      }
    },
    { isActive: !disabled },
  );

  const hint = placeholder ?? 'enter move (e2e4) or use arrow keys + space';

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={disabled ? 'gray' : 'white'} bold={!disabled}>
          {'> '}
        </Text>
        {value ? (
          <Text color="white">{value}</Text>
        ) : (
          <Text color="gray" dimColor>
            {hint}
          </Text>
        )}
        {!disabled && <Text color="white">█</Text>}
      </Box>
    </Box>
  );
}
