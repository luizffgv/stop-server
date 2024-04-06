import { Router } from "express";
import app from "../app.js";
import { z } from "zod";

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

export default router;
