import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerHandlers } from './socket/handlers.js';

const PORT = process.env.PORT || 10000;

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [
      "https://themafiaclubbot.vercel.app",
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 10 * 1024 * 1024,
});

registerHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`🎭 Mafia server running on http://localhost:${PORT}`);
});
