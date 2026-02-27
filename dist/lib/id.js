"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newId = newId;
function newId(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
