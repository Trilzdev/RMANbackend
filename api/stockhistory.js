import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGO_URI;
const dbName = "rman";
const collectionName = "stockhistory";

let cachedClient = null;
async function connectToMongo() {
  if (cachedClient && cachedClient.topology?.isConnected()) return cachedClient;
  const client = new MongoClient(mongoUri);
  await client.connect();
  cachedClient = client;
  return client;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const period = req.query.period;
  if (!period) return res.status(400).json({ error: "period is required (e.g. 2022-07)" });

  try {
    const client = await connectToMongo();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Try matching both PERIOD_ISO and PERIOD
    const pipeline = [
      {
        $match: {
          $or: [
            { PERIOD_ISO: period },
            { PERIOD: period.replace("-", "") }
          ]
        }
      },
      {
        $group: {
          _id: "$GROUP_NAME",
          items: { $push: "$$ROOT" },
          totalQtySold: { $sum: "$QTY_SOLD" },
          totalQtyBuy: { $sum: "$QTY_BUY" },
          totalBuy: { $sum: "$BUY" },
          totalSold: { $sum: "$SOLD" },
          totalProfit: { $sum: { $subtract: ["$SOLD", "$BUY"] } }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const data = await collection.aggregate(pipeline).toArray();

    // Compute grand totals
    const grandTotals = data.reduce(
      (acc, g) => {
        acc.totalQtySold += g.totalQtySold;
        acc.totalQtyBuy += g.totalQtyBuy;
        acc.totalBuy += g.totalBuy;
        acc.totalSold += g.totalSold;
        acc.totalProfit += g.totalProfit;
        return acc;
      },
      { totalQtySold: 0, totalQtyBuy: 0, totalBuy: 0, totalSold: 0, totalProfit: 0 }
    );

    res.status(200).json({ period, groups: data, grandTotals });
  } catch (err) {
    console.error("Error fetching stock history:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
