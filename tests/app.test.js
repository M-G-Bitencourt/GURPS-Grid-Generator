/**
 * Integration smoke test: boots the real app in jsdom (canvas stubbed) and
 * exercises the full wiring of main.js, render.js, state.js and io.js —
 * token creation/movement/rotation/deletion, overlap prevention, undo/redo,
 * terrain, walls, i18n, autosave and zoom clamping.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(__dirname, "..");
const SCRIPTS = ["hex.js", "i18n.js", "schema.js", "state.js", "render.js", "io.js", "main.js"];

let window;
let canvas;
let AppState;
let I18n;
let Renderer;

function fire(type, options) {
    canvas.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, ...options }));
}

function clientForHex(q, r) {
    const { width, height } = Renderer.getCanvasSize();
    const { x, y } = window.HexMath.hexToPixel(q, r);
    const state = AppState.state;
    return {
        clientX: x * state.zoom + state.camera.x + width / 2,
        clientY: y * state.zoom + state.camera.y + height / 2,
    };
}

function createCanvasStub() {
    return new Proxy(
        {},
        {
            get(target, prop) {
                if (prop in target) return target[prop];
                return () => {};
            },
            set(target, prop, value) {
                target[prop] = value;
                return true;
            },
        }
    );
}

beforeAll(() => {
    const html = fs.readFileSync(path.join(APP_ROOT, "index.html"), "utf8");

    const dom = new JSDOM(html, {
        url: "https://localhost/",
        runScripts: "outside-only",
        pretendToBeVisual: true,
        beforeParse(jsdomWindow) {
            const ctxStub = createCanvasStub();
            jsdomWindow.HTMLCanvasElement.prototype.getContext = () => ctxStub;
            jsdomWindow.Element.prototype.setPointerCapture = () => {};
            jsdomWindow.Element.prototype.releasePointerCapture = () => {};
            jsdomWindow.alert = () => {};
            jsdomWindow.confirm = () => true;
        },
    });

    window = dom.window;
    window.URL.createObjectURL = () => "blob:mock";
    window.URL.revokeObjectURL = () => {};

    for (const file of SCRIPTS) {
        window.eval(fs.readFileSync(path.join(APP_ROOT, "js", file), "utf8"));
    }

    AppState = window.AppState;
    I18n = window.I18n;
    Renderer = window.Renderer;
    canvas = window.document.getElementById("hexCanvas");
});

describe("boot", () => {
    it("initializes the app and applies translations", () => {
        expect(window.document.querySelector("[data-i18n]").textContent.length).toBeGreaterThan(0);
        expect(["pt-BR", "en"]).toContain(I18n.getLanguage());
    });
});

describe("tokens", () => {
    it("creates, selects and marks the map dirty on click", () => {
        fire("pointerdown", { button: 0, ...clientForHex(0, 0) });
        fire("pointerup", { button: 0, ...clientForHex(0, 0) });

        expect(AppState.state.entities["0,0"]).toBeTruthy();
        expect(AppState.state.selectedToken).toBe("0,0");
        expect(AppState.canUndo()).toBe(true);
        expect(AppState.state.dirty).toBe(true);
    });

    it("does not rotate tokens while typing in an input", () => {
        const nameInput = window.document.getElementById("tokenName");
        nameInput.dispatchEvent(new window.KeyboardEvent("keydown", { key: "r", bubbles: true }));
        expect(AppState.state.entities["0,0"].facing).toBe(0);
    });

    it("rotates the selected token with R", () => {
        window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "r", bubbles: true }));
        expect(AppState.state.entities["0,0"].facing).toBe(1);
    });

    it("refuses to create a token on an occupied hex", () => {
        fire("pointerdown", { button: 0, ...clientForHex(0, 0) });
        fire("pointerup", { button: 0, ...clientForHex(0, 0) });
        expect(Object.keys(AppState.state.entities)).toHaveLength(1);
    });

    it("moves a token by dragging", () => {
        fire("pointerdown", { button: 0, ...clientForHex(0, 0) });
        fire("pointermove", { button: 0, ...clientForHex(2, 0) });
        fire("pointerup", { button: 0, ...clientForHex(2, 0) });

        expect(AppState.state.entities["2,0"]).toBeTruthy();
        expect(AppState.state.entities["0,0"]).toBeUndefined();
    });
});

describe("history", () => {
    it("undoes and redoes the last move", () => {
        window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
        expect(AppState.state.entities["0,0"]).toBeTruthy();
        expect(AppState.state.entities["2,0"]).toBeUndefined();

        window.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })
        );
        expect(AppState.state.entities["2,0"]).toBeTruthy();
    });

    it("keeps the selection across undo/redo", () => {
        expect(AppState.state.selectedToken).toBe("2,0");
    });

    it("removes the selected token with Delete", () => {
        window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
        expect(Object.keys(AppState.state.entities)).toHaveLength(0);
    });
});

describe("terrain and walls", () => {
    it("paints terrain", () => {
        window.document.getElementById("modeTerrain").checked = true;
        fire("pointerdown", { button: 0, ...clientForHex(-2, 1) });
        fire("pointerup", { button: 0, ...clientForHex(-2, 1) });
        expect(AppState.state.hexColors["-2,1"]).toBe("#a3d9a5");
    });

    it("adds a wall", () => {
        window.document.getElementById("modeWalls").checked = true;
        fire("pointerdown", { button: 0, ...clientForHex(0, 0) });
        fire("pointerup", { button: 0, ...clientForHex(0, 0) });
        expect(AppState.state.walls.size).toBe(1);
    });
});

describe("i18n", () => {
    it("switches language and translates the document", () => {
        window.document.getElementById("modeTokens").checked = true;
        const languageSelect = window.document.getElementById("language");
        languageSelect.value = "en";
        languageSelect.dispatchEvent(new window.Event("change", { bubbles: true }));

        expect(I18n.getLanguage()).toBe("en");
        expect(window.document.querySelector('[data-i18n="helpTokens"]').textContent).toMatch(
            /^Tokens: Click/
        );
    });
});

describe("persistence", () => {
    it("produces schema-compatible save data", () => {
        const exported = window.MapSchema.buildSaveData(AppState.state);
        const reloaded = window.MapSchema.parseMapData(JSON.parse(JSON.stringify(exported)));
        expect(reloaded.walls).toHaveLength(1);
        expect(reloaded.hexColors["-2,1"]).toBe("#a3d9a5");
    });

    it("writes the autosave after the debounce", async () => {
        await new Promise((resolve) => setTimeout(resolve, 700));
        expect(window.localStorage.getItem("gurps-grid-autosave")).toBeTruthy();
    });
});

describe("zoom", () => {
    it("clamps zoom to the configured bounds", () => {
        const wheel = new window.WheelEvent("wheel", {
            deltaY: -100,
            clientX: 100,
            clientY: 100,
            bubbles: true,
            cancelable: true,
        });
        for (let i = 0; i < 40; i++) canvas.dispatchEvent(wheel);
        expect(AppState.state.zoom).toBeLessThanOrEqual(2.5);
        expect(AppState.state.zoom).toBeGreaterThan(1);
    });
});
