export const config = {
  runtime: "nodejs"
};

import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGO_URI;
const dbName = "rman";
const collectionName = "stock"; // your stock collection

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

  try {
    const client = await connectToMongo();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Only fetch PART_NO and DESCRIPTION fields
    const cursor = collection.find(
      {},
      { projection: { PART_NO: 1, DESC: 1, _id: 0 } }
    ).sort({ DESC: 1 }); // 1 = ascending, -1 = descending
    const list = await cursor.toArray();

    if (!list || list.length === 0) {
      return res.status(404).json({ message: "No stock items found" });
    }

    res.status(200).json(list);
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}
