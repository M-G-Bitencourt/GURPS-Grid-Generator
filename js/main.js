/**
 * Application entry point: UI wiring, pointer/keyboard interaction and
 * gesture handling. Browser only, loaded last.
 */
(function (root) {
    "use strict";

    const { coordKey, parseCoordKey, pixelToHex, getClosestEdge } = root.HexMath;
    const AppState = root.AppState;
    const Renderer = root.Renderer;
    const MapIO = root.MapIO;
    const I18n = root.I18n;

    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 2.5;
    const ZOOM_STEP = 1.1;
    /** Pointer travel (px) above which a click becomes a drag. */
    const CLICK_SLOP = 4;

    const ui = {
        canvas: document.getElementById("hexCanvas"),
        panel: document.getElementById("ui"),
        togglePanel: document.getElementById("btnTogglePanel"),
        language: document.getElementById("language"),
        terrainColor: document.getElementById("terrainColor"),
        tokenName: document.getElementById("tokenName"),
        tokenColor: document.getElementById("tokenColor"),
        tokenShape: document.getElementById("tokenShape"),
        mapName: document.getElementById("mapName"),
        showCoords: document.getElementById("showCoords"),
        btnSave: document.getElementById("btnSave"),
        btnLoad: document.getElementById("btnLoad"),
        btnNew: document.getElementById("btnNew"),
        btnUndo: document.getElementById("btnUndo"),
        btnRedo: document.getElementById("btnRedo"),
        btnCenter: document.getElementById("btnCenter"),
        fileInput: document.getElementById("fileInput"),
        status: document.getElementById("status"),
    };

    let isDraggingCanvas = false;
    let lastPointer = { x: 0, y: 0 };
    let pointerWorld = { x: 0, y: 0 };
    let pointerDownPos = { x: 0, y: 0 };
    let draggingToken = null;
    let dragActive = false;
    let isPaintingWalls = false;
    let wallPaintAction = "add";
    let lastEdgeId = null;
    let isPaintingTerrain = false;
    let terrainPaintAction = "add";
    let strokeHistoryPushed = false;
    let colorEditHistoryPushed = false;
    let statusTimer = null;

    function getMode() {
        return document.querySelector('input[name="mode"]:checked').value;
    }

    /** Converts a pointer event to world (unscaled, untranslated) coordinates. */
    function worldFromEvent(event) {
        const { width, height } = Renderer.getCanvasSize();
        const state = AppState.state;
        return {
            x: (event.clientX - width / 2 - state.camera.x) / state.zoom,
            y: (event.clientY - height / 2 - state.camera.y) / state.zoom,
        };
    }

    function isTypingTarget(target) {
        if (!target || !target.tagName) return false;
        const tag = target.tagName.toUpperCase();
        return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || target.isContentEditable;
    }

    function hasContent() {
        const state = AppState.state;
        return (
            Object.keys(state.entities).length > 0 ||
            state.walls.size > 0 ||
            Object.keys(state.hexColors).length > 0
        );
    }

    function showStatus(key) {
        ui.status.textContent = I18n.t(key);
        ui.status.classList.add("visible");
        if (statusTimer !== null) clearTimeout(statusTimer);
        statusTimer = setTimeout(() => {
            statusTimer = null;
            ui.status.classList.remove("visible");
        }, 2500);
    }

    function updateToolbar() {
        ui.btnUndo.disabled = !AppState.canUndo();
        ui.btnRedo.disabled = !AppState.canRedo();
    }

    function beginStroke() {
        strokeHistoryPushed = false;
    }

    /** Pushes a single history entry per painting stroke, right before the
     *  first actual mutation of that stroke. */
    function ensureStrokeHistory() {
        if (strokeHistoryPushed) return;
        AppState.pushHistory();
        strokeHistoryPushed = true;
    }

    function findShapeKey(shape) {
        for (const [key, candidate] of Object.entries(AppState.SHAPES)) {
            if (candidate.length !== shape.length) continue;
            const matches = candidate.every(
                (cell, index) => cell.q === shape[index].q && cell.r === shape[index].r
            );
            if (matches) return key;
        }
        return null;
    }

    function syncPanelFromToken(tokenKey) {
        const entity = tokenKey ? AppState.state.entities[tokenKey] : null;
        if (!entity) return;
        ui.tokenName.value = entity.name;
        ui.tokenColor.value = entity.color;
        const shapeKey = findShapeKey(entity.shape);
        if (shapeKey) ui.tokenShape.value = shapeKey;
    }

    function applyTerrain(hex, action) {
        const state = AppState.state;
        const key = coordKey(hex.q, hex.r);
        if (action === "add") {
            if (state.hexColors[key] === ui.terrainColor.value) return;
            ensureStrokeHistory();
            state.hexColors[key] = ui.terrainColor.value;
        } else {
            if (!(key in state.hexColors)) return;
            ensureStrokeHistory();
            delete state.hexColors[key];
        }
        Renderer.scheduleDraw();
    }

    function applyWall(edgeId, action) {
        const state = AppState.state;
        if (action === "add") {
            if (state.walls.has(edgeId)) return;
            ensureStrokeHistory();
            state.walls.add(edgeId);
        } else {
            if (!state.walls.has(edgeId)) return;
            ensureStrokeHistory();
            state.walls.delete(edgeId);
        }
        Renderer.scheduleDraw();
    }

    function createTokenAt(hex) {
        const shape = AppState.SHAPES[ui.tokenShape.value];
        if (!shape) return;
        if (!AppState.canPlaceToken(shape, 0, hex.q, hex.r)) {
            showStatus("statusOccupied");
            return;
        }

        AppState.pushHistory();
        const key = coordKey(hex.q, hex.r);
        const name = ui.tokenName.value.trim() || I18n.t("defaultTokenName");
        AppState.state.entities[key] = { name, color: ui.tokenColor.value, shape, facing: 0 };
        AppState.state.selectedToken = key;
        syncPanelFromToken(key);
        Renderer.scheduleDraw();
        updateToolbar();
    }

    function rotateToken(tokenKey) {
        const entity = AppState.state.entities[tokenKey];
        if (!entity) return;
        const pivot = parseCoordKey(tokenKey);
        const newFacing = (entity.facing + 1) % 6;
        if (!AppState.canPlaceToken(entity.shape, newFacing, pivot.q, pivot.r, tokenKey)) {
            showStatus("statusOccupied");
            return;
        }
        AppState.pushHistory();
        entity.facing = newFacing;
        Renderer.scheduleDraw();
    }

    function rotateUnderCursor() {
        const state = AppState.state;
        if (draggingToken) {
            rotateToken(draggingToken);
            return;
        }
        if (state.selectedToken && state.entities[state.selectedToken]) {
            rotateToken(state.selectedToken);
            return;
        }
        const hex = pixelToHex(pointerWorld.x, pointerWorld.y);
        const tokenKey = AppState.findTokenAt(hex.q, hex.r);
        if (tokenKey) {
            state.selectedToken = tokenKey;
            syncPanelFromToken(tokenKey);
            rotateToken(tokenKey);
        }
    }

    function removeSelectedToken() {
        const state = AppState.state;
        if (!state.selectedToken || !state.entities[state.selectedToken]) return;
        AppState.pushHistory();
        delete state.entities[state.selectedToken];
        state.selectedToken = null;
        Renderer.scheduleDraw();
        updateToolbar();
    }

    function moveSelectedToken(key) {
        const state = AppState.state;
        const tokenKey = state.selectedToken;
        const entity = tokenKey ? state.entities[tokenKey] : null;
        if (!entity) return;

        const deltas = {
            ArrowRight: [1, 0],
            ArrowLeft: [-1, 0],
            ArrowDown: [0, 1],
            ArrowUp: [0, -1],
        };
        const delta = deltas[key];
        if (!delta) return;

        const pivot = parseCoordKey(tokenKey);
        const targetQ = pivot.q + delta[0];
        const targetR = pivot.r + delta[1];
        if (!AppState.canPlaceToken(entity.shape, entity.facing, targetQ, targetR, tokenKey)) {
            showStatus("statusOccupied");
            return;
        }

        AppState.pushHistory();
        const targetKey = coordKey(targetQ, targetR);
        state.entities[targetKey] = entity;
        delete state.entities[tokenKey];
        state.selectedToken = targetKey;
        Renderer.scheduleDraw();
    }

    function applySelectedColor(color) {
        const state = AppState.state;
        const entity = state.selectedToken ? state.entities[state.selectedToken] : null;
        if (!entity) return;
        if (!colorEditHistoryPushed) {
            AppState.pushHistory();
            colorEditHistoryPushed = true;
        }
        entity.color = color;
        Renderer.scheduleDraw();
    }

    function onPointerDown(event) {
        ui.canvas.setPointerCapture(event.pointerId);
        pointerWorld = worldFromEvent(event);
        pointerDownPos = { x: event.clientX, y: event.clientY };
        dragActive = false;

        const state = AppState.state;
        const mode = getMode();
        const hex = pixelToHex(pointerWorld.x, pointerWorld.y);

        if (event.button === 0) {
            if (mode === "tokens") {
                const tokenKey = AppState.findTokenAt(hex.q, hex.r);
                draggingToken = tokenKey;
                if (tokenKey) {
                    state.selectedToken = tokenKey;
                    syncPanelFromToken(tokenKey);
                    Renderer.setDragState(tokenKey);
                } else {
                    state.selectedToken = null;
                }
                Renderer.scheduleDraw();
            } else if (mode === "terrain") {
                isPaintingTerrain = true;
                terrainPaintAction = state.hexColors[coordKey(hex.q, hex.r)] ? "remove" : "add";
                beginStroke();
                applyTerrain(hex, terrainPaintAction);
            } else if (mode === "walls") {
                isPaintingWalls = true;
                const edgeId = getClosestEdge(hex.q, hex.r, pointerWorld.x, pointerWorld.y);
                wallPaintAction = state.walls.has(edgeId) ? "remove" : "add";
                beginStroke();
                applyWall(edgeId, wallPaintAction);
                lastEdgeId = edgeId;
            } else if (mode === "camera") {
                isDraggingCanvas = true;
                lastPointer = { x: event.clientX, y: event.clientY };
            }
        } else if (event.button === 1) {
            isDraggingCanvas = true;
            lastPointer = { x: event.clientX, y: event.clientY };
        } else if (event.button === 2 && mode === "terrain") {
            isPaintingTerrain = true;
            terrainPaintAction = "remove";
            beginStroke();
            applyTerrain(hex, "remove");
        }
    }

    function onPointerMove(event) {
        pointerWorld = worldFromEvent(event);
        const state = AppState.state;

        if (draggingToken) {
            if (!dragActive) {
                const dx = event.clientX - pointerDownPos.x;
                const dy = event.clientY - pointerDownPos.y;
                if (Math.hypot(dx, dy) <= CLICK_SLOP) return;
                dragActive = true;
            }
            Renderer.setDragWorld(pointerWorld);
            Renderer.scheduleDraw();
            return;
        }

        if (isPaintingTerrain) {
            applyTerrain(pixelToHex(pointerWorld.x, pointerWorld.y), terrainPaintAction);
            return;
        }

        if (isPaintingWalls) {
            const hex = pixelToHex(pointerWorld.x, pointerWorld.y);
            const edgeId = getClosestEdge(hex.q, hex.r, pointerWorld.x, pointerWorld.y);
            if (edgeId !== lastEdgeId) {
                applyWall(edgeId, wallPaintAction);
                lastEdgeId = edgeId;
            }
            return;
        }

        if (!isDraggingCanvas) return;
        state.camera.x += event.clientX - lastPointer.x;
        state.camera.y += event.clientY - lastPointer.y;
        lastPointer = { x: event.clientX, y: event.clientY };
        Renderer.scheduleDraw();
    }

    function onPointerUp(event) {
        pointerWorld = worldFromEvent(event);

        if (draggingToken) {
            const tokenKey = draggingToken;
            const entity = AppState.state.entities[tokenKey];
            draggingToken = null;
            Renderer.setDragState(null);

            if (entity && dragActive) {
                const hex = pixelToHex(pointerWorld.x, pointerWorld.y);
                const targetKey = coordKey(hex.q, hex.r);
                if (targetKey !== tokenKey) {
                    if (AppState.canPlaceToken(entity.shape, entity.facing, hex.q, hex.r, tokenKey)) {
                        AppState.pushHistory();
                        AppState.state.entities[targetKey] = entity;
                        delete AppState.state.entities[tokenKey];
                        AppState.state.selectedToken = targetKey;
                    } else {
                        showStatus("statusOccupied");
                    }
                }
            }

            Renderer.scheduleDraw();
            updateToolbar();
            syncPanelFromToken(AppState.state.selectedToken);
            return;
        }

        if (isPaintingWalls) {
            isPaintingWalls = false;
            lastEdgeId = null;
            return;
        }

        if (isPaintingTerrain) {
            isPaintingTerrain = false;
            return;
        }

        isDraggingCanvas = false;

        const moved =
            Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y) > CLICK_SLOP;
        if (event.button === 0 && !moved && getMode() === "tokens") {
            const hex = pixelToHex(pointerWorld.x, pointerWorld.y);
            if (!AppState.findTokenAt(hex.q, hex.r)) createTokenAt(hex);
        }
    }

    function cancelGestures() {
        isDraggingCanvas = false;
        isPaintingWalls = false;
        isPaintingTerrain = false;
        if (draggingToken) {
            draggingToken = null;
            Renderer.setDragState(null);
        }
        Renderer.scheduleDraw();
    }

    function onContextMenu(event) {
        event.preventDefault();
        if (getMode() !== "tokens") return;

        pointerWorld = worldFromEvent(event);
        const hex = pixelToHex(pointerWorld.x, pointerWorld.y);
        const tokenKey = AppState.findTokenAt(hex.q, hex.r);
        if (!tokenKey) return;

        AppState.pushHistory();
        delete AppState.state.entities[tokenKey];
        if (AppState.state.selectedToken === tokenKey) AppState.state.selectedToken = null;
        Renderer.scheduleDraw();
        updateToolbar();
    }

    function onWheel(event) {
        event.preventDefault();
        const state = AppState.state;
        const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom * factor));
        if (newZoom === state.zoom) return;

        const { width, height } = Renderer.getCanvasSize();
        const screenX = event.clientX - width / 2;
        const screenY = event.clientY - height / 2;
        const worldX = (screenX - state.camera.x) / state.zoom;
        const worldY = (screenY - state.camera.y) / state.zoom;

        state.camera.x = screenX - worldX * newZoom;
        state.camera.y = screenY - worldY * newZoom;
        state.zoom = newZoom;
        Renderer.scheduleDraw();
    }

    function onKeyDown(event) {
        if (isTypingTarget(event.target)) return;
        const state = AppState.state;
        const key = event.key;

        if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "z") {
            event.preventDefault();
            if (event.shiftKey) AppState.redo();
            else AppState.undo();
            updateToolbar();
            syncPanelFromToken(state.selectedToken);
            return;
        }

        if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "y") {
            event.preventDefault();
            AppState.redo();
            updateToolbar();
            syncPanelFromToken(state.selectedToken);
            return;
        }

        if (key === "r" || key === "R") {
            rotateUnderCursor();
            return;
        }

        if (key === "Delete" || key === "Backspace") {
            event.preventDefault();
            removeSelectedToken();
            return;
        }

        if (key === "Escape") {
            state.selectedToken = null;
            Renderer.scheduleDraw();
            return;
        }

        if (key.startsWith("Arrow")) {
            event.preventDefault();
            moveSelectedToken(key);
        }
    }

    function onBeforeUnload(event) {
        if (!AppState.state.dirty) return;
        event.preventDefault();
        event.returnValue = "";
    }

    function wireEvents() {
        const canvas = ui.canvas;

        canvas.addEventListener("pointerdown", onPointerDown);
        canvas.addEventListener("pointermove", onPointerMove);
        canvas.addEventListener("pointerup", onPointerUp);
        canvas.addEventListener("pointercancel", cancelGestures);
        canvas.addEventListener("contextmenu", onContextMenu);
        canvas.addEventListener("wheel", onWheel, { passive: false });

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("beforeunload", onBeforeUnload);

        ui.togglePanel.addEventListener("click", () => {
            const collapsed = ui.panel.classList.toggle("collapsed");
            ui.togglePanel.textContent = collapsed ? "☰" : "−";
        });

        ui.language.addEventListener("change", () => {
            I18n.setLanguage(ui.language.value);
            I18n.apply(document);
            ui.togglePanel.title = I18n.t("togglePanel");
        });

        ui.showCoords.addEventListener("change", () => {
            AppState.state.showCoords = ui.showCoords.checked;
            Renderer.scheduleDraw();
        });

        ui.mapName.addEventListener("change", () => {
            AppState.state.mapName = ui.mapName.value.trim() || "mapa_tatico";
        });

        ui.tokenColor.addEventListener("input", () => applySelectedColor(ui.tokenColor.value));
        ui.tokenColor.addEventListener("change", () => {
            colorEditHistoryPushed = false;
        });

        ui.tokenName.addEventListener("change", () => {
            const state = AppState.state;
            const entity = state.selectedToken ? state.entities[state.selectedToken] : null;
            if (!entity) return;
            const name = ui.tokenName.value.trim() || I18n.t("defaultTokenName");
            if (name === entity.name) return;
            AppState.pushHistory();
            entity.name = name;
            Renderer.scheduleDraw();
        });

        ui.tokenShape.addEventListener("change", () => {
            const state = AppState.state;
            const tokenKey = state.selectedToken;
            const entity = tokenKey ? state.entities[tokenKey] : null;
            if (!entity) return;

            const shape = AppState.SHAPES[ui.tokenShape.value];
            if (!shape) return;

            const pivot = parseCoordKey(tokenKey);
            if (!AppState.canPlaceToken(shape, entity.facing, pivot.q, pivot.r, tokenKey)) {
                showStatus("statusOccupied");
                const currentKey = findShapeKey(entity.shape);
                if (currentKey) ui.tokenShape.value = currentKey;
                return;
            }

            AppState.pushHistory();
            entity.shape = shape;
            Renderer.scheduleDraw();
        });

        ui.btnSave.addEventListener("click", () => {
            AppState.state.mapName = ui.mapName.value.trim() || "mapa_tatico";
            MapIO.saveMap();
            updateToolbar();
            showStatus("statusSaved");
        });

        ui.btnLoad.addEventListener("click", () => ui.fileInput.click());

        ui.fileInput.addEventListener("change", async (event) => {
            const file = event.target.files[0];
            event.target.value = "";
            if (!file) return;

            const result = await MapIO.loadFromFile(file);
            if (result.ok) {
                ui.mapName.value = AppState.state.mapName;
                updateToolbar();
                showStatus("statusLoaded");
            } else {
                window.alert(result.error === "read" ? I18n.t("errorReadFile") : I18n.t("errorInvalidMap"));
            }
        });

        ui.btnNew.addEventListener("click", () => {
            if (hasContent() && !window.confirm(I18n.t("confirmNew"))) return;
            AppState.reset();
            MapIO.clearAutosave();
            ui.mapName.value = AppState.state.mapName;
            updateToolbar();
            showStatus("statusNew");
        });

        ui.btnUndo.addEventListener("click", () => {
            AppState.undo();
            updateToolbar();
            syncPanelFromToken(AppState.state.selectedToken);
        });

        ui.btnRedo.addEventListener("click", () => {
            AppState.redo();
            updateToolbar();
            syncPanelFromToken(AppState.state.selectedToken);
        });

        ui.btnCenter.addEventListener("click", () => {
            AppState.state.camera = { x: 0, y: 0 };
            AppState.state.zoom = 1;
            Renderer.scheduleDraw();
        });
    }

    function init() {
        I18n.setLanguage(I18n.detectLanguage());
        ui.language.value = I18n.getLanguage();
        I18n.apply(document);

        if (MapIO.restoreAutosave() && hasContent()) showStatus("statusRestored");

        ui.mapName.value = AppState.state.mapName;

        AppState.setChangeListener(() => {
            ui.mapName.value = AppState.state.mapName;
            Renderer.scheduleDraw();
            updateToolbar();
            MapIO.scheduleAutosave();
        });

        wireEvents();
        updateToolbar();
        Renderer.scheduleDraw();
    }

    init();
})(typeof self !== "undefined" ? self : globalThis);
