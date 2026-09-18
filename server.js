// server.js
// Backend luu tru data player (Token, PIE, Level, Exp) cho Aisaka Studio
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
const API_KEY = "snowyter_aisaka_2026_x7Kp9";

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

// ---- Middleware kiem tra API key ----
function checkApiKey(req, res, next) {
	const key = req.headers["x-api-key"];
	if (key !== API_KEY) {
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

// ---- GET /load?userId=123 ----
app.get("/load", checkApiKey, (req, res) => {
	const userId = req.query.userId;
	if (!userId) {
		return res.status(400).json({ error: "Thieu userId" });
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

	const db = loadDB();
	db[userId] = data;
	saveDB(db);

	res.json({ success: true });
});

// ---- Health check ----
app.get("/", (req, res) => {
	res.send("Aisaka backend dang chay OK");
});

app.listen(PORT, () => {
	console.log(`Aisaka backend dang chay tai cong ${PORT}`);
});
