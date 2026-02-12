"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidGhanaPhone = exports.normalizeGhanaPhone = void 0;
const normalizeGhanaPhone = (value) => value.replace(/\D/g, "");
exports.normalizeGhanaPhone = normalizeGhanaPhone;
const isValidGhanaPhone = (value) => {
    const digits = (0, exports.normalizeGhanaPhone)(value);
    if (digits.length === 10 && digits.startsWith("0"))
        return true;
    if (digits.length === 12 && digits.startsWith("233"))
        return true;
    return false;
};
exports.isValidGhanaPhone = isValidGhanaPhone;
