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
const wss = new WebSocketServer({ server: http });

const publicPath = path.join(__dirname, "public");

app.use(express.static(publicPath));

app.get("/", (_, res) =>
    res.sendFile(path.join(publicPath, "index.html"))
);

app.get("/health", (_, res) =>
    res.json({
        ok: true,
        players: players.size,
        round
    })
);

const players = new Map();

let round = 1;

let teamScore = {
    a: 0,
    b: 0
};

let roundStarted = Date.now();

const ROUND_MS = 120000;

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function validNum(n) {
    return Number.isFinite(Number(n))
        ? Number(n)
        : 0;
}

function broadcast() {

    const data = JSON.stringify({
        type: "state",
        players: [...players.values()]
    });

    for (const ws of wss.clients) {

        if (ws.readyState === 1) {
            ws.send(data);
        }
    }
}

function sendRound() {

    const data = JSON.stringify({
        type: "round",
        round,
        you: teamScore.a,
        enemy: teamScore.b
    });

    for (const ws of wss.clients) {

        if (ws.readyState === 1) {
            ws.send(data);
        }
    }
}

function resetRound() {

    round++;

    roundStarted = Date.now();

    for (const p of players.values()) {

        p.hp = 100;

        p.x =
            Math.random() * 20 - 10;

        p.z =
            Math.random() * 20 - 10;
    }

    sendRound();
    broadcast();
}

setInterval(() => {

    if (
        Date.now() - roundStarted >=
        ROUND_MS
    ) {
        resetRound();
    }

}, 1000);

wss.on("connection", ws => {

    const id = randomUUID();

    const team =
        Math.random() > .5
            ? "a"
            : "b";

    const player = {

        id,

        name:
            "Player " +
            id.slice(0, 4),

        x:
            Math.random() * 20 - 10,

        y: 0,

        z:
            Math.random() * 20 - 10,

        rot: 0,

        hp: 100,

        team
    };

    players.set(id, player);

    ws.send(
        JSON.stringify({
            type: "welcome",
            id,
            self: player
        })
    );

    sendRound();

    broadcast();

    ws.on("message", raw => {

        try {

            const message =
                JSON.parse(raw);

            const me =
                players.get(id);

            if (!me) return;

            if (
                message.type ===
                "update"
            ) {

                me.x = clamp(
                    validNum(message.x),
                    -195,
                    195
                );

                me.y = 0;

                me.z = clamp(
                    validNum(message.z),
                    -195,
                    195
                );

                me.rot =
                    validNum(
                        message.rot
                    );

                if (
                    message.hp !==
                    undefined
                ) {

                    me.hp = clamp(
                        validNum(
                            message.hp
                        ),
                        0,
                        100
                    );
                }
            }

            if (
                message.type ===
                "hit"
            ) {

                const target =
                    players.get(
                        String(
                            message.target
                        )
                    );

                if (
                    !target ||
                    target.id === id
                ) return;

                const damage =
                    clamp(
                        validNum(
                            message.damage
                        ),
                        1,
                        100
                    );

                target.hp =
                    clamp(
                        target.hp -
                        damage,
                        0,
                        100
                    );

                if (
                    target.hp <= 0
                ) {

                    if (
                        me.team === "a"
                    )
                        teamScore.a++;
                    else
                        teamScore.b++;

                    target.hp = 100;

                    target.x =
                        Math.random() *
                        20 - 10;

                    target.z =
                        Math.random() *
                        20 - 10;

                    sendRound();
                }
            }

            broadcast();

        } catch (error) {

            console.log(
                "Message error:",
                error.message
            );
        }
    });

    ws.on("close", () => {

        players.delete(id);

        broadcast();
    });
});

const PORT =
    process.env.PORT || 3000;

http.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Tactical City running on port ${PORT}`
        );
    }
);
