export const config = {
  runtime: "nodejs"
};

import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGO_URI;
const dbName = "rman";
const collectionName = "transactions";

let cachedClient = null;

async function connectToMongo() {
  if (cachedClient && cachedClient.isConnected && cachedClient.isConnected()) return cachedClient;
  const client = new MongoClient(mongoUri);
  await client.connect();
  cachedClient = client;
  return client;
}

export default async function handler(req, res) {
  // ✅ CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // --- Ensure req.query exists ---
  const queryParams = req.query || {};
  const code = typeof queryParams.code === "string" ? queryParams.code : "";
  const date = typeof queryParams.date === "string" ? queryParams.date : "";
  const start = typeof queryParams.start === "string" ? queryParams.start : "";
  const end = typeof queryParams.end === "string" ? queryParams.end : "";
  const customer = typeof queryParams.customer === "string" ? queryParams.customer : "";
  const route = typeof queryParams.route === "string" ? queryParams.route : "";

  // --- Debug logging for production ---
  console.log("REQ QUERY:", queryParams);
  console.log("REQ URL:", req.url);

  try {
    const client = await connectToMongo();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const query = {};

    // --- Build query safely ---
    if (route === "sp-date-range") {
      if (!start || !end) return res.status(400).json({ message: "Provide start and end dates" });
      query.type = "SP";
      query.date = { $gte: start, $lte: end };
    } else if (route === "sp-date") {
      if (!date) return res.status(400).json({ message: "Provide date" });
      query.type = "SP";
      query.date = date;
    } else if (route === "pi-date") {
      if (!date) return res.status(400).json({ message: "Provide date" });
      query.type = "PI";
      query.date = date;
    } else if (code) {
      query.unqcode = code;
    } else {
      if (date) query.date = date;
      if (start && end) query.date = { $gte: start, $lte: end };
      if (customer) query.customer = { $regex: customer, $options: "i" };
    }

    // --- Fetch results ---
    const results = code
      ? await collection.findOne(query)
      : await collection.find(query).toArray();

    if (!results || (Array.isArray(results) && results.length === 0)) {
      return res.status(404).json({ message: "No transactions found" });
    }

    res.status(200).json(results);
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}
