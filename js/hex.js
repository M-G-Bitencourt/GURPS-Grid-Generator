/**
 * Hex grid math for flat-top hexes with axial coordinates (q, r).
 * Pure functions only, unit tested in Node via the CommonJS export below.
 * In the browser this file is loaded as a classic script and exposes
 * `window.HexMath` for the other scripts.
 */
(function (root, factory) {
    "use strict";
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.HexMath = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
    "use strict";

    /** Distance from the center to a hex corner, in pixels. */
    const SIZE = 40;
    /** Vertical distance between hex centers, in pixels. */
    const HEX_HEIGHT = Math.sqrt(3) * SIZE;
    /** Axial neighbor directions, ordered clockwise starting at 0 degrees. */
    const DIRS = [
        [1, 0],
        [0, 1],
        [-1, 1],
        [-1, 0],
        [0, -1],
        [1, -1],
    ];

    /** Stable string key for a hex coordinate. */
    function coordKey(q, r) {
        return `${q},${r}`;
    }

    /** Parses a "q,r" key back into numeric coordinates. */
    function parseCoordKey(key) {
        const parts = key.split(",");
        return { q: Number(parts[0]), r: Number(parts[1]) };
    }

    /** Converts axial hex coordinates to pixel coordinates (hex center). */
    function hexToPixel(q, r, size = SIZE) {
        const x = size * ((3 / 2) * q);
        const y = size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r);
        return { x, y };
    }

    /** Converts pixel coordinates to the nearest axial hex coordinate. */
    function pixelToHex(x, y, size = SIZE) {
        const q = ((2 / 3) * x) / size;
        const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / size;
        return axialRound(q, r);
    }

    /** Rounds fractional cube coordinates to the nearest valid hex. */
    function axialRound(fracQ, fracR) {
        const fracS = -fracQ - fracR;
        let q = Math.round(fracQ);
        let r = Math.round(fracR);
        const s = Math.round(fracS);

        const qDiff = Math.abs(q - fracQ);
        const rDiff = Math.abs(r - fracR);
        const sDiff = Math.abs(s - fracS);

        if (qDiff > rDiff && qDiff > sDiff) q = -r - s;
        else if (rDiff > sDiff) r = -q - s;
        return { q: normalizeZero(q), r: normalizeZero(r) };
    }

    /** Avoids -0 coordinates, which compare badly and serialize inconsistently. */
    function normalizeZero(value) {
        return value === 0 ? 0 : value;
    }

    /** Rotates a hex offset around the origin in 60 degree steps. */
    function rotateHex(q, r, steps) {
        let nq = q;
        let nr = r;
        const turns = ((steps % 6) + 6) % 6;
        for (let i = 0; i < turns; i++) {
            const tempQ = nq;
            nq = -nr;
            nr = tempQ + nr;
        }
        return { q: normalizeZero(nq), r: normalizeZero(nr) };
    }

    /**
     * Returns the canonical id of the edge shared between hex (q, r) and the
     * neighbor closest to the given point. Edge ids have the shape
     * "q1,r1|q2,r2" with the two hex keys sorted, so the same edge always
     * produces the same id.
     */
    function getClosestEdge(q, r, pointX, pointY, size = SIZE) {
        const center = hexToPixel(q, r, size);
        let angle = (Math.atan2(pointY - center.y, pointX - center.x) * 180) / Math.PI;
        if (angle < 0) angle += 360;

        const dirIndex = Math.floor(angle / 60) % 6;
        const nQ = q + DIRS[dirIndex][0];
        const nR = r + DIRS[dirIndex][1];
        return canonicalEdge(q, r, nQ, nR);
    }

    /** Builds a canonical edge id from two adjacent hex coordinates. */
    function canonicalEdge(q1, r1, q2, r2) {
        const a = coordKey(q1, r1);
        const b = coordKey(q2, r2);
        return a < b ? `${a}|${b}` : `${b}|${a}`;
    }

    /** Parses an edge id into its two hex coordinates. */
    function parseEdgeId(edgeId) {
        const parts = edgeId.split("|");
        return { a: parseCoordKey(parts[0]), b: parseCoordKey(parts[1]) };
    }

    /** Number of hex steps between two coordinates. */
    function hexDistance(q1, r1, q2, r2) {
        return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2;
    }

    return {
        SIZE,
        HEX_HEIGHT,
        DIRS,
        coordKey,
        parseCoordKey,
        hexToPixel,
        pixelToHex,
        axialRound,
        rotateHex,
        getClosestEdge,
        canonicalEdge,
        parseEdgeId,
        hexDistance,
    };
});
