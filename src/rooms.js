import { randomUUID } from "node:crypto";
import Room from "./room.js";

/**
 * Uniquely identifies a room.
 * @typedef {string} RoomID
 */

/**
 * Manages a list of rooms.
 */
export default class Rooms {
  /** @type {Map<RoomID, Room>} */
  #rooms = new Map();

  /**
   * Creates a room with a random ID and adds it to the list of rooms.
   * @param {import("./room.js").RoomParameters} parameters - Parameters of the room.
   * @returns {RoomID} ID of the newly created room.
   */
  create(parameters) {
    let roomID;
    do {
      roomID = randomUUID();
    } while (this.#rooms.get(roomID) != undefined);

    const room = new Room(roomID, parameters);
    this.#rooms.set(roomID, room);

    return roomID;
  }

  /**
   * Removes a room from the list of rooms.
   * @param {Room} room - Room to remove.
   */
  remove(room) {
    this.#rooms.delete(room.id);
  }

  /**
   * Gets a room by its ID.
   * @param {RoomID} roomID - ID of the room.
   * @returns {Room | undefined} - Room with the given ID.
   */
  get(roomID) {
    return this.#rooms.get(roomID);
  }
}
