import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const MapSchema = require("../js/schema.js");

describe("parseMapData", () => {
    it("rejects non-object roots", () => {
        expect(() => MapSchema.parseMapData(null)).toThrow();
        expect(() => MapSchema.parseMapData([1, 2])).toThrow();
        expect(() => MapSchema.parseMapData("map")).toThrow();
        expect(() => MapSchema.parseMapData(42)).toThrow();
    });

    it("fills defaults for an empty object", () => {
        const map = MapSchema.parseMapData({});
        expect(map.version).toBe(MapSchema.SAVE_VERSION);
        expect(map.camera).toEqual({ x: 0, y: 0 });
        expect(Object.keys(map.entities)).toHaveLength(0);
        expect(map.walls).toEqual([]);
        expect(Object.keys(map.hexColors)).toHaveLength(0);
    });

    it("repairs camera values", () => {
        expect(MapSchema.parseMapData({ camera: { x: 12.5, y: -3 } }).camera).toEqual({ x: 12.5, y: -3 });
        expect(MapSchema.parseMapData({ camera: { x: "nope", y: Infinity } }).camera).toEqual({ x: 0, y: 0 });
    });

    it("drops malformed entities and repairs fields", () => {
        const map = MapSchema.parseMapData({
            entities: {
                "0,0": { name: "A", color: "#123456", shape: [{ q: 0, r: 0 }], facing: 3 },
                "1,0": { color: "not-a-color", shape: [{ q: 0, r: 0 }], facing: 9 },
                "2,0": { name: "Missing shape" },
                "bad-key": { shape: [{ q: 0, r: 0 }] },
                __proto__: { name: "Hack", shape: [{ q: 0, r: 0 }] },
            },
        });

        expect(Object.keys(map.entities).sort()).toEqual(["0,0", "1,0"]);
        expect(map.entities["0,0"].facing).toBe(3);
        expect(map.entities["1,0"].color).toBe("#3399ff");
        expect(map.entities["1,0"].facing).toBe(3);
        expect(map.entities["1,0"].name).toBe("Token");
    });

    it("rejects entities with invalid shapes", () => {
        const map = MapSchema.parseMapData({
            entities: {
                "0,0": { shape: [] },
                "1,0": { shape: "1x1" },
                "2,0": { shape: [{ q: 0.5, r: 0 }] },
                "3,0": { shape: [{ q: 99, r: 0 }] },
            },
        });
        expect(Object.keys(map.entities)).toHaveLength(0);
    });

    it("never pollutes prototypes", () => {
        const raw = JSON.parse(
            '{"entities":{"__proto__":{"shape":[{"q":0,"r":0}]}},"hexColors":{"__proto__":"#ffffff"}}'
        );
        const map = MapSchema.parseMapData(raw);
        expect(Object.getPrototypeOf(map.entities)).toBeNull();
        expect(Object.getPrototypeOf(map.hexColors)).toBeNull();
        expect({}.shape).toBeUndefined();
        expect({}.name).toBeUndefined();
    });

    it("canonicalizes, dedupes and filters walls", () => {
        const map = MapSchema.parseMapData({
            walls: ["0,0|1,-1", "1,-1|0,0", "bogus", 42, null, "-1,0|0,0"],
        });
        expect(map.walls).toEqual(["0,0|1,-1", "-1,0|0,0"]);
    });

    it("filters invalid terrain colors", () => {
        const map = MapSchema.parseMapData({
            hexColors: { "0,0": "#a3d9a5", "1,0": "red", "2,0": "#GGGGGG", bad: "#ffffff" },
        });
        expect(map.hexColors).toEqual({ "0,0": "#a3d9a5" });
    });

    it("accepts legacy files without hexColors or version", () => {
        const map = MapSchema.parseMapData({
            camera: { x: -136, y: -204 },
            entities: {},
            walls: ["0,0|0,1"],
        });
        expect(map.version).toBe(1);
        expect(map.walls).toEqual(["0,0|0,1"]);
        expect(Object.keys(map.hexColors)).toHaveLength(0);
    });
});

describe("buildSaveData", () => {
    it("round-trips through parseMapData", () => {
        const state = {
            mapName: "test map",
            camera: { x: 10, y: -5 },
            entities: { "0,0": { name: "A", color: "#123456", shape: [{ q: 0, r: 0 }], facing: 2 } },
            walls: new Set(["0,0|1,-1"]),
            hexColors: { "0,0": "#aabbcc" },
        };

        const parsed = MapSchema.parseMapData(JSON.parse(JSON.stringify(MapSchema.buildSaveData(state))));

        expect(parsed.version).toBe(MapSchema.SAVE_VERSION);
        expect(parsed.mapName).toBe("test map");
        expect(parsed.camera).toEqual({ x: 10, y: -5 });
        expect(parsed.entities).toEqual(state.entities);
        expect(parsed.walls).toEqual(["0,0|1,-1"]);
        expect(parsed.hexColors).toEqual({ "0,0": "#aabbcc" });
    });
});
