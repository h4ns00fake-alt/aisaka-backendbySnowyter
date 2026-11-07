const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "";
console.log("API_KEY có giá trị?", API_KEY.length > 0);

function checkApiKey(req, res, next) {
	const given = Buffer.from(req.headers["x-api-key"] || req.query.key || "");
	const expected = Buffer.from(API_KEY);
	if (!API_KEY || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
		return res.status(401).json({ error: "Sai API key" });
	}
	next();
}

function isValidUserId(userId) {
	return typeof userId === "string" && /^[a-zA-Z0-9_-]{1,50}$/.test(userId);
}

const AURA_NAME = /^[A-Za-z0-9 _-]{1,40}$/;
function normalizeAuraData(data) {
	if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
	let inv = data.Inventory;
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

const DATA_FILE = path.join(__dirname, "aura_data.json");
let db = {};
try { db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch (e) {}

let timer;
function persist() {
	clearTimeout(timer);
	timer = setTimeout(() => {
		fs.writeFile(DATA_FILE, JSON.stringify(db), (err) => { if (err) console.error(err); });
	}, 500);
}

app.get("/aura/load", checkApiKey, (req, res) => {
	const userId = req.query.userId;
	if (!isValidUserId(userId)) return res.status(400).json({ error: "userId khong hop le" });
	res.json({ success: true, data: db[userId] || null });
});

app.post("/aura/save", checkApiKey, (req, res) => {
	const { userId, data } = req.body;
	if (!isValidUserId(userId)) return res.status(400).json({ error: "userId khong hop le" });
	const clean = normalizeAuraData(data);
	if (!clean) return res.status(400).json({ error: "Du lieu khong hop le" });
	db[userId] = clean;
	persist();
	res.json({ success: true });
});

app.get("/", (req, res) => res.send("Octane.sw24 backend dang chay OK"));

app.listen(PORT, () => console.log("Backend chay tai cong " + PORT));
