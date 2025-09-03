// File: api/stockhistory.js
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

export const config = {
  runtime: "nodejs",
};

const mongoUri = process.env.MONGO_URI;
const dbName = "rman";

let client;

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(mongoUri);
    await client.connect();
  }
  return client;
}

export default async function handler(req, res) {
  // ✅ Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*"); // replace '*' with your frontend URL in production
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { period, startPeriod, endPeriod } = req.query;

    if (!period && !(startPeriod && endPeriod)) {
      return res.status(400).json({
        error:
          "Please provide either ?period=YYYY-MM or both ?startPeriod=YYYY-MM&endPeriod=YYYY-MM",
      });
    }

    function normalizeYYYYMM(str) {
      if (!str) return null;
      const [year, month] = str.split("-");
      return `${year}-${month.padStart(2, "0")}`;
    }

    let match = {};
    if (period) {
      match.PERIOD_ISO = normalizeYYYYMM(period);
    } else {
      match.PERIOD_ISO = {
        $gte: normalizeYYYYMM(startPeriod),
        $lte: normalizeYYYYMM(endPeriod),
      };
    }

    const conn = await connectToMongo();
    const db = conn.db(dbName);
    const collection = db.collection("stockhistory");

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          unitCost: {
            $cond: [
              { $eq: ["$QTY_BUY", 0] },
              0,
              { $divide: ["$BUY", "$QTY_BUY"] },
            ],
          },
          soldCost: {
            $cond: [
              { $eq: ["$QTY_BUY", 0] },
              0,
              { $multiply: ["$QTY_SOLD", { $divide: ["$BUY", "$QTY_BUY"] }] },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$GROUP_NAME",
          items: { $push: "$$ROOT" },
          totalQtySold: { $sum: "$QTY_SOLD" },
          totalQtyBuy: { $sum: "$QTY_BUY" },
          totalBuy: { $sum: "$BUY" },
          totalSold: { $sum: "$SOLD" },
          totalProfit: { $sum: { $subtract: ["$SOLD", "$soldCost"] } },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const data = await collection.aggregate(pipeline).toArray();

    const grandTotals = data.reduce(
      (acc, g) => {
        acc.qtySold += g.totalQtySold;
        acc.qtyBuy += g.totalQtyBuy;
        acc.totalBuy += g.totalBuy;
        acc.totalSold += g.totalSold;
        acc.totalProfit += g.totalProfit;
        return acc;
      },
      { qtySold: 0, qtyBuy: 0, totalBuy: 0, totalSold: 0, totalProfit: 0 }
    );

    res.status(200).json({ groups: data, grandTotals });
  } catch (err) {
    console.error("Error fetching stock history:", err);
    res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
}
