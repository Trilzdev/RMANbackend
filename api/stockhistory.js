export const config = {
    runtime: "nodejs"
};

import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGO_URI;
const dbName = "rman";
const collectionName = "stockhistory"; // <-- stock history collection

let cachedClient = null;

async function connectToMongo() {
    if (cachedClient && cachedClient.topology && cachedClient.topology.isConnected()) {
        return cachedClient;
    }
    const client = new MongoClient(mongoUri);
    await client.connect();
    cachedClient = client;
    return client;
}

export default async function handler(req, res) {
    // --- CORS ---
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    const { period } = req.query || {};

    if (!period) {
        return res.status(400).json({
            message: "Missing required period query parameter (e.g. ?period=2022-07)"
        });
    }

    try {
        const client = await connectToMongo();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // --- Aggregation Pipeline ---
        const pipeline = [
            // 0. Filter by period
            {
                $match: {
                    PERIOD: period      // <-- adjust field name if different
                }
            },
            // 1. Compute per-item totals
            {
                $group: {
                    _id: {
                        groupName: "$GROUP_NAME",  // adjust field name to your schema
                        partNo: "$PART_NO",
                        desc: "$DESC"
                    },
                    qtySold: { $sum: "$QTY_SOLD" },
                    qtyBuy: { $sum: "$QTY_BUY" },
                    totalBuy: { $sum: "$TOTAL_BUY" },
                    totalSold: { $sum: "$TOTAL_SOLD" }
                }
            },
            // 2. Calculate profit at item level
            {
                $addFields: {
                    profit: { $subtract: ["$totalSold", "$totalBuy"] }
                }
            },
            // 3. Regroup by groupName to build nested items array
            {
                $group: {
                    _id: "$_id.groupName",
                    items: {
                        $push: {
                            PART_NO: "$_id.partNo",
                            DESC: "$_id.desc",
                            itemTotals: {
                                qtySold: "$qtySold",
                                qtyBuy: "$qtyBuy",
                                buy: "$totalBuy",
                                sold: "$totalSold",
                                profit: "$profit"
                            }
                        }
                    },
                    groupQtySold: { $sum: "$qtySold" },
                    groupQtyBuy: { $sum: "$qtyBuy" },
                    groupTotalBuy: { $sum: "$totalBuy" },
                    groupTotalSold: { $sum: "$totalSold" }
                }
            },
            // 4. Add profit at group level
            {
                $addFields: {
                    groupTotals: {
                        totalQtySold: "$groupQtySold",
                        totalQtyBuy: "$groupQtyBuy",
                        totalBuy: "$groupTotalBuy",
                        totalSold: "$groupTotalSold",
                        totalProfit: { $subtract: ["$groupTotalSold", "$groupTotalBuy"] }
                    }
                }
            },
            // 5. Format final fields
            {
                $project: {
                    _id: 0,
                    groupName: "$_id",
                    groupTotals: 1,
                    items: 1
                }
            }
        ];

        const groupedData = await collection.aggregate(pipeline).toArray();

        return res.status(200).json(groupedData);
    } catch (err) {
        console.error("Stock history server error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
}
