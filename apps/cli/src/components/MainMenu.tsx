import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export type MenuChoice =
  | { type: 'engine' }
  | { type: 'host' }
  | { type: 'join'; code: string };

export interface MainMenuProps {
  onSelect: (choice: MenuChoice) => void;
}

type MenuScreen = 'main' | 'join-input';

const LOGO = [
  '  ████████╗███████╗██████╗ ███╗   ███╗ ██████╗██╗  ██╗███████╗███████╗███████╗',
  '     ██╔══╝██╔════╝██╔══██╗████╗ ████║██╔════╝██║  ██║██╔════╝██╔════╝██╔════╝',
  '     ██║   █████╗  ██████╔╝██╔████╔██║██║     ███████║█████╗  ███████╗███████╗',
  '     ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║     ██╔══██║██╔══╝  ╚════██║╚════██║',
  '     ██║   ███████╗██║  ██║██║ ╚═╝ ██║╚██████╗██║  ██║███████╗███████║███████║',
  '     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝',
];

const MENU_ITEMS = [
  { label: 'vs Engine  (play against Stockfish)', value: 'engine' as const },
  { label: 'Multiplayer — Host a game', value: 'host' as const },
  { label: 'Multiplayer — Join a game', value: 'join' as const },
];

export function MainMenu({ onSelect }: MainMenuProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [screen, setScreen] = useState<MenuScreen>('main');
  const [joinCode, setJoinCode] = useState('');

  useInput(
    (input, key) => {
      if (screen === 'main') {
        if (key.upArrow) {
          setSelectedIndex((prev) => (prev === 0 ? MENU_ITEMS.length - 1 : prev - 1));
          return;
        }
        if (key.downArrow) {
          setSelectedIndex((prev) => (prev === MENU_ITEMS.length - 1 ? 0 : prev + 1));
          return;
        }
        if (key.return) {
          const item = MENU_ITEMS[selectedIndex];
          if (!item) return;
          if (item.value === 'engine') {
            onSelect({ type: 'engine' });
          } else if (item.value === 'host') {
            onSelect({ type: 'host' });
          } else {
            setScreen('join-input');
            setJoinCode('');
          }
          return;
        }
        if (key.ctrl && input === 'c') {
          process.exit(0);
        }
      }

      if (screen === 'join-input') {
        if (key.escape) {
          setScreen('main');
          setJoinCode('');
          return;
        }
        if (key.return) {
          const trimmed = joinCode.trim().toUpperCase();
          if (trimmed.length > 0) {
            onSelect({ type: 'join', code: trimmed });
          }
          return;
        }
        if (key.backspace || key.delete) {
          setJoinCode((prev) => prev.slice(0, -1));
          return;
        }
        if (key.ctrl && input === 'c') {
          process.exit(0);
        }
        if (!key.ctrl && !key.meta && !key.escape && input) {
          setJoinCode((prev) => prev + input);
        }
      }
    },
    { isActive: true },
  );

  if (screen === 'join-input') {
    return (
      <Box flexDirection="column" paddingY={1} paddingX={2}>
        <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={2} paddingY={1}>
          <Box justifyContent="center" marginBottom={1}>
            <Text color="cyan" bold>  Join a Game  </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="white">Enter game code: </Text>
            <Text color="yellow" bold>
              {joinCode.length > 0 ? joinCode.toUpperCase() : '______'}
            </Text>
            <Text color="white">█</Text>
          </Box>
          <Text color="gray">Enter to confirm   Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1} paddingX={2}>
      {/* Big logo above the box */}
      <Box flexDirection="column" marginBottom={1}>
        {LOGO.map((line, i) => (
          <Text key={i} color="cyan" bold>{line}</Text>
        ))}
      </Box>
      <Box justifyContent="center" marginBottom={1}>
        <Text color="gray">Terminal-native multiplayer chess</Text>
      </Box>

      <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={2} paddingY={1}>
        {/* Divider */}
        <Box marginBottom={1}>
          <Text color="cyan">{'─'.repeat(37)}</Text>
        </Box>

        {/* Menu items */}
        {MENU_ITEMS.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Box key={item.value} marginBottom={index < MENU_ITEMS.length - 1 ? 0 : 1}>
              <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                {isSelected ? '  ▶  ' : '     '}
                {item.label}
              </Text>
            </Box>
          );
        })}

        {/* Footer hint */}
        <Box marginTop={1}>
          <Text color="gray">  ↑↓ navigate   Enter select   Ctrl+C quit</Text>
        </Box>
      </Box>
    </Box>
  );
}
