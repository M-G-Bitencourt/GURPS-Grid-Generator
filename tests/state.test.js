import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AppState = require("../js/state.js");

const TOKEN = () => ({ name: "A", color: "#000000", shape: AppState.SHAPES["1x1"], facing: 0 });

describe("token placement", () => {
    beforeEach(() => {
        AppState.reset();
    });

    it("detects overlaps on a single hex", () => {
        AppState.state.entities["0,0"] = TOKEN();
        expect(AppState.canPlaceToken(AppState.SHAPES["1x1"], 0, 0, 0)).toBe(false);
        expect(AppState.canPlaceToken(AppState.SHAPES["1x1"], 0, 5, 5)).toBe(true);
        expect(AppState.canPlaceToken(AppState.SHAPES["1x1"], 0, 0, 0, "0,0")).toBe(true);
    });

    it("validates every hex of a multi-hex shape", () => {
        AppState.state.entities["0,0"] = TOKEN();
        // "1x2" with pivot (0,1) occupies (0,1) and (0,0): collision on the far hex.
        expect(AppState.canPlaceToken(AppState.SHAPES["1x2"], 0, 0, 1)).toBe(false);
        expect(AppState.canPlaceToken(AppState.SHAPES["1x2"], 0, 0, -1)).toBe(true);
    });

    it("accounts for facing when validating", () => {
        AppState.state.entities["0,0"] = TOKEN();
        // "1x2" rotated by 1 step occupies the pivot and pivot + (1,-1).
        expect(AppState.canPlaceToken(AppState.SHAPES["1x2"], 1, -1, 1)).toBe(false);
        expect(AppState.canPlaceToken(AppState.SHAPES["1x2"], 1, 0, 1)).toBe(true);
    });

    it("finds the most recently added token on overlap", () => {
        AppState.state.entities["0,0"] = TOKEN();
        AppState.state.entities["1,0"] = {
            name: "B",
            color: "#ffffff",
            shape: [
                { q: 0, r: 0 },
                { q: -1, r: 0 },
            ],
            facing: 0,
        };
        expect(AppState.findTokenAt(0, 0)).toBe("1,0");
        expect(AppState.findTokenAt(1, 0)).toBe("1,0");
        expect(AppState.findTokenAt(2, 0)).toBeNull();
    });
});

describe("history", () => {
    beforeEach(() => {
        AppState.reset();
    });

    it("undoes and redoes content changes", () => {
        AppState.pushHistory();
        AppState.state.entities["0,0"] = TOKEN();

        expect(AppState.undo()).toBe(true);
        expect(Object.keys(AppState.state.entities)).toHaveLength(0);
        expect(AppState.redo()).toBe(true);
        expect(Object.keys(AppState.state.entities)).toHaveLength(1);
    });

    it("keeps undo and redo independent", () => {
        AppState.pushHistory();
        AppState.state.walls.add("0,0|1,-1");

        expect(AppState.canUndo()).toBe(true);
        expect(AppState.canRedo()).toBe(false);

        AppState.undo();
        expect(AppState.canUndo()).toBe(false);
        expect(AppState.canRedo()).toBe(true);
    });

    it("caps the history size", () => {
        for (let i = 0; i < 60; i++) AppState.pushHistory();

        let undos = 0;
        while (AppState.undo()) undos++;
        expect(undos).toBe(50);
    });

    it("marks the map dirty on changes and clean on demand", () => {
        expect(AppState.state.dirty).toBe(false);
        AppState.pushHistory();
        expect(AppState.state.dirty).toBe(true);
        AppState.markClean();
        expect(AppState.state.dirty).toBe(false);
    });

    it("notifies the change listener", () => {
        let calls = 0;
        AppState.setChangeListener(() => calls++);
        AppState.pushHistory();
        AppState.undo();
        AppState.setChangeListener(null);
        expect(calls).toBe(2);
    });

    it("drops the selection when the token disappears after undo", () => {
        AppState.pushHistory();
        AppState.state.entities["0,0"] = TOKEN();
        AppState.state.selectedToken = "0,0";
        AppState.undo();
        expect(AppState.state.selectedToken).toBeNull();
    });
});

describe("loadData / reset", () => {
    beforeEach(() => {
        AppState.reset();
    });

    it("replaces content and clears history", () => {
        AppState.pushHistory();
        AppState.loadData({
            mapName: "loaded",
            camera: { x: 1, y: 2 },
            entities: { "3,3": TOKEN() },
            walls: ["0,0|1,-1"],
            hexColors: { "0,0": "#aabbcc" },
        });

        expect(Object.keys(AppState.state.entities)).toEqual(["3,3"]);
        expect(AppState.state.walls.has("0,0|1,-1")).toBe(true);
        expect(AppState.state.hexColors["0,0"]).toBe("#aabbcc");
        expect(AppState.state.camera).toEqual({ x: 1, y: 2 });
        expect(AppState.state.mapName).toBe("loaded");
        expect(AppState.canUndo()).toBe(false);
        expect(AppState.state.dirty).toBe(false);
    });
});
