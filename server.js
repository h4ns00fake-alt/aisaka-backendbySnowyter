// server.js
// Backend luu tru data player (Token, PIE, Level, Exp) cho Octane Studio
// Chay: npm install && npm start

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "playerdata.json");

// ---- API KEY don gian de chan nguoi la goi thang vao backend ----
// Doi gia tri nay thanh 1 chuoi bi mat cua rieng ban, roi dung y het
// trong PlayerDataModule.lua (bien API_KEY)
const API_KEY = "snowyter_octane_2026_x7Kp9";

// ---- Doc / ghi file JSON (giong 1 database nho gon) ----
function loadDB() {
	if (!fs.existsSync(DB_FILE)) {
		fs.writeFileSync(DB_FILE, JSON.stringify({}), "utf8");
	}
	const raw = fs.readFileSync(DB_FILE, "utf8");
	try {
		return JSON.parse(raw);
	} catch (e) {
		console.error("Loi doc DB, tra ve rong:", e);
		return {};
	}
}

function saveDB(db) {
	fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}
let writeQueue = Promise.resolve();

function saveDBSafe(db) {
        writeQueue = writeQueue.then(() => {
                return new Promise((resolve, reject) => {
                        fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8", (err) => {
                                if (err) reject(err);
                                else resolve();
                        });
                });
        });
        return writeQueue;
}
// ---- Middleware kiem tra API key ----
const crypto = require("crypto");

function checkApiKey(req, res, next) {
        const key = req.headers["x-api-key"] || "";
        const expected = Buffer.from(API_KEY);
        const given = Buffer.from(key);

        if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
                return res.status(401).json({ error: "Sai API key" });
        }
        next();
}

const DEFAULT_DATA = {
	Token: 0,
	PIE: 0,
	Level: 1,
	Exp: 0,
};

function isValidUserId(userId) {
        // Chỉ cho phép chuỗi số hoặc chuỗi chữ-số, độ dài hợp lý
        return typeof userId === "string" &&
               /^[a-zA-Z0-9_-]{1,50}$/.test(userId) &&
               userId !== "__proto__" &&
               userId !== "constructor" &&
               userId !== "prototype";
}

function isValidPlayerData(data) {
        if (typeof data !== "object" || data === null) return false;
        const keys = ["Token", "PIE", "Level", "Exp"];
        for (const k of keys) {
                if (typeof data[k] !== "number" || !Number.isFinite(data[k]) || data[k] < 0) {
                        return false;
                }
        }
        // Giới hạn hợp lý để chặn số điên rồ - chỉnh theo game của bạn
        if (data.Token > 1_000_000 || data.Level > 1000 || data.Exp > 10_000_000) {
                return false;
        }
        return true;
}

// ---- GET /load?userId=123 ----
app.get("/load", checkApiKey, (req, res) => {
        const userId = req.query.userId;
        if (!userId || !isValidUserId(userId)) {
                return res.status(400).json({ error: "userId khong hop le" });
        }
        const db = loadDB();
        const data = db[userId] || { ...DEFAULT_DATA };
        res.json({ success: true, data });
});

// ---- POST /save  body: { userId, data } ----
app.post("/save", checkApiKey, (req, res) => {
        const { userId, data } = req.body;

        if (!userId || !data) {
                return res.status(400).json({ error: "Thieu userId hoac data" });
        }
        if (!isValidUserId(userId)) {
                return res.status(400).json({ error: "userId khong hop le" });
        }
        if (!isValidPlayerData(data)) {
                return res.status(400).json({ error: "Du lieu khong hop le" });
        }

        const db = loadDB();
        const old = db[userId] || { ...DEFAULT_DATA };

        // Chặn tăng bất thường trong 1 lần save (tuỳ chỉnh ngưỡng)
        if (data.Token - old.Token > 100000 || data.Level - old.Level > 5) {
                console.warn(`Nghi ngo gian lan: userId=${userId}`, old, "->", data);
                return res.status(400).json({ error: "Thay doi bat thuong, bi tu choi" });
        }

        db[userId] = data;
        saveDB(db);
        res.json({ success: true });
});

// ---- Health check ----
app.get("/", (req, res) => {
	res.send("Octane.sw24 backend dang chay OK");
});

app.listen(PORT, () => {
	console.log(`Octane.sw24 backend dang chay tai cong ${PORT}`);
});
