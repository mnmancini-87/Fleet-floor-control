const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const INSTRUCTOR_PIN = process.env.INSTRUCTOR_PIN || "captain";

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

function defaultShips() {
  return Array.from({ length: 15 }, (_, i) => ({
    id: i,
    name: `Ship ${i + 1}`,
    status: "idle"
  }));
}

function getRoom(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return null;
  if (!rooms.has(normalized)) {
    rooms.set(normalized, {
      code: normalized,
      ships: defaultShips(),
      queue: [],
      activeId: null,
      instructorSockets: new Set(),
      crewSockets: new Map()
    });
  }
  return rooms.get(normalized);
}

function publicState(room) {
  return {
    code: room.code,
    ships: room.ships,
    queue: room.queue,
    activeId: room.activeId
  };
}

function broadcast(room) {
  io.to(`room:${room.code}`).emit("state", publicState(room));
}

function isInstructor(socket, roomCode) {
  return socket.data.role === "instructor" && socket.data.roomCode === roomCode;
}

io.on("connection", (socket) => {
  socket.on("join-instructor", ({ roomCode, pin }, ack = () => {}) => {
    const code = String(roomCode || "").trim().toUpperCase();
    if (!code) return ack({ ok: false, error: "Enter a room code." });
    if (String(pin || "") !== INSTRUCTOR_PIN) {
      return ack({ ok: false, error: "Incorrect instructor PIN." });
    }

    const room = getRoom(code);
    socket.join(`room:${code}`);
    socket.data.role = "instructor";
    socket.data.roomCode = code;
    room.instructorSockets.add(socket.id);

    ack({ ok: true, state: publicState(room) });
    broadcast(room);
  });

  socket.on("join-crew", ({ roomCode, shipId }, ack = () => {}) => {
    const code = String(roomCode || "").trim().toUpperCase();
    const room = rooms.get(code);
    const id = Number(shipId);

    if (!room) return ack({ ok: false, error: "That room is not open yet." });
    if (!Number.isInteger(id) || !room.ships.some(s => s.id === id)) {
      return ack({ ok: false, error: "Choose a valid ship." });
    }

    socket.join(`room:${code}`);
    socket.data.role = "crew";
    socket.data.roomCode = code;
    socket.data.shipId = id;
    room.crewSockets.set(socket.id, id);

    ack({ ok: true, state: publicState(room) });
  });

  socket.on("request-floor", ({ roomCode, shipId }, ack = () => {}) => {
    const code = String(roomCode || "").trim().toUpperCase();
    const room = rooms.get(code);
    const id = Number(shipId);

    if (!room) return ack({ ok: false, error: "Room not found." });
    if (socket.data.role !== "crew" || socket.data.roomCode !== code || socket.data.shipId !== id) {
      return ack({ ok: false, error: "Crew session does not match this ship." });
    }

    const ship = room.ships.find(s => s.id === id);
    if (!ship) return ack({ ok: false, error: "Ship not found." });
    if (ship.status === "active") return ack({ ok: true });

    if (!room.queue.includes(id)) room.queue.push(id);
    ship.status = "requested";
    broadcast(room);
    ack({ ok: true });
  });

  socket.on("cancel-request", ({ roomCode, shipId }, ack = () => {}) => {
    const code = String(roomCode || "").trim().toUpperCase();
    const room = rooms.get(code);
    const id = Number(shipId);

    if (!room) return ack({ ok: false, error: "Room not found." });
    if (socket.data.role !== "crew" || socket.data.roomCode !== code || socket.data.shipId !== id) {
      return ack({ ok: false, error: "Crew session does not match this ship." });
    }

    room.queue = room.queue.filter(x => x !== id);
    const ship = room.ships.find(s => s.id === id);
    if (ship && ship.status !== "active") ship.status = "idle";
    broadcast(room);
    ack({ ok: true });
  });

  socket.on("recognize", ({ roomCode, shipId }, ack = () => {}) => {
    const code = String(roomCode || "").trim().toUpperCase();
    const room = rooms.get(code);
    const id = Number(shipId);

    if (!room || !isInstructor(socket, code)) {
      return ack({ ok: false, error: "Instructor access required." });
    }

    if (room.activeId !== null && room.activeId !== id) {
      const old = room.ships.find(s => s.id === room.activeId);
      if (old) old.status = "idle";
    }

    room.activeId = id;
    room.queue = room.queue.filter(x => x !== id);

    room.ships.forEach(s => {
      if (s.id === id) s.status = "active";
      else if (room.queue.includes(s.id)) s.status = "requested";
      else s.status = "idle";
    });

    broadcast(room);
    ack({ ok: true });
  });

  socket.on("clear-ship", ({ roomCode, shipId }, ack = () => {}) => {
    const code = String(roomCode || "").trim().toUpperCase();
    const room = rooms.get(code);
    const id = Number(shipId);

    if (!room || !isInstructor(socket, code)) {
      return ack({ ok: false, error: "Instructor access required." });
    }

    room.queue = room.queue.filter(x => x !== id);
    if (room.activeId === id) room.activeId = null;
    const ship = room.ships.find(s => s.id === id);
    if (ship) ship.status = "idle";

    broadcast(room);
    ack({ ok: true });
  });

  socket.on("reset-room", ({ roomCode }, ack = () => {}) => {
    const code = String(roomCode || "").trim().toUpperCase();
    const room = rooms.get(code);

    if (!room || !isInstructor(socket, code)) {
      return ack({ ok: false, error: "Instructor access required." });
    }

    room.queue = [];
    room.activeId = null;
    room.ships.forEach(s => s.status = "idle");
    broadcast(room);
    ack({ ok: true });
  });

  socket.on("save-names", ({ roomCode, names }, ack = () => {}) => {
    const code = String(roomCode || "").trim().toUpperCase();
    const room = rooms.get(code);

    if (!room || !isInstructor(socket, code)) {
      return ack({ ok: false, error: "Instructor access required." });
    }

    if (!Array.isArray(names) || names.length !== 15) {
      return ack({ ok: false, error: "Exactly 15 ship names are required." });
    }

    room.ships.forEach((s, i) => {
      const cleaned = String(names[i] || "").trim().slice(0, 50);
      s.name = cleaned || `Ship ${i + 1}`;
    });

    broadcast(room);
    ack({ ok: true });
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    room.instructorSockets.delete(socket.id);
    room.crewSockets.delete(socket.id);
  });
});

app.get("/health", (_req, res) => res.send("ok"));

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Fleet Floor Control running on port ${PORT}`);
});
