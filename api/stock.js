export const config = {
  runtime: "nodejs"
};

import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGO_URI;
const dbName = "rman";
const collectionName = "stock";

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
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const queryParams = req.query || {};
  const partNo = typeof queryParams.partno === "string" ? queryParams.partno : "";
  const route = queryParams.route || "";

  try {
    const client = await connectToMongo();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // If route=all, return all stocks
    if (route === "all") {
      const allStocks = await collection.find({}).toArray();
      return res.status(200).json(allStocks);
    }

    // If partNo is provided, return single stock
    if (partNo) {
      const stockItem = await collection.findOne({ PART_NO: partNo });
      if (!stockItem) return res.status(404).json({ message: "Stock item not found" });
      return res.status(200).json(stockItem);
    }

    // If neither, send error
    return res.status(400).json({ message: "Please provide a partno or use route=all" });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}
