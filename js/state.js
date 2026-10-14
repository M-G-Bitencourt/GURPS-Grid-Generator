/**
 * Application state and history (undo/redo) management.
 * Loaded as a classic script in the browser (`window.AppState`) and unit
 * tested in Node via the CommonJS export below.
 */
(function (root, factory) {
    "use strict";
    if (typeof module === "object" && module.exports) {
        module.exports = factory(require("./hex.js"));
    } else {
        root.AppState = factory(root.HexMath);
    }
})(typeof self !== "undefined" ? self : globalThis, function (HexMath) {
    "use strict";

    const MAX_HISTORY = 50;

    /** Multi-hex token templates, in axial offsets from the pivot hex. */
    const SHAPES = {
        "1x1": [{ q: 0, r: 0 }],
        "1x2": [
            { q: 0, r: 0 },
            { q: 0, r: -1 },
        ],
        "1x3": [
            { q: 0, r: 0 },
            { q: 0, r: -1 },
            { q: 0, r: -2 },
        ],
        "1x4": [
            { q: 0, r: 0 },
            { q: 0, r: -1 },
            { q: 0, r: -2 },
            { q: 0, r: -3 },
        ],
        triangulo: [
            { q: 0, r: 0 },
            { q: 1, r: -1 },
            { q: 0, r: -1 },
        ],
        "2x2": [
            { q: 0, r: 0 },
            { q: 1, r: -1 },
            { q: 0, r: -1 },
            { q: 1, r: 0 },
        ],
        "2x3": [
            { q: 0, r: 0 },
            { q: 1, r: -1 },
            { q: 0, r: -1 },
            { q: 1, r: 0 },
            { q: 0, r: -2 },
            { q: 1, r: -2 },
        ],
        gigante: [
            { q: 0, r: 0 },
            { q: 1, r: -1 },
            { q: 0, r: -1 },
            { q: -1, r: 0 },
            { q: -1, r: 1 },
            { q: 0, r: 1 },
            { q: 1, r: 0 },
        ],
        colossal: [
            { q: 0, r: 0 },
            { q: 1, r: -1 },
            { q: 0, r: -1 },
            { q: -1, r: 0 },
            { q: -1, r: 1 },
            { q: 0, r: 1 },
            { q: 1, r: 0 },
            { q: 0, r: -2 },
            { q: 1, r: -2 },
            { q: 2, r: -2 },
            { q: 2, r: -1 },
            { q: 2, r: 0 },
            { q: 1, r: 1 },
            { q: 0, r: 2 },
            { q: -1, r: 2 },
            { q: -2, r: 2 },
            { q: -2, r: 1 },
            { q: -2, r: 0 },
            { q: -1, r: -1 },
        ],
    };

    const state = {
        camera: { x: 0, y: 0 },
        zoom: 1,
        entities: Object.create(null),
        walls: new Set(),
        hexColors: Object.create(null),
        selectedToken: null,
        showCoords: false,
        mapName: "mapa_tatico",
        dirty: false,
    };

    const undoStack = [];
    const redoStack = [];
    let changeListener = null;

    function cloneEntities(entities) {
        return JSON.parse(JSON.stringify(entities));
    }

    function notify() {
        if (changeListener) changeListener(state);
    }

    /** Registers a callback fired after every content change. */
    function setChangeListener(listener) {
        changeListener = listener;
    }

    function snapshot() {
        return {
            entities: cloneEntities(state.entities),
            walls: Array.from(state.walls),
            hexColors: { ...state.hexColors },
            selectedToken: state.selectedToken,
        };
    }

    function restoreSnapshot(snap) {
        state.entities = cloneEntities(snap.entities);
        state.walls = new Set(snap.walls);
        state.hexColors = { ...snap.hexColors };
        state.selectedToken =
            snap.selectedToken && state.entities[snap.selectedToken] ? snap.selectedToken : null;
    }

    function markDirty() {
        state.dirty = true;
    }

    function markClean() {
        state.dirty = false;
    }

    /**
     * Takes a snapshot of the current map content. Call this right before
     * mutating entities, walls or terrain colors.
     */
    function pushHistory() {
        undoStack.push(snapshot());
        if (undoStack.length > MAX_HISTORY) undoStack.shift();
        redoStack.length = 0;
        state.dirty = true;
        notify();
    }

    function undo() {
        if (undoStack.length === 0) return false;
        redoStack.push(snapshot());
        restoreSnapshot(undoStack.pop());
        state.dirty = true;
        notify();
        return true;
    }

    function redo() {
        if (redoStack.length === 0) return false;
        undoStack.push(snapshot());
        restoreSnapshot(redoStack.pop());
        state.dirty = true;
        notify();
        return true;
    }

    function canUndo() {
        return undoStack.length > 0;
    }

    function canRedo() {
        return redoStack.length > 0;
    }

    /** Clears the map and the history, returning to a fresh document. */
    function reset() {
        state.entities = Object.create(null);
        state.walls = new Set();
        state.hexColors = Object.create(null);
        state.camera = { x: 0, y: 0 };
        state.zoom = 1;
        state.selectedToken = null;
        state.mapName = "mapa_tatico";
        undoStack.length = 0;
        redoStack.length = 0;
        state.dirty = false;
        notify();
    }

    /** Replaces the current map with previously parsed (sanitized) data. */
    function loadData(data) {
        state.entities = cloneEntities(data.entities || {});
        state.walls = new Set(data.walls || []);
        state.hexColors = { ...(data.hexColors || {}) };
        if (data.camera && Number.isFinite(data.camera.x) && Number.isFinite(data.camera.y)) {
            state.camera = { x: data.camera.x, y: data.camera.y };
        }
        if (typeof data.mapName === "string" && data.mapName.trim()) {
            state.mapName = data.mapName.trim();
        }
        state.zoom = 1;
        state.selectedToken = null;
        undoStack.length = 0;
        redoStack.length = 0;
        state.dirty = false;
        notify();
    }

    /** Returns every hex coordinate occupied by a token pivot and shape. */
    function occupiedHexes(shape, facing, pivotQ, pivotR) {
        const cells = [];
        for (const offset of shape) {
            const rotated = HexMath.rotateHex(offset.q, offset.r, facing);
            cells.push(HexMath.coordKey(pivotQ + rotated.q, pivotR + rotated.r));
        }
        return cells;
    }

    /**
     * Finds the token occupying a hex. Searches from the most recently added
     * token backwards, so the topmost token wins on overlaps.
     */
    function findTokenAt(q, r) {
        const keys = Object.keys(state.entities);
        for (let i = keys.length - 1; i >= 0; i--) {
            const key = keys[i];
            const entity = state.entities[key];
            const pivot = HexMath.parseCoordKey(key);
            for (const cell of occupiedHexes(entity.shape, entity.facing, pivot.q, pivot.r)) {
                if (cell === HexMath.coordKey(q, r)) return key;
            }
        }
        return null;
    }

    /**
     * Checks whether a token can occupy the given hexes without overlapping
     * another token. `ignoreKey` excludes the token being moved/rotated.
     */
    function canPlaceToken(shape, facing, q, r, ignoreKey = null) {
        const occupied = new Set(occupiedHexes(shape, facing, q, r));
        const keys = Object.keys(state.entities);
        for (const key of keys) {
            if (key === ignoreKey) continue;
            const entity = state.entities[key];
            const pivot = HexMath.parseCoordKey(key);
            for (const cell of occupiedHexes(entity.shape, entity.facing, pivot.q, pivot.r)) {
                if (occupied.has(cell)) return false;
            }
        }
        return true;
    }

    return {
        SHAPES,
        state,
        setChangeListener,
        pushHistory,
        undo,
        redo,
        canUndo,
        canRedo,
        reset,
        loadData,
        markDirty,
        markClean,
        findTokenAt,
        canPlaceToken,
        occupiedHexes,
    };
});
