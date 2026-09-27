import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const http = createServer(app);

const wss = new WebSocketServer({
    server: http
});

/* ===== WEBSITE ===== */

const publicPath = path.join(__dirname, "public");

app.use(express.static(publicPath));

app.get("/", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
});

/* ===== PLAYERS ===== */

const players = new Map();

function broadcast() {
    const data = JSON.stringify({
        type: "state",
        players: [...players.values()]
    });

    for (const client of wss.clients) {
        if (client.readyState === 1) {
            client.send(data);
        }
    }
}

/* ===== WEBSOCKET ===== */

wss.on("connection", (ws) => {

    const id = randomUUID();

    const player = {
        id,
        name: "Player " + id.slice(0, 4),
        x: 0,
        z: 0,
        rot: 0,
        job: "Civilian",
        cash: 500,
        car: true
    };

    players.set(id, player);

    ws.send(JSON.stringify({
        type: "welcome",
        id,
        self: player
    }));

    broadcast();

    ws.on("message", (raw) => {

        try {

            const message = JSON.parse(raw);
            const p = players.get(id);

            if (!p) return;

            if (message.type === "update") {

                p.x = Math.max(
                    -240,
                    Math.min(
                        240,
                        Number(message.x) || 0
                    )
                );

                p.z = Math.max(
                    -240,
                    Math.min(
                        240,
                        Number(message.z) || 0
                    )
                );

                p.rot = Number(message.rot) || 0;
            }

            if (
                message.type === "job" &&
                [
                    "Civilian",
                    "Police",
                    "Medic",
                    "Firefighter"
                ].includes(message.job)
            ) {

                p.job = message.job;
            }

            if (message.type === "reward") {

                p.cash += Math.max(
                    0,
                    Math.min(
                        1000,
                        Number(message.amount) || 0
                    )
                );
            }

            broadcast();

        } catch (error) {

            console.log("Message error:", error);
        }
    });

    ws.on("close", () => {

        players.delete(id);

        broadcast();
    });
});

/* ===== HEALTH CHECK ===== */

app.get("/health", (req, res) => {

    res.json({
        ok: true,
        players: players.size
    });
});

/* ===== START ===== */

const PORT = process.env.PORT || 3000;

http.listen(PORT, "0.0.0.0", () => {

    console.log(
        `Emergency City RP running on port ${PORT}`
    );

});
