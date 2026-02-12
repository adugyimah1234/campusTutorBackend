"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const http_1 = require("../utils/http");
function validate(schema) {
    return (req, _res, next) => {
        const result = schema.safeParse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        if (!result.success) {
            return next((0, http_1.badRequest)("Validation failed", result.error.flatten()));
        }
        req.body = result.data.body ?? req.body;
        req.query = result.data.query ?? req.query;
        req.params = result.data.params ?? req.params;
        return next();
    };
}
