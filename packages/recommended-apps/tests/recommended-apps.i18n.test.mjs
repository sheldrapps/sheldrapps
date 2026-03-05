import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const REQUIRED_KEYS = [
  "TITLE",
  "OPEN_PLAY_STORE",
  "EMPTY_STATE",
  "APP_DESC_CCFK",
  "APP_DESC_ECC",
];

const EXPECTED = {
  "en-US": {
    TITLE: "Recommended apps",
    OPEN_PLAY_STORE: "View on Play Store",
    EMPTY_STATE: "No recommended apps available",
    APP_DESC_CCFK: "Create Kindle-ready covers from your images.",
    APP_DESC_ECC: "Replace EPUB covers and export updated files.",
  },
  "es-MX": {
    TITLE: "Apps recomendadas",
    OPEN_PLAY_STORE: "Ver en Play Store",
    EMPTY_STATE: "No hay apps recomendadas disponibles",
    APP_DESC_CCFK: "Crea portadas listas para Kindle desde tus imagenes.",
    APP_DESC_ECC: "Reemplaza portadas EPUB y exporta archivos actualizados.",
  },
  "de-DE": {
    TITLE: "Empfohlene Apps",
    OPEN_PLAY_STORE: "Im Play Store ansehen",
    EMPTY_STATE: "Keine empfohlenen Apps verfuegbar",
    APP_DESC_CCFK: "Erstelle Kindle-fertige Cover aus deinen Bildern.",
    APP_DESC_ECC: "Ersetze EPUB-Cover und exportiere aktualisierte Dateien.",
  },
  "fr-FR": {
    TITLE: "Applications recommandees",
    OPEN_PLAY_STORE: "Voir sur le Play Store",
    EMPTY_STATE: "Aucune application recommandee disponible",
    APP_DESC_CCFK:
      "Creez des couvertures pretes pour Kindle a partir de vos images.",
    APP_DESC_ECC:
      "Remplacez les couvertures EPUB et exportez les fichiers mis a jour.",
  },
  "it-IT": {
    TITLE: "App consigliate",
    OPEN_PLAY_STORE: "Vedi nel Play Store",
    EMPTY_STATE: "Nessuna app consigliata disponibile",
    APP_DESC_CCFK: "Crea copertine pronte per Kindle dalle tue immagini.",
    APP_DESC_ECC: "Sostituisci le copertine EPUB ed esporta i file aggiornati.",
  },
  "pt-BR": {
    TITLE: "Apps recomendados",
    OPEN_PLAY_STORE: "Ver na Play Store",
    EMPTY_STATE: "Nenhum app recomendado disponivel",
    APP_DESC_CCFK: "Crie capas prontas para Kindle a partir das suas imagens.",
    APP_DESC_ECC: "Substitua capas EPUB e exporte arquivos atualizados.",
  },
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

for (const locale of Object.keys(EXPECTED)) {
  test(`i18n keys exist for ${locale}`, () => {
    const file = path.join(
      process.cwd(),
      "packages",
      "recommended-apps",
      "src",
      "i18n",
      `${locale}.ts`,
    );
    assert.equal(fs.existsSync(file), true, `${locale}.ts must exist`);
    const source = fs.readFileSync(file, "utf8");

    for (const key of REQUIRED_KEYS) {
      assert.match(source, new RegExp(`\\b${key}\\s*:`, "u"));
    }
  });

  test(`i18n values match PRD for ${locale}`, () => {
    const file = path.join(
      process.cwd(),
      "packages",
      "recommended-apps",
      "src",
      "i18n",
      `${locale}.ts`,
    );
    const source = fs.readFileSync(file, "utf8");

    for (const [key, value] of Object.entries(EXPECTED[locale])) {
      const valueRegex = new RegExp(
        `\\b${key}\\s*:\\s*['\"]${escapeRegExp(value)}['\"]`,
        "u",
      );
      assert.match(source, valueRegex);
    }
  });
}