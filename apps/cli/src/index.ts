import { render } from 'ink';
import React from 'react';
import { App } from './components/App.js';

const SERVER_URL = process.env['TERMCHESS_SERVER'] ?? 'ws://localhost:3001/ws';

render(React.createElement(App, { serverUrl: SERVER_URL, initialMode: null }));
