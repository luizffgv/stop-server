import app from "./app.js";
import Player from "./player.js";
import VoteManager from "./vote-manager.js";

/**
 * The room is in the pre-game lobby.
 * @typedef {object} LobbyRoomState
 * @property {"lobby"} type - Name of the state.
 */

/**
 * The round is starting.
 * @typedef {object} RoundStartingRoomState
 * @property {"round-starting"} type - Name of the state.
 */

/**
 * The round is being answered.
 * @typedef {object} RoundAnsweringRoomState
 * @property {"round-answering"} type - Name of the state.
 * @property {boolean | undefined} [stopAvailable] - Whether a player can
 * request a stop.
 * @property {NodeJS.Timeout} stopTimeout - Timeout for the automatic round stop.
 */

/**
 * The answering period is ending. This state exists so players have a little
 * extra time to send their answers.
 * @typedef {object} RoundAnsweringStoppingRoomState
 * @property {"round-answering-stopping"} type - Name of the state.
 */

/**
 * The voting is in progress.
 * @typedef {object} VotingRoomState
 * @property {"voting"} type - Name of the state.
 * @property {() => void} cleanup - Function to be called when closing the room.
 */

/**
 * The room is showing the leaderboard.
 * @typedef {object} LeaderboardRoomState
 * @property {"leaderboard"} type - Name of the state.
 */

/**
 * The room has been closed.
 * @typedef {object} ClosedRoomState
 * @property {"closed"} type - Name of the state.
 */

/**
 * @typedef {LeaderboardRoomState | LobbyRoomState | RoundStartingRoomState | RoundAnsweringRoomState | RoundAnsweringStoppingRoomState | VotingRoomState | ClosedRoomState} RoomState
 */

/**
 * @typedef {object} RoomParameters
 * @property {string} password - Password of the room.
 * @property {Iterable<string>} letters - Available letters of the alphabet to
 * play.
 * @property {string[]} categories - Categories available in the room.
 */

export default class Room {
  /**
   * Current state of the room.
   * @type {RoomState}
   */
  #state;

  /**
   * Timeout to stop the room if there are no players for a certain time.
   * @type {NodeJS.Timeout | undefined}
   */
  #noPlayerTimeout = undefined;

  /** @type {string} */
  #password;

  /** @type {Player[]} */
  #players = [];

  /** @type {Set<string>} */
  #letters;

  /** @type {string[]} */
  #categories;

  /** @returns {string} - Password of the room. */
  get password() {
    return this.#password;
  }

  /** @returns {Set<string>} - Letters available in the room. */
  get letters() {
    return new Set(this.#letters);
  }

  /** @returns {string[]} - Categories available in the room. */
  get categories() {
    return [...this.#categories];
  }

  /**
   * ID of the room.
   * @type {string}
   * @readonly
   */
  id;

  /**
   * Constructs a new room.
   * @param {string} id - ID of the room.
   * @param {RoomParameters} parameters - Parameters of the room.
   */
  constructor(id, parameters) {
    this.id = id;
    this.#password = parameters.password;
    this.#letters = new Set(parameters.letters);
    this.#categories = [...parameters.categories];
    this.#state = { type: "lobby" };

    this.#noPlayerTimeout = setTimeout(() => {
      this.#close();
    }, 10e3);
  }

