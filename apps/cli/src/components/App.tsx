import React, { useEffect, useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useGameState } from '../hooks/useGameState.js';
import { Board } from './Board.js';
import { InfoPanel } from './InfoPanel.js';
import { MoveInput } from './MoveInput.js';
import { StatusBar } from './StatusBar.js';
import { WelcomeScreen } from './WelcomeScreen.js';
import { ErrorScreen } from './ErrorScreen.js';
import { Spinner } from './Spinner.js';
import { isCommand, parseCommand, parseMoveInput, COMMANDS } from '../utils/move-parser.js';
import { GameStatus } from '@termchess/protocol';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const HELP_TEXT =
  'Commands: /help - this message | /resign - resign | /draw - offer/accept draw | /pgn - export PGN | /quit - exit';

interface StatusMessage {
  text: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface AppProps {
  serverUrl: string;
  initialMode?: 'host' | { join: string } | null;
}

export function App({ serverUrl, initialMode }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { status, send, lastMessage, error } = useWebSocket(serverUrl);
  const {
    gamePhase,
    handleServerMessage,
    createGame,
    joinGame,
    makeMove,
    resign,
    offerDraw,
    acceptDraw,
    declineDraw,
    requestPgn,
  } = useGameState();

  const [statusMsg, setStatusMsg] = useState<StatusMessage>({
    text: 'Connecting...',
    type: 'info',
  });
  const [hasAutoActed, setHasAutoActed] = useState(false);
  const [pgnOutput, setPgnOutput] = useState<string | null>(null);

  // Transition from connecting to lobby when connected
  useEffect(() => {
    if (status === 'connected' && gamePhase.phase === 'connecting') {
      handleServerMessage({ type: 'pong' }); // no-op just to trigger lobby
    }
  }, [status, gamePhase.phase, handleServerMessage]);

  // Handle gamePhase transitions for status messages
  useEffect(() => {
    if (status === 'connected' && gamePhase.phase === 'connecting') {
      // will be handled above
    } else if (status === 'disconnected') {
      setStatusMsg({ text: 'Disconnected from server', type: 'error' });
    } else if (status === 'error') {
      setStatusMsg({ text: error ?? 'Connection error', type: 'error' });
    }
  }, [status, error, gamePhase.phase]);

  // Auto-act on connect based on initialMode
  useEffect(() => {
    if (status === 'connected' && !hasAutoActed) {
      if (initialMode === 'host') {
        setHasAutoActed(true);
        send(createGame());
        setStatusMsg({ text: 'Creating game...', type: 'info' });
      } else if (initialMode && typeof initialMode === 'object' && 'join' in initialMode) {
        setHasAutoActed(true);
        send(joinGame(initialMode.join));
        setStatusMsg({ text: `Joining game ${initialMode.join}...`, type: 'info' });
      }
    }
  }, [status, hasAutoActed, initialMode, send, createGame, joinGame]);

  // Process incoming server messages
  useEffect(() => {
    if (!lastMessage) return;
    handleServerMessage(lastMessage);

    if (lastMessage.type === 'game_created') {
      setStatusMsg({
        text: `Game created! Share code: ${lastMessage.gameCode}`,
        type: 'success',
      });
    } else if (lastMessage.type === 'game_joined') {
      setStatusMsg({ text: 'Game joined! Good luck!', type: 'success' });
    } else if (lastMessage.type === 'opponent_connected') {
      setStatusMsg({ text: 'Opponent connected! Game starts now.', type: 'success' });
    } else if (lastMessage.type === 'opponent_disconnected') {
      setStatusMsg({ text: 'Opponent disconnected.', type: 'warning' });
    } else if (lastMessage.type === 'game_state') {
      if (lastMessage.snapshot.isCheck) {
        setStatusMsg({ text: 'Check!', type: 'warning' });
      } else {
        setStatusMsg({ text: 'Move accepted.', type: 'info' });
      }
    } else if (lastMessage.type === 'game_finished') {
      const snap = lastMessage.snapshot;
      let resultText = 'Game over.';
      if (snap.status === GameStatus.Checkmate) {
        resultText = `Checkmate! ${snap.winner === 'white' ? 'White' : 'Black'} wins!`;
      } else if (snap.status === GameStatus.Resigned) {
        resultText = `${snap.resignedBy === 'white' ? 'White' : 'Black'} resigned.`;
      } else if (snap.status === GameStatus.Draw || snap.status === GameStatus.Stalemate) {
        resultText = `Draw! (${snap.drawReason ?? snap.status})`;
      }
      setStatusMsg({ text: `${resultText} Type /pgn to export.`, type: 'info' });
    } else if (lastMessage.type === 'game_error') {
      setStatusMsg({ text: lastMessage.message, type: 'error' });
    } else if (lastMessage.type === 'draw_offered') {
      setStatusMsg({ text: `Draw offered by ${lastMessage.by}. Type /draw to accept.`, type: 'info' });
    } else if (lastMessage.type === 'draw_declined') {
      setStatusMsg({ text: 'Draw offer declined.', type: 'info' });
    } else if (lastMessage.type === 'pgn_response') {
      setPgnOutput(lastMessage.pgn);
      setStatusMsg({ text: 'PGN exported above.', type: 'success' });
    }
  }, [lastMessage, handleServerMessage]);

  const handleInput = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      if (isCommand(trimmed)) {
        const cmd = parseCommand(trimmed);
        switch (cmd) {
          case COMMANDS.HELP:
            setStatusMsg({ text: HELP_TEXT, type: 'info' });
            break;
          case COMMANDS.QUIT:
            exit();
            process.exit(0);
            break;
          case COMMANDS.RESIGN:
            if (gamePhase.phase === 'playing') {
              send(resign());
              setStatusMsg({ text: 'Resigned.', type: 'warning' });
            } else {
              setStatusMsg({ text: 'Not in a game.', type: 'error' });
            }
            break;
          case COMMANDS.DRAW:
            if (gamePhase.phase === 'playing') {
              if (gamePhase.snapshot.drawOfferedBy !== null && gamePhase.snapshot.drawOfferedBy !== gamePhase.playerColor) {
                send(acceptDraw());
                setStatusMsg({ text: 'Draw accepted.', type: 'success' });
              } else {
                send(offerDraw());
                setStatusMsg({ text: 'Draw offered.', type: 'info' });
              }
            } else {
              setStatusMsg({ text: 'Not in a game.', type: 'error' });
            }
            break;
          case COMMANDS.PGN:
            if (gamePhase.phase === 'playing' || gamePhase.phase === 'finished') {
              send(requestPgn());
            } else {
              setStatusMsg({ text: 'Not in a game.', type: 'error' });
            }
            break;
          default:
            setStatusMsg({ text: `Unknown command: ${trimmed}. Type /help for commands.`, type: 'error' });
        }
        return;
      }

      // Treat as move
      if (gamePhase.phase === 'playing') {
        const uci = parseMoveInput(trimmed);
        if (uci) {
          send(makeMove(uci));
          setStatusMsg({ text: `Sent: ${uci}`, type: 'info' });
        } else {
          setStatusMsg({ text: `Invalid move: ${trimmed}. Use UCI format (e.g. e2e4).`, type: 'error' });
        }
      } else {
        setStatusMsg({ text: 'Not your turn or no active game.', type: 'error' });
      }
    },
    [gamePhase, send, resign, offerDraw, acceptDraw, requestPgn, makeMove, declineDraw, exit],
  );

  // Determine if input should be disabled
  const isPlayerTurn =
    gamePhase.phase === 'playing' &&
    gamePhase.snapshot.turn === gamePhase.playerColor;

  const inputDisabled =
    gamePhase.phase !== 'playing' ||
    !isPlayerTurn;

  // Render based on phase
  if (gamePhase.phase === 'connecting' || status === 'connecting') {
    return (
      <Box flexDirection="column">
        <WelcomeScreen status="connecting" />
        <StatusBar message={statusMsg.text} type={statusMsg.type} />
      </Box>
    );
  }

  if (gamePhase.phase === 'error') {
    return (
      <Box flexDirection="column">
        <ErrorScreen message={gamePhase.message} />
        <StatusBar message={statusMsg.text} type={statusMsg.type} />
      </Box>
    );
  }

  if (status === 'error' || status === 'disconnected') {
    return (
      <Box flexDirection="column">
        <ErrorScreen message={error ?? 'Connection lost'} />
        <StatusBar message={statusMsg.text} type={statusMsg.type} />
      </Box>
    );
  }

  if (gamePhase.phase === 'lobby') {
    return (
      <Box flexDirection="column">
        <WelcomeScreen status="ready" />
        <MoveInput onSubmit={handleInput} disabled={false} placeholder="/help for commands" />
        <StatusBar message={statusMsg.text} type={statusMsg.type} />
      </Box>
    );
  }

  if (gamePhase.phase === 'waiting') {
    return (
      <Box flexDirection="column">
        <Box paddingY={1}>
          <Spinner label="Waiting for opponent to join..." />
        </Box>
        <Box>
          <Text color="white">Game Code: </Text>
          <Text color="cyan" bold>{gamePhase.gameCode}</Text>
          <Text color="gray"> (share with opponent)</Text>
        </Box>
        <Box>
          <Text color="gray">You are playing as </Text>
          <Text color={gamePhase.playerColor === 'white' ? 'white' : 'gray'} bold>
            {gamePhase.playerColor}
          </Text>
        </Box>
        <StatusBar message={statusMsg.text} type={statusMsg.type} />
      </Box>
    );
  }

  // playing or finished
  const snapshot = gamePhase.snapshot;
  const isFinished = gamePhase.phase === 'finished';

  return (
    <Box flexDirection="column">
      {/* PGN output if available */}
      {pgnOutput && (
        <Box borderStyle="single" borderColor="green" paddingX={1} marginBottom={1} flexDirection="column">
          <Text color="green" bold>PGN Export:</Text>
          <Text color="white">{pgnOutput}</Text>
        </Box>
      )}

      {/* Main layout: Board + InfoPanel */}
      <Box flexDirection="row">
        {/* Left: board + input */}
        <Box flexDirection="column">
          <Board
            fen={snapshot.fen}
            lastMove={snapshot.lastMove}
            isCheck={snapshot.isCheck}
            perspective={gamePhase.playerColor}
          />
          <MoveInput
            onSubmit={handleInput}
            disabled={inputDisabled || isFinished}
            placeholder={
              isFinished
                ? '/pgn to export, /quit to exit'
                : isPlayerTurn
                ? 'enter move (e2e4) or /help'
                : "opponent's turn..."
            }
          />
        </Box>

        {/* Right: info panel */}
        <InfoPanel
          gameCode={snapshot.gameCode}
          playerColor={gamePhase.playerColor}
          currentTurn={snapshot.turn}
          isCheck={snapshot.isCheck}
          status={snapshot.status}
          moveHistory={snapshot.moveHistory}
          capturedByWhite={snapshot.capturedByWhite}
          capturedByBlack={snapshot.capturedByBlack}
          drawOfferedBy={snapshot.drawOfferedBy}
          connectionStatus={`ws: ${status}`}
        />
      </Box>

      <StatusBar message={statusMsg.text} type={statusMsg.type} />
    </Box>
  );
}
