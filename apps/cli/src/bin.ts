#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import { MainMenu, type MenuChoice } from './components/MainMenu.js';
import { App } from './components/App.js';
import { SoloApp } from './components/SoloApp.js';

const args = process.argv.slice(2);
const SERVER_URL = process.env['TERMCHESS_SERVER'] ?? 'ws://localhost:3001/ws';

// Direct CLI args still work (for scripts / automation)
if (args[0] === 'host') {
  render(React.createElement(App, { serverUrl: SERVER_URL, initialMode: 'host' }));
} else if (args[0] === 'join' && args[1]) {
  render(
    React.createElement(App, {
      serverUrl: SERVER_URL,
      initialMode: { join: args[1] },
    }),
  );
} else if (args[0] === 'solo') {
  render(React.createElement(SoloApp, {}));
} else {
  // No args → show interactive menu
  const { rerender } = render(
    React.createElement(MainMenu, {
      onSelect: (choice: MenuChoice) => {
        if (choice.type === 'solo') {
          rerender(React.createElement(SoloApp, {}));
        } else if (choice.type === 'host') {
          rerender(
            React.createElement(App, {
              serverUrl: SERVER_URL,
              initialMode: 'host',
            }),
          );
        } else {
          rerender(
            React.createElement(App, {
              serverUrl: SERVER_URL,
              initialMode: { join: choice.code },
            }),
          );
        }
      },
    }),
  );
}
