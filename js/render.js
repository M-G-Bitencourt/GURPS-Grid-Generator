/**
 * Canvas rendering. Browser only: loaded as a classic script after hex.js,
 * i18n.js and state.js, exposing `window.Renderer`.
 * All drawing is coalesced through requestAnimationFrame so that heavy
 * pointer interaction does not trigger redundant frames.
 */
(function (root) {
    "use strict";

    const { SIZE, coordKey, parseCoordKey, hexToPixel, pixelToHex, rotateHex, parseEdgeId } = root.HexMath;
    const AppState = root.AppState;

    const canvas = document.getElementById("hexCanvas");
    const ctx = canvas.getContext("2d");

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let rafId = null;

    let draggingTokenKey = null;
    let dragWorld = { x: 0, y: 0 };

    window.addEventListener("resize", () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        scheduleDraw();
    });

    /** Queues a redraw at most once per animation frame. */
    function scheduleDraw() {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
            rafId = null;
            draw();
        });
    }

    function getCanvasSize() {
        return { width, height };
    }

    /** Tells the renderer which token is currently following the pointer. */
    function setDragState(tokenKey) {
        draggingTokenKey = tokenKey;
    }

    /** Updates the world position used to preview a dragged token. */
    function setDragWorld(position) {
        dragWorld = { x: position.x, y: position.y };
    }

    /** Traces the hexagonal path of a hex centered at (x, y). */
    function traceHexPath(x, y, size = SIZE) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 180) * 60 * i;
            const px = x + size * Math.cos(angle);
            const py = y + size * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    }

    function drawHex(x, y, fillColor) {
        traceHexPath(x, y);
        if (fillColor) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }
        ctx.stroke();
    }

    /**
     * Computes the visible hex range from the four screen corners, so the
     * grid only iterates over hexes that can actually appear on screen.
     */
    function visibleHexBounds(state) {
        const zoom = state.zoom;
        const left = (-width / 2 - state.camera.x) / zoom;
        const top = (-height / 2 - state.camera.y) / zoom;
        const right = (width / 2 - state.camera.x) / zoom;
        const bottom = (height / 2 - state.camera.y) / zoom;

        const corners = [
            pixelToHex(left, top),
            pixelToHex(right, top),
            pixelToHex(left, bottom),
            pixelToHex(right, bottom),
        ];
        const margin = 2;
        return {
            minQ: Math.min(...corners.map((corner) => corner.q)) - margin,
            maxQ: Math.max(...corners.map((corner) => corner.q)) + margin,
            minR: Math.min(...corners.map((corner) => corner.r)) - margin,
            maxR: Math.max(...corners.map((corner) => corner.r)) + margin,
        };
    }

    function drawGrid(state) {
        const bounds = visibleHexBounds(state);
        const showLabels = state.showCoords && state.zoom >= 0.7;

        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1;
        ctx.lineCap = "butt";

        for (let q = bounds.minQ; q <= bounds.maxQ; q++) {
            for (let r = bounds.minR; r <= bounds.maxR; r++) {
                const pos = hexToPixel(q, r);
                const fillColor = state.hexColors[coordKey(q, r)] || null;
                drawHex(pos.x, pos.y, fillColor);

                if (showLabels) {
                    ctx.fillStyle = "#8a8a8a";
                    ctx.font = "10px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(coordKey(q, r), pos.x, pos.y);
                }
            }
        }
    }

    function drawWalls(state) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";

        for (const edgeId of state.walls) {
            const { a, b } = parseEdgeId(edgeId);
            const dq = b.q - a.q;
            const dr = b.r - a.r;
            const dirIndex = root.HexMath.DIRS.findIndex((dir) => dir[0] === dq && dir[1] === dr);
            if (dirIndex === -1) continue;

            const center = hexToPixel(a.q, a.r);
            const v1 = dirIndex;
            const v2 = (dirIndex + 1) % 6;

            const px1 = center.x + SIZE * Math.cos((v1 * 60 * Math.PI) / 180);
            const py1 = center.y + SIZE * Math.sin((v1 * 60 * Math.PI) / 180);
            const px2 = center.x + SIZE * Math.cos((v2 * 60 * Math.PI) / 180);
            const py2 = center.y + SIZE * Math.sin((v2 * 60 * Math.PI) / 180);

            ctx.beginPath();
            ctx.moveTo(px1, py1);
            ctx.lineTo(px2, py2);
            ctx.stroke();
        }
    }

    function drawEntity(pivotQ, pivotR, entity, options = {}) {
        if (options.dragged) {
            const hex = pixelToHex(dragWorld.x, dragWorld.y);
            pivotQ = hex.q;
            pivotR = hex.r;
            ctx.globalAlpha = 0.7;
        }

        ctx.fillStyle = entity.color;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.lineCap = "butt";

        const pivotPos = hexToPixel(pivotQ, pivotR);

        for (const offset of entity.shape) {
            const rotated = rotateHex(offset.q, offset.r, entity.facing);
            const pos = hexToPixel(pivotQ + rotated.q, pivotR + rotated.r);
            traceHexPath(pos.x, pos.y);
            ctx.fill();
            ctx.stroke();
        }

        if (options.selected) {
            ctx.save();
            ctx.strokeStyle = "#ffb300";
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 4]);
            for (const offset of entity.shape) {
                const rotated = rotateHex(offset.q, offset.r, entity.facing);
                const pos = hexToPixel(pivotQ + rotated.q, pivotR + rotated.r);
                traceHexPath(pos.x, pos.y, SIZE - 2);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Facing indicator: a short line from the pivot towards the front.
        const faceAngle = ((entity.facing * 60 - 90) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(pivotPos.x, pivotPos.y);
        ctx.lineTo(
            pivotPos.x + Math.cos(faceAngle) * SIZE * 0.8,
            pivotPos.y + Math.sin(faceAngle) * SIZE * 0.8
        );
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = "#000";
        ctx.font = `bold ${Math.round(SIZE * 0.4)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(entity.name, pivotPos.x, pivotPos.y + SIZE + 10);

        if (options.dragged) ctx.globalAlpha = 1;
    }

    function drawTokens(state) {
        for (const key of Object.keys(state.entities)) {
            if (key === draggingTokenKey) continue;
            const pivot = parseCoordKey(key);
            drawEntity(pivot.q, pivot.r, state.entities[key], { selected: key === state.selectedToken });
        }
        if (draggingTokenKey && state.entities[draggingTokenKey]) {
            const pivot = parseCoordKey(draggingTokenKey);
            drawEntity(pivot.q, pivot.r, state.entities[draggingTokenKey], { dragged: true, selected: true });
        }
    }

    function draw() {
        const state = AppState.state;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, width, height);

        ctx.save();
        ctx.translate(width / 2 + state.camera.x, height / 2 + state.camera.y);
        ctx.scale(state.zoom, state.zoom);

        drawGrid(state);
        drawWalls(state);
        drawTokens(state);

        ctx.restore();
    }

    root.Renderer = {
        scheduleDraw,
        draw,
        getCanvasSize,
        setDragState,
        setDragWorld,
    };
})(typeof self !== "undefined" ? self : globalThis);
