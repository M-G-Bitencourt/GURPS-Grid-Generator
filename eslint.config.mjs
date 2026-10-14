import js from "@eslint/js";
import globals from "globals";

export default [
    {
        ignores: ["node_modules/**", "assets/**", "saved_maps/**", "examples/**"],
    },
    js.configs.recommended,
    {
        files: ["js/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: {
                ...globals.browser,
                ...globals.node,
                // Global namespaces created by the app's classic scripts.
                HexMath: "readonly",
                I18n: "readonly",
                MapSchema: "readonly",
                AppState: "readonly",
                Renderer: "readonly",
                MapIO: "readonly",
            },
        },
    },
    {
        files: ["tests/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
    },
];
