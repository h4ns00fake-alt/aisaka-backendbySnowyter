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

let col;

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
		await col.updateOne({ _id: userId }, { $set: { data, updatedAt: new Date() } }, { upsert: true });
		res.json({ success: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: "Loi luu du lieu" });
	}
});

app.get("/", (req, res) => res.send("Octane.sw24 backend dang chay OK"));

(async () => {
	const client = new MongoClient(process.env.MONGO_URI);
	await client.connect();
	col = client.db("octane").collection("players");
	app.listen(PORT, () => console.log("Backend chay tai cong " + PORT));
})();
