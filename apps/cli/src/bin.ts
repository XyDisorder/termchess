#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import { App } from './components/App.js';

const args = process.argv.slice(2);
const SERVER_URL = process.env['TERMCHESS_SERVER'] ?? 'ws://localhost:3001/ws';

let initialMode: 'host' | { join: string } | null = null;

if (args[0] === 'host') {
  initialMode = 'host';
} else if (args[0] === 'join' && args[1]) {
  initialMode = { join: args[1] };
}

render(React.createElement(App, { serverUrl: SERVER_URL, initialMode }));
