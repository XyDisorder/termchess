import type { PlayerId, GameId } from '@termchess/protocol';

export interface PlayerConnection {
  readonly playerId: PlayerId;
  readonly ws: { send: (data: string) => void; close: () => void };
  gameId: GameId | null;
  connectedAt: Date;
}
