const express = require("express");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "";

function checkApiKey(req, res, next) {
	const given = Buffer.from(req.headers["x-api-key"] || "");
	const expected = Buffer.from(API_KEY);
	if (!API_KEY || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
		return res.status(401).json({ error: "Sai API key" });
	}
	next();
}

function isValidUserId(userId) {
	return typeof userId === "string" && /^[a-zA-Z0-9_-]{1,50}$/.test(userId);
}

function isValidPlayerData(data) {
	if (typeof data !== "object" || data === null) return false;
	for (const k of ["Point", "PIE", "Level", "Exp"]) {
		if (typeof data[k] !== "number" || !Number.isFinite(data[k]) || data[k] < 0) return false;
	}
	return data.Point <= 1_000_000_000 && data.PIE <= 1_000_000_000
		&& data.Level <= 100_000_000 && data.Exp <= 1_000_000_000_000;
}

// ---- Dữ liệu game aura: { Inventory: { [tenAura]: soLuong }, Equipped: "tenAura" } ----
const AURA_NAME = /^[A-Za-z0-9 _-]{1,40}$/;

function normalizeAuraData(data) {
	if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
	let inv = data.Inventory;
	// Roblox mã hóa bảng rỗng thành [] nên coi như kho đồ rỗng
	if (inv === undefined || (Array.isArray(inv) && inv.length === 0)) inv = {};
	if (typeof inv !== "object" || inv === null || Array.isArray(inv)) return null;

	const names = Object.keys(inv);
	if (names.length > 500) return null;
	const out = {};
	for (const name of names) {
		const n = inv[name];
		if (!AURA_NAME.test(name) || !Number.isInteger(n) || n < 1 || n > 1_000_000_000) return null;
		out[name] = n;
	}

	const equipped = data.Equipped === undefined ? "" : data.Equipped;
	if (typeof equipped !== "string" || (equipped !== "" && !AURA_NAME.test(equipped))) return null;

	return { Inventory: out, Equipped: equipped };
}

let col;      // game cũ (Point/PIE/Level/Exp)
let auraCol;  // game aura (Inventory/Equipped)

// ---- Route cũ (giữ nguyên) ----
app.get("/load", checkApiKey, async (req, res) => {
	const userId = req.query.userId;
	if (!isValidUserId(userId)) return res.status(400).json({ error: "userId khong hop le" });
	try {
		const doc = await col.findOne({ _id: userId });
		res.json({ success: true, data: doc ? doc.data : null });
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: "Loi doc du lieu" });
	}
});

app.post("/save", checkApiKey, async (req, res) => {
	const { userId, data } = req.body;
	if (!isValidUserId(userId)) return res.status(400).json({ error: "userId khong hop le" });
	if (!isValidPlayerData(data)) return res.status(400).json({ error: "Du lieu khong hop le" });
	try {
		const { Point, PIE, Level, Exp } = data;
		await col.updateOne(
			{ _id: userId },
			{ $set: { data: { Point, PIE, Level, Exp }, updatedAt: new Date() } },
			{ upsert: true }
		);
		res.json({ success: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: "Loi luu du lieu" });
	}
});

// ---- Route mới cho game aura ----
app.get("/aura/load", checkApiKey, async (req, res) => {
	const userId = req.query.userId;
	if (!isValidUserId(userId)) return res.status(400).json({ error: "userId khong hop le" });
	try {
		const doc = await auraCol.findOne({ _id: userId });
		res.json({ success: true, data: doc ? doc.data : null });
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: "Loi doc du lieu" });
	}
});

app.post("/aura/save", checkApiKey, async (req, res) => {
	const { userId, data } = req.body;
	if (!isValidUserId(userId)) return res.status(400).json({ error: "userId khong hop le" });
	const clean = normalizeAuraData(data);
	if (!clean) return res.status(400).json({ error: "Du lieu khong hop le" });
	try {
		await auraCol.updateOne(
			{ _id: userId },
			{ $set: { data: clean, updatedAt: new Date() } },
			{ upsert: true }
		);
		res.json({ success: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: "Loi luu du lieu" });
	}
});

app.get("/", (req, res) => res.send("Octane.sw24 backend dang chay OK"));

(async () => {
	   	console.log("Biến có chữ MONGO:", Object.keys(process.env).filter(k => k.toUpperCase().includes("MONGO")));
   	console.log("MONGO_URI có giá trị?", !!process.env.MONGO_URI);
	const client = new MongoClient(process.env.MONGO_URI);
	await client.connect();
	const db = client.db("octane");
	col = db.collection("players");
	auraCol = db.collection("aura_players");
	app.listen(PORT, () => console.log("Backend chay tai cong " + PORT));
})();
