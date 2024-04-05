import CloseCodes from "./close-codes.js";
import { fromPlayerMessageSchema } from "./player-messages.js";

export default class Player {
  /** @type {NodeJS.Timeout | undefined} */
  #inactivityTimeout;

  /**
   * Room that the player is in.
   * @type {import("./room.js").default}
   */
  #room;

  /**
   * Nickname of the player.
   * @type {string}
   */
  #name;

  /**
   * WebSocket to communicate with the player client.
   * Don't close this websocket manually, it will be closed when a player
   * removal message is sent to the player.
   * @type {import("ws").WebSocket}
   */
  #ws;

  /**
   * Answers from the player client.
   * @type {Record<string, string>}
   */
  answers = {};

  /**
   * Votes for the player client.
   * @type {Set<string>}
   */
  votes = new Set();

  /** @returns {string} - Nickname of the player. */
  get name() {
    return this.#name;
  }

  /**
   * Constructs a new player.
   * @param {string} name - Name of the player.
   * @param {import("./room.js").default} room - Room that the player was added to.
   * @param {import("ws").WebSocket} ws - WebSocket of the player.
   */
  constructor(name, room, ws) {
    this.#name = name;
    this.#room = room;
    this.#ws = ws;

    this.#resetInactivityTimeout();

    this.#ws.on("message", (rawData) => {
      let data;
      try {
        data = fromPlayerMessageSchema.safeParse(
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          JSON.parse(rawData.toString())
        );
      } catch {
        this.#ws.close(1008, "Couldn't parse message");
        return;
      }
      if (!data.success) {
        this.#ws.close(1008, `Malformed message: ${data.error.message}`);
        return;
      }

      switch (data.data.type) {
        case "start-round": {
          try {
            this.#room.startRound();
          } catch (error) {
            console.error(`Couldn't request round start: ${String(error)}`);
          }
          break;
        }
        case "stop-round": {
          try {
            this.#room.stopRound(this);
          } catch (error) {
            console.error(`Couldn't request round stop: ${String(error)}`);
          }
          break;
        }
        case "change-answer": {
          if (!this.#room.categories.includes(data.data.content.category))
            console.error(
              `Player tried to change answer for a category that is not in the room: ${data.data.content.category}`
            );

          this.answers[data.data.content.category] = data.data.content.answer;
          break;
        }
        case "change-answer-vote": {
          if (data.data.content.accepted)
            this.votes.add(data.data.content.answer);
          else this.votes.delete(data.data.content.answer);
          break;
        }
        case "leave-room": {
          this.#room.removePlayer(this, "left");
          break;
        }
        case "heartbeat": {
          this.#resetInactivityTimeout();
          break;
        }
      }
    });

    this.#ws.on("close", () => {
      // Remove player if it's still in the room. This only happens if the
      // player wasn't already removed.
      try {
        this.#room.removePlayer(this, "left");
      } catch {}

      this.#clearInactivityTimeout();
    });
  }

  /** Clears the player inactivity timeout. */
  #clearInactivityTimeout() {
    if (this.#inactivityTimeout) clearTimeout(this.#inactivityTimeout);
  }

  /** Resets the player inactivity timeout. */
  #resetInactivityTimeout() {
    this.#clearInactivityTimeout();

    this.#inactivityTimeout = setTimeout(() => {
      this.#room.removePlayer(this, "timed-out");
    }, 30e3);
  }

  /**
   * Sends a WebSocket message to the player.
   * This may have side effects based on the message type.
   * @param {import("./player-messages.js").ToPlayerMessage} message - Message
   * to send.
   */
  send(message) {
    this.#ws.send(JSON.stringify(message));

    switch (message.type) {
      case "round-starting": {
        this.answers = {};
        break;
      }
      case "category-vote-started": {
        this.votes = new Set(message.content.answers);
        break;
      }
      case "player-removed": {
        if (message.content.name === this.#name) {
          this.#ws.close(CloseCodes.PLAYER_REMOVED, message.content.reason);
        }
        break;
      }
    }
  }
}
