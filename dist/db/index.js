"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = query;
const pool_1 = require("./pool");
async function query(sql, params) {
    const [rows] = await pool_1.pool.execute(sql, params);
    return rows;
}
