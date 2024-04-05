/**
 * Player WebSocket close codes sent by the server.
 * @enum {number}
 */
export const CloseCodes = /** @type {const} */ ({
  /** No room with the given ID. */
  NO_ROOM_WITH_ID: 4000,
  /** Wrong room password. */
  WRONG_ROOM_PASSWORD: 4001,
  /** Name already in use in the room. */
  NICKNAME_ALREADY_IN_ROOM: 4002,
  /** Player was removed from the room. */
  PLAYER_REMOVED: 4003,
});

export default CloseCodes;
