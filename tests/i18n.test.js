import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const I18n = require("../js/i18n.js");

describe("translations", () => {
    it("defines the same keys in every locale", () => {
        const reference = Object.keys(I18n.TRANSLATIONS["pt-BR"]).sort();
        for (const locale of Object.keys(I18n.TRANSLATIONS)) {
            expect(Object.keys(I18n.TRANSLATIONS[locale]).sort()).toEqual(reference);
        }
    });

    it("has no empty strings", () => {
        for (const locale of Object.keys(I18n.TRANSLATIONS)) {
            for (const [key, value] of Object.entries(I18n.TRANSLATIONS[locale])) {
                expect(value, `${locale}.${key}`).not.toBe("");
            }
        }
    });
});

describe("t()", () => {
    it("translates in the current language", () => {
        I18n.setLanguage("en");
        expect(I18n.t("statusSaved")).toBe("Map saved.");
        I18n.setLanguage("pt-BR");
        expect(I18n.t("statusSaved")).toBe("Mapa salvo.");
    });

    it("falls back to the key itself when missing", () => {
        expect(I18n.t("this-key-does-not-exist")).toBe("this-key-does-not-exist");
    });
});

describe("setLanguage", () => {
    it("ignores unsupported languages", () => {
        I18n.setLanguage("en");
        I18n.setLanguage("fr");
        expect(I18n.getLanguage()).toBe("en");
    });
});
