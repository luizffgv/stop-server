import app from "./app.js";
import Player from "./player.js";
import VoteManager from "./vote-manager.js";

/**
 * @typedef {object} RoomParameters
 * @property {string} password - Password of the room.
 * @property {Iterable<string>} letters - Available letters of the alphabet to
 * play.
 * @property {string[]} categories - Categories available in the room.
 */

export default class Room {
  /**
   * Timeout to stop the room if no player has joined after a certain time.
   * @type {NodeJS.Timeout | undefined}
   */
  #noPlayerTimeout = undefined;

  /** @type {((event: Event) => void) | undefined} */
  #votingEndedListener;

  /**
   * Whether a round is in progress, including the time after requesting a start
   * and before the round has really started.
   * @type {boolean}
   */
  #roundInProgress = false;

  /**
   * Automatic timeout to stop the round after a certain time.
   * @type {NodeJS.Timeout | undefined}
   */
  #roundStopTimeout = undefined;

  /**
   * Period while the round is stopping before it actually stops, to allow
   * players to submit their final responses.
   */
  #roundStopping = false;

  /**
   * Whether players can request a stop. This is available after a certain time
   * has passed in the round.
   * @type {boolean}
   */
  #stopAvailable = false;

  /** @type {VoteManager | undefined} */
  #voteManager;

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
    if (this.#roundStopTimeout != undefined) {
      clearTimeout(this.#roundStopTimeout);
      this.#roundStopTimeout = undefined;
    }
    if (this.#noPlayerTimeout != undefined) {
      clearTimeout(this.#noPlayerTimeout);
      this.#noPlayerTimeout = undefined;
    }

    if (this.#votingEndedListener != undefined)
      this.#voteManager?.removeEventListener(
        "voting-ended",
        this.#votingEndedListener
      );
    this.#voteManager?.stop();
    this.#voteManager = undefined;

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

    clearTimeout(this.#noPlayerTimeout);

    const newPlayer = new Player(name, this, ws);
    this.#players.push(newPlayer);
    newPlayer.send({
      type: "room-players",
      content: this.#players.map((p) => p.name),
    });

    for (const player of this.#players) {
      player.send({
        type: "player-joined",
        content: {
          name,
        },
      });
    }
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
  }

  /**
   * Begins starting a new round, broadcasting a "starting" message to all
   * players some seconds before.
   * @throws {Error} If a round is already in progress.
   */
  startRound() {
    if (this.#roundInProgress) throw new Error("Round already in progress");

    this.#broadcast({ type: "round-starting" });

    this.#roundInProgress = true;
    this.#stopAvailable = false;

    const letter = [...this.#letters][
      Math.floor(Math.random() * this.#letters.size)
    ];
    if (letter == undefined) {
      throw new Error(
        "No letters available to start a round. This should never be thrown."
      );
    }

    const duration = this.#categories.length * 5e3;

    setTimeout(() => {
      this.#broadcast({ type: "round-started", content: { letter, duration } });

      this.#roundStopTimeout = setTimeout(() => {
        this.#roundStopTimeout = undefined;
        this.stopRound();
      }, duration);

      setTimeout(() => {
        this.#stopAvailable = true;
        this.#broadcast({ type: "stop-available" });
      }, duration / 2);
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
    if (!this.#roundInProgress)
      throw new Error("Can't stop a round that's not in progress.");

    if (requester != undefined && !this.#stopAvailable)
      throw new Error("Requesting a stop is not available yet.");

    if (this.#roundStopping)
      throw new Error("Can't stop a round that's already stopping.");

    if (this.#roundStopTimeout != undefined)
      clearTimeout(this.#roundStopTimeout);

    this.#stopAvailable = false;
    this.#roundStopping = true;

    this.#broadcast({
      type: "round-stopping",
      content: { requester: requester?.name },
    });

    setTimeout(() => {
      this.#roundStopping = false;

      this.#voteManager = new VoteManager(this.#players, this.#categories);
      this.#votingEndedListener = (_event) => {
        this.#voteManager = undefined;

        this.#roundInProgress = false;

        const event =
          /** @type {import("./vote-manager.js").VotingEndedEvent} */ (_event);

        /** @type {Record<string, number>} */
        const scores = {};
        for (const [key, value] of event.scores.entries()) {
          scores[key.name] = value;
        }

        this.#broadcast({
          type: "voting-ended",
          content: {
            scores,
          },
        });

        this.#close();
      };
      this.#voteManager.addEventListener(
        "voting-ended",
        this.#votingEndedListener,
        { once: true }
      );
      this.#voteManager.start();
    }, 3e3);
  }
}
