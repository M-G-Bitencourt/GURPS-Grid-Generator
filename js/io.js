/**
 * Persistence: file save/load and localStorage autosave.
 * Browser only: loaded as a classic script after schema.js and state.js,
 * exposing `window.MapIO`.
 */
(function (root) {
    "use strict";

    const AppState = root.AppState;
    const MapSchema = root.MapSchema;

    const AUTOSAVE_KEY = "gurps-grid-autosave";
    const AUTOSAVE_DELAY = 500;

    let autosaveTimer = null;

    function sanitizeFileName(name) {
        return name
            .trim()
            .replace(/[^\w\- ]/g, "")
            .replace(/\s+/g, "_")
            .slice(0, 80);
    }

    /** Downloads the current map as a JSON file (Blob based, no data URIs). */
    function saveMap() {
        const data = MapSchema.buildSaveData(AppState.state);
        const blob = new Blob([JSON.stringify(data, null, 4)], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${sanitizeFileName(AppState.state.mapName) || "mapa_tatico"}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        URL.revokeObjectURL(url);
        AppState.markClean();
    }

    /**
     * Reads and validates a user-selected file, replacing the current map on
     * success. Resolves with { ok, error } instead of rejecting, so callers
     * can show a localized message.
     */
    function loadFromFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onerror = () => resolve({ ok: false, error: "read" });
            reader.onload = (event) => {
                let data;
                try {
                    data = MapSchema.parseMapData(JSON.parse(event.target.result));
                } catch {
                    resolve({ ok: false, error: "invalid" });
                    return;
                }
                AppState.loadData(data);
                resolve({ ok: true });
            };
            reader.readAsText(file);
        });
    }

    function writeAutosave() {
        try {
            const data = MapSchema.buildSaveData(AppState.state);
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
        } catch {
            /* storage may be unavailable or full; autosave is best-effort */
        }
    }

    /** Debounces autosave writes so rapid edits produce a single write. */
    function scheduleAutosave() {
        if (autosaveTimer !== null) clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => {
            autosaveTimer = null;
            writeAutosave();
        }, AUTOSAVE_DELAY);
    }

    function clearAutosave() {
        if (autosaveTimer !== null) {
            clearTimeout(autosaveTimer);
            autosaveTimer = null;
        }
        try {
            localStorage.removeItem(AUTOSAVE_KEY);
        } catch {
            /* ignore storage errors */
        }
    }

    /** Restores the autosaved session, if any. Returns true when restored. */
    function restoreAutosave() {
        let raw;
        try {
            raw = localStorage.getItem(AUTOSAVE_KEY);
        } catch {
            return false;
        }
        if (!raw) return false;

        try {
            AppState.loadData(MapSchema.parseMapData(JSON.parse(raw)));
            return true;
        } catch {
            clearAutosave();
            return false;
        }
    }

    root.MapIO = {
        saveMap,
        loadFromFile,
        scheduleAutosave,
        clearAutosave,
        restoreAutosave,
    };
})(typeof self !== "undefined" ? self : globalThis);