  /**
   * Broadcasts a message to all players in the room.
   * @param {import("./player-messages.js").ToPlayerMessage} message - Message
   * to broadcast.
   */
  #broadcast(message) {
    for (const player of this.#players) {
      player.send(message);
    }
  }

  /**
   * Closes the room and removes it from the list of rooms.
   */
  #close() {
    if (this.#state.type === "round-answering")
      clearTimeout(this.#state.stopTimeout);

    if (this.#noPlayerTimeout != undefined) {
      clearTimeout(this.#noPlayerTimeout);
      this.#noPlayerTimeout = undefined;
    }

    if (this.#state.type === "voting") this.#state.cleanup();

    for (const player of this.#players) {
      this.#broadcast({
        type: "player-removed",
        content: {
          name: player.name,
          reason: "room-closed",
        },
      });
    }
    this.#players = [];

    this.#state = { type: "closed" };
    app.rooms.remove(this);
  }

  /**
   * Adds a player to the room.
   * @param {string} name - Name of the player.
   * @param {import("ws").WebSocket} ws - Websocket of the player.
   * @throws {Error} If a player with the same name is already in the room.
   */
  addPlayer(name, ws) {
    if (this.#players.some((p) => p.name === name)) {
      throw new Error("Player with the same name already in the room");
    }

    if (this.#noPlayerTimeout != undefined) {
      clearTimeout(this.#noPlayerTimeout);
      this.#noPlayerTimeout = undefined;
    }

    this.#broadcast({
      type: "player-joined",
      content: {
        name,
      },
    });

    const newPlayer = new Player(name, this, ws);
    this.#players.push(newPlayer);
    newPlayer.send({
      type: "room-players",
      content: this.#players.map((p) => p.name),
    });
    newPlayer.send({ type: "room-categories", content: this.#categories });
  }

  /**
   * Removes a player from the room and broadcasts a disconnection message to
   * all players, including the removed player.
   * @param {Player} player - Player to remove.
   * @param {import("./player-messages.js").PlayerRemovedMessage["content"]["reason"]} reason -
   * Reason for leaving the room.
   * @throws {Error} If the player is not in the room.
   */
  removePlayer(player, reason) {
    if (!this.#players.includes(player))
      throw new Error("Player not in the room");

    this.#broadcast({
      type: "player-removed",
      content: {
        name: player.name,
        reason,
      },
    });

    this.#players = this.#players.filter((p) => p !== player);

    if (this.#players.length === 0)
      this.#noPlayerTimeout = setTimeout(() => {
        this.#close();
      }, 10e3);
  }

  /**
   * Begins starting a new round, broadcasting a "starting" message to all
   * players some seconds before.
   * @throws {Error} If a round is already in progress.
   */
  startRound() {
    if (this.#state.type != "lobby" && this.#state.type != "leaderboard")
      throw new Error("Round already in progress");

    this.#state = { type: "round-starting" };
    this.#broadcast({ type: "round-starting" });

    const letter = [...this.#letters][
      Math.floor(Math.random() * this.#letters.size)
    ];
    if (letter == undefined) {
      throw new Error(
        "No letters available to start a round. This should never be thrown."
      );
    }

    const duration = this.#categories.length * 10e3;

    setTimeout(() => {
      this.#state = {
        type: "round-answering",
        stopTimeout: setTimeout(() => {
          this.stopRound();
        }, duration),
      };
      this.#broadcast({ type: "round-started", content: { letter, duration } });

      setTimeout(() => {
        if (this.#state.type !== "round-answering")
          throw new Error("Unexpected round state");
        this.#state.stopAvailable = true;
        this.#broadcast({ type: "stop-available" });
      }, duration / 3);
    }, 5e3);
  }

  /**
   * Begins stopping the round, broadcasting a "stopping" message to all
   * players.
   * @param {Player} [requester] - Player who requested the stop.
   * @throws {Error} If there's no round in progress or if the requester can't
   * request a stop.
   */
  stopRound(requester) {
    if (this.#state.type !== "round-answering")
      throw new Error("Can't stop a round that's not in answering state.");

    if (requester != undefined && !this.#state.stopAvailable)
      throw new Error("Requesting a stop is not available yet.");

    clearTimeout(this.#state.stopTimeout);

    this.#state = { type: "round-answering-stopping" };
    this.#broadcast({
      type: "round-stopping",
      content: { requester: requester?.name },
    });

    setTimeout(() => {
      const voteManager = new VoteManager(this.#players, this.#categories);

      // Haven't found a way to silence this warning and still have
      // removeEventListener work.
      // eslint-disable-next-line unicorn/consistent-function-scoping
      const votingEndedListener = (/** @type {Event} */ _event) => {
        const event =
          /** @type {import("./vote-manager.js").VotingEndedEvent} */ (_event);

        /** @type {Record<string, number>} */
        const scores = {};
        for (const [key, value] of event.scores.entries()) {
          scores[key.name] = value;
        }

        this.#state = { type: "leaderboard" };
        this.#broadcast({
          type: "voting-ended",
          content: {
            scores,
          },
        });
      };

      voteManager.addEventListener("voting-ended", votingEndedListener, {
        once: true,
      });
      voteManager.start();

      this.#state = {
        type: "voting",
        cleanup: () => {
          if (this.#state.type !== "voting")
            throw new Error(
              `Unexpected round state on cleanup: ${this.#state.type}`
            );

          voteManager.removeEventListener("voting-ended", votingEndedListener);
          voteManager.stop();
        },
      };
    }, 3e3);
  }
}
