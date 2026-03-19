#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import { MainMenu, type MenuChoice } from './components/MainMenu.js';
import { App } from './components/App.js';
import { EngineApp } from './components/EngineApp.js';
import { DifficultyMenu } from './components/DifficultyMenu.js';
import { HostLauncher } from './components/HostLauncher.js';
import { type Difficulty } from './hooks/useEngineGame.js';

const args = process.argv.slice(2);
const SERVER_URL = process.env['TERMCHESS_SERVER'] ?? 'ws://localhost:3001/ws';

if (args[0] === 'host') {
  render(React.createElement(HostLauncher));
} else if (args[0] === 'join' && args[1]) {
  // Support GAMECODE@URL format from CLI arg too
  const atIndex = args[1].indexOf('@');
  const gameCode = atIndex !== -1 ? args[1].slice(0, atIndex).toUpperCase() : args[1].toUpperCase();
  const serverUrl = atIndex !== -1 ? args[1].slice(atIndex + 1) : SERVER_URL;
  render(React.createElement(App, { serverUrl, initialMode: { join: gameCode } }));
} else if (args[0] === 'engine') {
  const validDifficulties: Difficulty[] = ['easy', 'medium', 'hard'];
  const rawDifficulty = args[1];
  const difficulty: Difficulty =
    rawDifficulty !== undefined && (validDifficulties as string[]).includes(rawDifficulty)
      ? (rawDifficulty as Difficulty)
      : 'medium';
  render(React.createElement(EngineApp, { difficulty }));
} else {
  const { rerender } = render(
    React.createElement(MainMenu, { onSelect: (choice: MenuChoice) => handleMenuChoice(choice) }),
  );

  function handleMenuChoice(choice: MenuChoice): void {
    if (choice.type === 'engine') {
      rerender(
        React.createElement(DifficultyMenu, {
          onSelect: (difficulty: Difficulty) => {
            rerender(React.createElement(EngineApp, { difficulty }));
          },
          onBack: () => {
            rerender(React.createElement(MainMenu, { onSelect: handleMenuChoice }));
          },
        }),
      );
    } else if (choice.type === 'host') {
      rerender(React.createElement(HostLauncher));
    } else if (choice.type === 'join') {
      rerender(
        React.createElement(App, {
          serverUrl: choice.serverUrl ?? SERVER_URL,
          initialMode: { join: choice.code },
        }),
      );
    }
  }
}
