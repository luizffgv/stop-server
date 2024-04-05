import { z } from "zod";

/** Message sent when a player has joined the room. */
export const playerJoinedSchema = z.object({
  type: z.literal("player-joined"),
  content: z.object({
    name: z.string().describe("Name of the player who joined"),
  }),
});
/** @typedef {z.infer<typeof playerJoinedSchema>} PlayerJoinedMessage */

/** Message sent to tell the player who is in the room when they join. */
export const roomPlayersSchema = z.object({
  type: z.literal("room-players"),
  content: z.array(z.string()).describe("List of players in the room"),
});
/** @typedef {z.infer<typeof roomPlayersSchema>} RoomPlayersMessage */

/** Message sent to tell the player what themes are in the room. */
export const roomCategoriesSchema = z.object({
  type: z.literal("room-categories"),
  content: z.array(z.string()).describe("List of categories in the room"),
});
/** @typedef {z.infer<typeof roomCategoriesSchema>} RoomCategoriesMessage */

/** Message sent when the round is starting. */
export const roundStartingSchema = z.object({
  type: z.literal("round-starting"),
});
/** @typedef {z.infer<typeof roundStartingSchema>} RoundStartingMessage */

/** Message sent when the round has started. */
export const roundStartedSchema = z.object({
  type: z.literal("round-started"),
  content: z.object({
    letter: z.string().describe("Letter of the round"),
    duration: z.number().describe("Duration of the round, in milliseconds"),
  }),
});
/** @typedef {z.infer<typeof roundStartedSchema>} RoundStartedMessage */

/**
 * Message sent when the round begins stopping. Interaction should be blocked
 * and final answers should be submitted to the server immediately.
 */
export const roundStoppingSchema = z.object({
  type: z.literal("round-stopping"),
  content: z.object({
    requester: z
      .optional(z.string())
      .describe("Name of the player who requested to stop the round"),
  }),
});
/** @typedef {z.infer<typeof roundStoppingSchema>} RoundStoppingMessage */

/** Message sent when requesting a stop is available. */
export const stopAvailableSchema = z.object({
  type: z.literal("stop-available"),
});
/** @typedef {z.infer<typeof stopAvailableSchema>} StopAvailableMessage */

/** Message sent when a category vote has started. */
export const categoryVoteStartedSchema = z.object({
  type: z.literal("category-vote-started"),
  content: z.object({
    category: z.string().describe("Category to vote in"),
    answers: z.array(z.string()).describe("Answers to vote for"),
    duration: z
      .number()
      .describe("Duration of the voting period, in milliseconds"),
  }),
});
/** @typedef {z.infer<typeof categoryVoteStartedSchema>} CategoryVoteStartedMessage */

/** Message sent when voting has ended. */
export const votingEndedSchema = z.object({
  type: z.literal("voting-ended"),
  content: z.object({
    scores: z
      .record(z.number())
      .describe("Scores of the players after voting, in name => score pairs"),
  }),
});
/** @typedef {z.infer<typeof votingEndedSchema>} VotingEndedMessage */

/** Message sent when a player has been removed from a room. */
export const playerRemovedSchema = z.object({
  type: z.literal("player-removed"),
  content: z.object({
    name: z.string().describe("Name of the player who was removed"),
    reason: z
      .union([
        z.literal("room-closed").describe("Room was closed"),
        z.literal("left").describe("Player left the room"),
        z.literal("timed-out").describe("Player timed out"),
      ])
      .describe("Reason for the removal"),
  }),
});
/** @typedef {z.infer<typeof playerRemovedSchema>} PlayerRemovedMessage */

/** A message that can be sent to a player through WebSocket. */
export const toPlayerMessageSchema = z.union([
  playerJoinedSchema,
  roomPlayersSchema,
  roomCategoriesSchema,
  roundStartingSchema,
  roundStartedSchema,
  roundStoppingSchema,
  stopAvailableSchema,
  categoryVoteStartedSchema,
  votingEndedSchema,
  playerRemovedSchema,
]);
/** @typedef {z.infer<typeof toPlayerMessageSchema>} ToPlayerMessage */

/** A message to indicate that the player is still connected. */
export const heartbeatSchema = z.object({
  type: z.literal("heartbeat"),
});
/** @typedef {z.infer<typeof heartbeatSchema>} HeartbeatMessage */

/** Message received when the player requests to start a new round. */
export const startRoundSchema = z.object({
  type: z.literal("start-round"),
});
/** @typedef {z.infer<typeof startRoundSchema>} StartRoundMessage */

/** Message received when the player requests a stop. */
export const stopRequestSchema = z.object({
  type: z.literal("stop-round"),
});
/** @typedef {z.infer<typeof stopRequestSchema>} StopRequestMessage */

/** Message received when the player changes one of their answers. */
export const changeAnswerSchema = z.object({
  type: z.literal("change-answer"),
  content: z.object({
    category: z.string().describe("Category of the answer"),
    answer: z.string().describe("Answer being changed"),
  }),
});
/** @typedef {z.infer<typeof changeAnswerSchema>} ChangeAnswerMessage */

/** Message received a player changes their vote for an answer. */
export const changeAnswerVoteSchema = z.object({
  type: z.literal("change-answer-vote"),
  content: z.object({
    answer: z.string().describe("Answer being voted"),
    accepted: z
      .boolean()
      .describe("Whether the answer was accepted by the player"),
  }),
});
/** @typedef {z.infer<typeof changeAnswerVoteSchema>} ChangeAnswerVoteMessage */

/** Message received when the player wants to leave the room. */
export const leaveRoomSchema = z.object({
  type: z.literal("leave-room"),
});
/** @typedef {z.infer<typeof leaveRoomSchema>} LeaveRoomMessage */

/** A message that can be received from a player through WebSocket. */
export const fromPlayerMessageSchema = z.union([
  heartbeatSchema,
  startRoundSchema,
  stopRequestSchema,
  changeAnswerSchema,
  changeAnswerVoteSchema,
  leaveRoomSchema,
]);
/** @typedef {z.infer<typeof fromPlayerMessageSchema>} FromPlayerMessage */
