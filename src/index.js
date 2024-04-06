import express from "express";
import roomsRouter from "./routes/rooms.js";
import bodyParser from "body-parser";
import { addJoinHandler } from "./ws/join.js";

const PORT = Number.parseInt(process.env["PORT"] || "3000");

const server = express();

server.use(bodyParser.json());

server.use((_, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");

  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );

  response.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );

  next();
});

server.use("/rooms", roomsRouter);

const httpServer = server.listen(PORT);
addJoinHandler(httpServer, /^\/?rooms\/join\/?\?/);
