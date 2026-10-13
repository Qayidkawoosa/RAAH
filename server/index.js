import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { connectStore } from './src/store.js';
import { registerRoutes } from './src/routes.js';
import { registerSockets } from './src/sockets.js';
import { startDemoBus } from './src/demoBus.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Single-.env setup: the server reads the same root .env the Expo app uses.
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config(); // optional server-local .env overrides

const PORT = Number(process.env.PORT || 4000);

const store = await connectStore(process.env.MONGODB_URI);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

registerRoutes(app, store);
registerSockets(io, store);
startDemoBus(io, store);

app.get('/health', (_req, res) =>
  res.json({
    ok: true,
    db: store.usingMongo ? 'mongodb' : 'in-memory',
    ai: process.env.GEMINI_API_KEY ? 'gemini' : 'heuristic-fallback',
  })
);

server.listen(PORT, () => {
  console.log(`Raasta Kashmir server listening on http://localhost:${PORT}`);
  console.log(`  DB: ${store.usingMongo ? 'MongoDB' : 'in-memory fallback'}`);
  console.log(`  AI: ${process.env.GEMINI_API_KEY ? 'Gemini' : 'heuristic fallback (set GEMINI_API_KEY)'}`);
});
