export const config = {
  runtime: "nodejs"
};

import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGO_URI;
const dbName = "rman";
const collectionName = "stock";   // <-- this is your new collection

let cachedClient = null;

async function connectToMongo() {
  if (cachedClient && cachedClient.isConnected && cachedClient.isConnected()) {
    return cachedClient;
  }
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

  const queryParams = req.query || {};
  const partNo = typeof queryParams.partno === "string" ? queryParams.partno : "";

  if (!partNo) {
    return res.status(400).json({ message: "Please provide a partno query parameter" });
  }

  try {
    const client = await connectToMongo();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // --- Build query ---
    const query = { PART_NO: partNo }; // field name must match DB field name

    const stockItem = await collection.findOne(query);

    if (!stockItem) {
      return res.status(404).json({ message: "Stock item not found" });
    }

    res.status(200).json(stockItem);
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}
