import { WebSocketServer } from "ws";
import { z } from "zod";
import CloseCodes from "../close-codes.js";
import app from "../app.js";

const joinWSS = new WebSocketServer({
  noServer: true,
});

const querySchema = z.object({
  nickname: z.string(),
  room_id: z.string(),
  room_password: z.string(),
});

/**
 * Adds a join room WebSocket upgrade handler to a server.
 * @param {import("http").Server} server - Server to add the handler to.
 * @param {RegExp} routePattern - Route pattern to match.
 */
export function addJoinHandler(server, routePattern) {
  server.addListener("upgrade", (request, socket, head) => {
    if (request.url == undefined || !routePattern.test(request.url)) return;

    const query = Object.fromEntries(
      new URL(request.url, `http://${request.headers.host}`).searchParams
    );

    const body = querySchema.safeParse(query);
    if (!body.success)
      return socket.end(
        `HTTP/1.1 400 Bad Request\r\n\r\n${body.error.message}`
      );

    joinWSS.handleUpgrade(request, socket, head, (ws) => {
      const room = app.rooms.get(body.data.room_id);
      if (room == undefined) {
        ws.close(CloseCodes.NO_ROOM_WITH_ID, "No room with the given ID");
        return;
      }

      if (room.password != body.data.room_password) {
        ws.close(CloseCodes.WRONG_ROOM_PASSWORD, "Wrong password");
        return;
      }

      try {
        room.addPlayer(body.data.nickname, ws);
      } catch {
        ws.close(CloseCodes.NICKNAME_ALREADY_IN_ROOM, "Name already in use");
      }
    });
  });
}
