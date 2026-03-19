import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { type Difficulty } from '../hooks/useEngineGame.js';

interface DifficultyItem {
  value: Difficulty;
  label: string;
  description: string;
}

const DIFFICULTY_ITEMS: DifficultyItem[] = [
  { value: 'easy',   label: 'Easy',   description: 'Skill 1  — beginner friendly' },
  { value: 'medium', label: 'Medium', description: 'Skill 10 — decent challenge'  },
  { value: 'hard',   label: 'Hard',   description: 'Skill 20 — full strength'     },
];

interface DifficultyMenuProps {
  onSelect: (difficulty: Difficulty) => void;
  onBack: () => void;
}

export function DifficultyMenu({ onSelect, onBack }: DifficultyMenuProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev === 0 ? DIFFICULTY_ITEMS.length - 1 : prev - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) =>
        prev === DIFFICULTY_ITEMS.length - 1 ? 0 : prev + 1,
      );
      return;
    }
    if (key.return) {
      const item = DIFFICULTY_ITEMS[selectedIndex];
      if (item) onSelect(item.value);
      return;
    }
    if (key.escape) {
      onBack();
      return;
    }
    if (key.ctrl && input === 'c') {
      process.exit(0);
    }
  });

  return (
    <Box flexDirection="column" paddingY={1} paddingX={2}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        flexDirection="column"
        paddingX={2}
        paddingY={1}
      >
        <Box justifyContent="center" marginBottom={1}>
          <Text color="cyan" bold>  vs Engine — Select Difficulty  </Text>
        </Box>

        <Box marginBottom={1}>
          <Text color="cyan">{'─'.repeat(37)}</Text>
        </Box>

        {DIFFICULTY_ITEMS.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Box key={item.value} marginBottom={index < DIFFICULTY_ITEMS.length - 1 ? 0 : 1}>
              <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                {isSelected ? '  ▶  ' : '     '}
                {item.label.padEnd(8)}
                <Text color={isSelected ? 'cyan' : 'gray'} bold={false}>
                  {'  ('}
                  {item.description}
                  {')'}
                </Text>
              </Text>
            </Box>
          );
        })}

        <Box marginTop={1}>
          <Text color="gray">  ↑↓ navigate   Enter select   Esc back</Text>
        </Box>
      </Box>
    </Box>
  );
}
