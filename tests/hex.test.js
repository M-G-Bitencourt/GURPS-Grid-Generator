import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const HexMath = require("../js/hex.js");

const {
    SIZE,
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
} = HexMath;

describe("coordKey / parseCoordKey", () => {
    it("round-trips coordinates", () => {
        expect(parseCoordKey(coordKey(-3, 7))).toEqual({ q: -3, r: 7 });
        expect(parseCoordKey(coordKey(0, 0))).toEqual({ q: 0, r: 0 });
    });
});

describe("axialRound", () => {
    it("keeps exact integer coordinates", () => {
        expect(axialRound(2, -3)).toEqual({ q: 2, r: -3 });
    });

    it("returns integers for fractional input", () => {
        const rounded = axialRound(0.4, -0.7);
        expect(Number.isInteger(rounded.q)).toBe(true);
        expect(Number.isInteger(rounded.r)).toBe(true);
    });
});

describe("hexToPixel / pixelToHex", () => {
    it("round-trips every hex center", () => {
        for (let q = -6; q <= 6; q++) {
            for (let r = -6; r <= 6; r++) {
                const pos = hexToPixel(q, r);
                expect(pixelToHex(pos.x, pos.y)).toEqual({ q, r });
            }
        }
    });

    it("returns the origin pixel for hex (0,0)", () => {
        expect(hexToPixel(0, 0)).toEqual({ x: 0, y: 0 });
    });
});

describe("rotateHex", () => {
    it("rotates one step", () => {
        expect(rotateHex(1, 0, 1)).toEqual({ q: 0, r: 1 });
    });

    it("returns to the start after six steps", () => {
        for (let q = -3; q <= 3; q++) {
            for (let r = -3; r <= 3; r++) {
                expect(rotateHex(q, r, 6)).toEqual({ q, r });
            }
        }
    });

    it("supports negative steps", () => {
        expect(rotateHex(0, 1, -1)).toEqual({ q: 1, r: 0 });
    });
});

describe("edges", () => {
    it("builds a canonical id regardless of argument order", () => {
        expect(canonicalEdge(0, 0, 1, -1)).toBe(canonicalEdge(1, -1, 0, 0));
    });

    it("parses edge ids back into coordinates", () => {
        expect(parseEdgeId("-1,0|0,0")).toEqual({ a: { q: -1, r: 0 }, b: { q: 0, r: 0 } });
    });

    it("returns the shared edge towards each neighbor", () => {
        for (const [dq, dr] of DIRS) {
            const neighborCenter = hexToPixel(dq, dr);
            const edgeId = getClosestEdge(0, 0, neighborCenter.x, neighborCenter.y);
            expect(edgeId).toBe(canonicalEdge(0, 0, dq, dr));
        }
    });

    it("is symmetric: both hexes see the same edge", () => {
        const origin = hexToPixel(0, 0);
        const neighbor = hexToPixel(1, 0);
        const midpoint = { x: (origin.x + neighbor.x) / 2, y: (origin.y + neighbor.y) / 2 };

        const fromOrigin = getClosestEdge(0, 0, midpoint.x, midpoint.y);
        const fromNeighbor = getClosestEdge(1, 0, midpoint.x, midpoint.y);
        expect(fromOrigin).toBe(fromNeighbor);
    });
});

describe("hexDistance", () => {
    it("measures hex steps", () => {
        expect(hexDistance(0, 0, 0, 0)).toBe(0);
        expect(hexDistance(0, 0, 1, 0)).toBe(1);
        expect(hexDistance(0, 0, 2, -1)).toBe(2);
    });
});

describe("constants", () => {
    it("exposes the hex size used by the app", () => {
        expect(SIZE).toBe(40);
        expect(DIRS).toHaveLength(6);
    });
});
