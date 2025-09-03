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

  const { partno: partNo, route } = req.query;

  try {
    const client = await connectToMongo();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    if (route === "all") {
      const allStocks = await collection.find({}).toArray();
      return res.status(200).json(allStocks);
    }

    if (route === "grouped") {
      // MongoDB aggregation pipeline to group by GROUP_NAME
      const grouped = await collection
        .aggregate([
          {
            $group: {
              _id: "$GROUP_NAME",
              items: { $push: "$$ROOT" },
            },
          },
          {
            $project: {
              _id: 0,
              group: "$_id",
              items: 1,
            },
          },
        ])
        .toArray();

      // Convert array to an object with group names as keys
      const groupedObj = {};
      grouped.forEach(g => {
        groupedObj[g.group || "Ungrouped"] = g.items;
      });

      return res.status(200).json(groupedObj);
    }

    if (partNo) {
      const stockItem = await collection.findOne({ PART_NO: partNo });
      if (!stockItem)
        return res.status(404).json({ message: "Stock item not found" });
      return res.status(200).json(stockItem);
    }

    return res
      .status(400)
      .json({ message: "Please provide a partno or use route=all/grouped" });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}
