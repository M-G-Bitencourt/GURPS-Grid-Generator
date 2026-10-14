/**
 * Map save-file schema: validation and sanitization for load/save.
 * The parser never trusts the input file: unknown or malformed data is
 * dropped, unsafe keys are rejected and defaults are applied.
 * Pure logic, unit tested in Node via the CommonJS export below.
 */
(function (root, factory) {
    "use strict";
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.MapSchema = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
    "use strict";

    const SAVE_VERSION = 1;
    const DEFAULT_MAP_NAME = "mapa_tatico";
    const DEFAULT_TOKEN_COLOR = "#3399ff";
    const DEFAULT_TOKEN_NAME = "Token";
    const MAX_TOKEN_NAME_LENGTH = 60;
    const MAX_SHAPE_HEXES = 37;
    const MAX_SHAPE_OFFSET = 4;

    const COORD_KEY_RE = /^-?\d+,-?\d+$/;
    const EDGE_ID_RE = /^-?\d+,-?\d+\|-?\d+,-?\d+$/;
    const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
    const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

    function isPlainObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    function isFiniteNumber(value) {
        return typeof value === "number" && Number.isFinite(value);
    }

    function sanitizeShape(rawShape) {
        if (!Array.isArray(rawShape) || rawShape.length === 0 || rawShape.length > MAX_SHAPE_HEXES) {
            return null;
        }
        const shape = [];
        for (const offset of rawShape) {
            if (!isPlainObject(offset)) return null;
            if (!Number.isInteger(offset.q) || !Number.isInteger(offset.r)) return null;
            if (Math.abs(offset.q) > MAX_SHAPE_OFFSET || Math.abs(offset.r) > MAX_SHAPE_OFFSET) return null;
            shape.push({ q: offset.q, r: offset.r });
        }
        return shape;
    }

    function sanitizeEntity(rawEntity) {
        if (!isPlainObject(rawEntity)) return null;
        const shape = sanitizeShape(rawEntity.shape);
        if (!shape) return null;

        const name =
            typeof rawEntity.name === "string" && rawEntity.name.trim()
                ? rawEntity.name.trim().slice(0, MAX_TOKEN_NAME_LENGTH)
                : DEFAULT_TOKEN_NAME;
        const color =
            typeof rawEntity.color === "string" && HEX_COLOR_RE.test(rawEntity.color)
                ? rawEntity.color
                : DEFAULT_TOKEN_COLOR;
        const facing = Number.isInteger(rawEntity.facing) ? ((rawEntity.facing % 6) + 6) % 6 : 0;

        return { name, color, shape, facing };
    }

    function sanitizeCamera(rawCamera) {
        const camera = { x: 0, y: 0 };
        if (isPlainObject(rawCamera)) {
            if (isFiniteNumber(rawCamera.x)) camera.x = rawCamera.x;
            if (isFiniteNumber(rawCamera.y)) camera.y = rawCamera.y;
        }
        return camera;
    }

    function sanitizeWalls(rawWalls) {
        const walls = [];
        if (!Array.isArray(rawWalls)) return walls;
        const seen = new Set();
        for (const rawEdge of rawWalls) {
            if (typeof rawEdge !== "string" || !EDGE_ID_RE.test(rawEdge)) continue;
            const [a, b] = rawEdge.split("|");
            const canonical = a < b ? `${a}|${b}` : `${b}|${a}`;
            if (seen.has(canonical)) continue;
            seen.add(canonical);
            walls.push(canonical);
        }
        return walls;
    }

    function sanitizeHexColors(rawHexColors) {
        const hexColors = Object.create(null);
        if (!isPlainObject(rawHexColors)) return hexColors;
        for (const [key, value] of Object.entries(rawHexColors)) {
            if (FORBIDDEN_KEYS.has(key) || !COORD_KEY_RE.test(key)) continue;
            if (typeof value !== "string" || !HEX_COLOR_RE.test(value)) continue;
            hexColors[key] = value;
        }
        return hexColors;
    }

    function sanitizeEntities(rawEntities) {
        const entities = Object.create(null);
        if (!isPlainObject(rawEntities)) return entities;
        for (const [key, value] of Object.entries(rawEntities)) {
            if (FORBIDDEN_KEYS.has(key) || !COORD_KEY_RE.test(key)) continue;
            const entity = sanitizeEntity(value);
            if (entity) entities[key] = entity;
        }
        return entities;
    }

    /** Builds an empty map in the canonical save format. */
    function createEmptyMap() {
        return {
            version: SAVE_VERSION,
            mapName: DEFAULT_MAP_NAME,
            camera: { x: 0, y: 0 },
            entities: Object.create(null),
            walls: [],
            hexColors: Object.create(null),
        };
    }

    /**
     * Validates and normalizes raw JSON data into the canonical map format.
     * Throws when the root value is not an object; everything else is
     * repaired or dropped.
     */
    function parseMapData(raw) {
        if (!isPlainObject(raw)) throw new Error("invalid-map-root");

        const map = createEmptyMap();
        map.version = Number.isInteger(raw.version) ? raw.version : SAVE_VERSION;
        if (typeof raw.mapName === "string" && raw.mapName.trim()) {
            map.mapName = raw.mapName.trim();
        }
        map.camera = sanitizeCamera(raw.camera);
        map.entities = sanitizeEntities(raw.entities);
        map.walls = sanitizeWalls(raw.walls);
        map.hexColors = sanitizeHexColors(raw.hexColors);
        return map;
    }

    /** Serializes the application state into the canonical save format. */
    function buildSaveData(state) {
        return {
            version: SAVE_VERSION,
            mapName:
                typeof state.mapName === "string" && state.mapName.trim()
                    ? state.mapName.trim()
                    : DEFAULT_MAP_NAME,
            camera: { x: state.camera.x, y: state.camera.y },
            entities: state.entities,
            walls: Array.from(state.walls),
            hexColors: state.hexColors,
        };
    }

    return { SAVE_VERSION, parseMapData, buildSaveData, createEmptyMap };
});
