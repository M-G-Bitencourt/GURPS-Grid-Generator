/**
 * Internationalization: UI strings for pt-BR and en.
 * Pure lookup logic, unit tested in Node via the CommonJS export below.
 */
(function (root, factory) {
    "use strict";
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.I18n = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
    "use strict";

    const DEFAULT_LANGUAGE = "pt-BR";
    const STORAGE_KEY = "gurps-grid-language";

    const AVAILABLE_LANGUAGES = [
        { code: "pt-BR", label: "Português (Brasil)" },
        { code: "en", label: "English" },
    ];

    const TRANSLATIONS = {
        "pt-BR": {
            appTitle: "GURPS Grid Generator",
            languageLabel: "Idioma",
            togglePanel: "Recolher painel",
            modeLabel: "Modo de Interação",
            modeTokens: "Tokens",
            modeTerrain: "Terreno",
            modeWalls: "Paredes",
            modeCamera: "Câmera",
            terrainColorLabel: "Cor do Terreno (Hexágono)",
            tokenNameLabel: "Nome do Token",
            tokenNamePlaceholder: "Nome do token",
            tokenColorLabel: "Cor do Token",
            tokenShapeLabel: "Formato (Multi-Hex)",
            shape1x1: "1 Hex (Padrão)",
            shape1x2: "2 Hex (Linha)",
            shape1x3: "3 Hex (Linha Média)",
            shape1x4: "4 Hex (Linha Longa)",
            shapeTri: "3 Hex (Triângulo)",
            shape2x2: "4 Hex (Bloco Largo)",
            shape2x3: "6 Hex (Retângulo)",
            shapeGiant: "7 Hex (Gigante)",
            shapeColossal: "19 Hex (Colossal)",
            mapNameLabel: "Nome do Mapa",
            mapNamePlaceholder: "Nome do mapa",
            btnSave: "Salvar",
            btnLoad: "Carregar",
            btnNew: "Novo",
            btnUndo: "Desfazer",
            btnRedo: "Refazer",
            btnCenter: "Centralizar",
            showCoords: "Mostrar coordenadas",
            instructionsTitle: "Instruções",
            helpTokens: "Tokens: Clique adiciona, arrastar move, clique direito remove.",
            helpTerrain: "Terreno: Clique e arraste para pintar (se vazio) ou apagar (se colorido).",
            helpRotate: "Rotacionar: Tecla 'R' sobre o token ou com um token selecionado.",
            helpSelect: "Selecionar: Clique no token; setas movem; Delete remove.",
            helpWalls: "Paredes: Arraste sobre as bordas.",
            helpCamera: "Câmera: Arraste com o botão central ou use o modo Câmera.",
            helpZoom: "Zoom: Use o scroll do mouse.",
            helpUndo: "Desfazer/Refazer: Ctrl+Z / Ctrl+Shift+Z.",
            defaultTokenName: "Desconhecido",
            statusSaved: "Mapa salvo.",
            statusLoaded: "Mapa carregado.",
            statusNew: "Novo mapa criado.",
            statusRestored: "Sessão anterior restaurada automaticamente.",
            statusOccupied: "Espaço ocupado por outro token.",
            errorReadFile: "Erro ao ler o arquivo do mapa.",
            errorInvalidMap: "O arquivo não contém um mapa válido.",
            confirmNew: "Descartar o mapa atual e criar um novo?",
            unsavedWarning: "Há alterações não salvas no mapa.",
        },
        en: {
            appTitle: "GURPS Grid Generator",
            languageLabel: "Language",
            togglePanel: "Collapse panel",
            modeLabel: "Interaction Mode",
            modeTokens: "Tokens",
            modeTerrain: "Terrain",
            modeWalls: "Walls",
            modeCamera: "Camera",
            terrainColorLabel: "Terrain Color (Hex)",
            tokenNameLabel: "Token Name",
            tokenNamePlaceholder: "Token name",
            tokenColorLabel: "Token Color",
            tokenShapeLabel: "Shape (Multi-Hex)",
            shape1x1: "1 Hex (Default)",
            shape1x2: "2 Hex (Line)",
            shape1x3: "3 Hex (Medium Line)",
            shape1x4: "4 Hex (Long Line)",
            shapeTri: "3 Hex (Triangle)",
            shape2x2: "4 Hex (Wide Block)",
            shape2x3: "6 Hex (Rectangle)",
            shapeGiant: "7 Hex (Giant)",
            shapeColossal: "19 Hex (Colossal)",
            mapNameLabel: "Map Name",
            mapNamePlaceholder: "Map name",
            btnSave: "Save",
            btnLoad: "Load",
            btnNew: "New",
            btnUndo: "Undo",
            btnRedo: "Redo",
            btnCenter: "Center",
            showCoords: "Show coordinates",
            instructionsTitle: "Instructions",
            helpTokens: "Tokens: Click to add, drag to move, right-click to remove.",
            helpTerrain: "Terrain: Click and drag to paint (if empty) or erase (if colored).",
            helpRotate: "Rotate: Press 'R' over a token or with a token selected.",
            helpSelect: "Select: Click a token; arrow keys move it; Delete removes it.",
            helpWalls: "Walls: Drag over the edges.",
            helpCamera: "Camera: Drag with the middle mouse button or use Camera mode.",
            helpZoom: "Zoom: Use the mouse wheel.",
            helpUndo: "Undo/Redo: Ctrl+Z / Ctrl+Shift+Z.",
            defaultTokenName: "Unknown",
            statusSaved: "Map saved.",
            statusLoaded: "Map loaded.",
            statusNew: "New map created.",
            statusRestored: "Previous session restored automatically.",
            statusOccupied: "Space occupied by another token.",
            errorReadFile: "Error reading the map file.",
            errorInvalidMap: "The file does not contain a valid map.",
            confirmNew: "Discard the current map and start a new one?",
            unsavedWarning: "There are unsaved changes in the map.",
        },
    };

    let currentLanguage = DEFAULT_LANGUAGE;

    /** Returns the translation for a key, falling back to the key itself. */
    function t(key) {
        const table = TRANSLATIONS[currentLanguage] || TRANSLATIONS[DEFAULT_LANGUAGE];
        if (key in table) return table[key];
        if (key in TRANSLATIONS[DEFAULT_LANGUAGE]) return TRANSLATIONS[DEFAULT_LANGUAGE][key];
        return key;
    }

    function isSupported(language) {
        return Object.prototype.hasOwnProperty.call(TRANSLATIONS, language);
    }

    function getLanguage() {
        return currentLanguage;
    }

    /** Reads the stored language choice; returns null outside the browser. */
    function readStoredLanguage() {
        if (typeof window === "undefined") return null;
        try {
            return window.localStorage.getItem(STORAGE_KEY);
        } catch {
            return null;
        }
    }

    /** Persists the language choice when storage is available. */
    function storeLanguage(language) {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(STORAGE_KEY, language);
        } catch {
            /* storage may be unavailable (private mode, file protocol restrictions) */
        }
    }

    /** Sets the current language, persisting the choice when storage is available. */
    function setLanguage(language) {
        if (!isSupported(language)) return;
        currentLanguage = language;
        storeLanguage(language);
    }

    /** Reads the persisted language choice, falling back to the browser language. */
    function detectLanguage() {
        const stored = readStoredLanguage();
        if (stored && isSupported(stored)) return stored;

        const browserLanguage = typeof navigator !== "undefined" ? navigator.language : null;
        if (browserLanguage && browserLanguage.toLowerCase().startsWith("en")) return "en";
        return DEFAULT_LANGUAGE;
    }

    /**
     * Applies translations to every element carrying a data-i18n attribute
     * (textContent), data-i18n-placeholder or data-i18n-title.
     */
    function apply(rootNode) {
        if (typeof document === "undefined") return;
        const scope = rootNode || document;

        scope.querySelectorAll("[data-i18n]").forEach((element) => {
            element.textContent = t(element.getAttribute("data-i18n"));
        });
        scope.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
            element.placeholder = t(element.getAttribute("data-i18n-placeholder"));
        });
        scope.querySelectorAll("[data-i18n-title]").forEach((element) => {
            element.title = t(element.getAttribute("data-i18n-title"));
        });
        if (scope === document) {
            document.title = t("appTitle");
            document.documentElement.lang = currentLanguage;
        }
    }

    return {
        DEFAULT_LANGUAGE,
        AVAILABLE_LANGUAGES,
        TRANSLATIONS,
        t,
        getLanguage,
        setLanguage,
        detectLanguage,
        apply,
    };
});
