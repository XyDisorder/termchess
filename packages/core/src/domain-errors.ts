export const DomainErrorCode = {
  IllegalMove: 'ILLEGAL_MOVE',
  GameNotFound: 'GAME_NOT_FOUND',
  GameAlreadyFull: 'GAME_ALREADY_FULL',
  GameNotActive: 'GAME_NOT_ACTIVE',
  NotYourTurn: 'NOT_YOUR_TURN',
  NotAPlayer: 'NOT_A_PLAYER',
  DrawNotOffered: 'DRAW_NOT_OFFERED',
  DrawAlreadyOffered: 'DRAW_ALREADY_OFFERED',
  PlayerAlreadyInGame: 'PLAYER_ALREADY_IN_GAME',
} as const;
export type DomainErrorCode = (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
