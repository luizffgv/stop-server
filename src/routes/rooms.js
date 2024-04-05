import { Router } from "express";
import app from "../app.js";
import { WebSocketServer } from "ws";
import { z } from "zod";
import CloseCodes from "../close-codes.js";

const router = Router();

const createPostSchema = z.object({
  password: z.string(),
  letters: z.array(z.string().length(1)).min(1).max(26),
  categories: z.array(z.string()).min(1).max(32),
});

router.post("/create", (request, response) => {
  const body = createPostSchema.safeParse(request.body);

  if (!body.success) return response.status(400).send(body.error);

  const roomID = app.rooms.create({
    password: body.data.password,
    letters: body.data.letters,
    categories: body.data.categories,
  });
  return response.status(201).json({ id: roomID });
});

const joinGetSchema = z.object({
  nickname: z.string(),
  room_id: z.string(),
  room_password: z.string(),
});

const joinWSS = new WebSocketServer({
  noServer: true,
});

// Ping player clients so we can detect when they lose connection.
// The timeout logic is implemented elsewhere.
setInterval(() => {
  // for (const client of joinWSS.clients) client.ping();
}, 10e3);

router.get("/join", (request, response) => {
  if (request.headers["upgrade"] !== "websocket")
    return response.status(400).send("Upgrade to WebSocket first");

  const body = joinGetSchema.safeParse(request.query);
  if (!body.success) return response.status(400).send(body.error);

  joinWSS.handleUpgrade(request, request.socket, Buffer.alloc(0), (ws) => {
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

export default router;
