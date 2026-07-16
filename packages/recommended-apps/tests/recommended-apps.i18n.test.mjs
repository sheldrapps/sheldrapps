import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const REQUIRED_KEYS = [
  "TITLE",
  "OPEN_PLAY_STORE",
  "EMPTY_STATE",
  "APP_NAME_CCFK",
  "APP_NAME_ECC",
  "APP_NAME_PCM",
  "APP_NAME_EF",
  "APP_DESC_CCFK",
  "APP_DESC_ECC",
  "APP_DESC_PCM",
  "APP_DESC_EF",
];

const EXPECTED = {
  "en-US": {
    TITLE: "Recommended apps",
    OPEN_PLAY_STORE: "View on Play Store",
    EMPTY_STATE: "No recommended apps available",
    APP_NAME_CCFK: "E-Reader Cover Creator",
    APP_NAME_ECC: "EPUB Cover Changer",
    APP_NAME_PCM: "PDF Cover Maker",
    APP_NAME_EF: "EPUB Fixer",
    APP_DESC_CCFK: "Create e-reader covers from your images in just a few taps.",
    APP_DESC_ECC: "Replace EPUB covers and export updated files.",
    APP_DESC_PCM: "Replace PDF covers and export updated files.",
    APP_DESC_EF: "Diagnose and repair common EPUB file issues",
  },
  "es-MX": {
    TITLE: "Apps recomendadas",
    OPEN_PLAY_STORE: "Ver en Play Store",
    EMPTY_STATE: "No hay apps recomendadas disponibles",
    APP_NAME_CCFK: "Creador de portadas e-reader",
    APP_NAME_ECC: "Cambiar portada a EPUB",
    APP_NAME_PCM: "Creador de Portadas PDF",
    APP_NAME_EF: "Reparar EPUB",
    APP_DESC_CCFK: "Crea portadas para e-reader desde tus imágenes en solo unos pasos.",
    APP_DESC_ECC: "Reemplaza portadas EPUB y exporta archivos actualizados.",
    APP_DESC_PCM: "Reemplaza portadas PDF y exporta archivos actualizados.",
    APP_DESC_EF: "Detecta y repara problemas comunes en archivos EPUB",
  },
  "de-DE": {
    TITLE: "Empfohlene Apps",
    OPEN_PLAY_STORE: "Im Play Store ansehen",
    EMPTY_STATE: "Keine empfohlenen Apps verfügbar",
    APP_NAME_CCFK: "E-Reader Cover Creator",
    APP_NAME_ECC: "EPUB Cover ändern",
    APP_NAME_PCM: "PDF-Cover erstellen",
    APP_NAME_EF: "EPUB reparieren",
    APP_DESC_CCFK: "Erstelle E-Reader-Cover aus deinen Bildern in nur wenigen Schritten.",
    APP_DESC_ECC: "Ersetze EPUB-Cover und exportiere aktualisierte Dateien.",
    APP_DESC_PCM: "Ersetze PDF-Cover und exportiere aktualisierte Dateien.",
    APP_DESC_EF: "Häufige EPUB-Probleme prüfen und reparierte Kopie speichern",
  },
  "fr-FR": {
    TITLE: "Applications recommandées",
    OPEN_PLAY_STORE: "Voir sur le Play Store",
    EMPTY_STATE: "Aucune application recommandée disponible",
    APP_NAME_CCFK: "Créateur couvertures e-reader",
    APP_NAME_ECC: "Changer couverture EPUB",
    APP_NAME_PCM: "Créer couverture PDF",
    APP_NAME_EF: "Réparer EPUB",
    APP_DESC_CCFK:
      "Créez des couvertures pour e-reader à partir de vos images en quelques étapes.",
    APP_DESC_ECC:
      "Remplacez les couvertures EPUB et exportez les fichiers mis à jour.",
    APP_DESC_PCM:
      "Remplacez les couvertures PDF et exportez les fichiers mis à jour.",
    APP_DESC_EF: "Diagnostiquer et réparer les problèmes EPUB courants",
  },
  "it-IT": {
    TITLE: "App consigliate",
    OPEN_PLAY_STORE: "Vedi nel Play Store",
    EMPTY_STATE: "Nessuna app consigliata disponibile",
    APP_NAME_CCFK: "Creatore copertine e-reader",
    APP_NAME_ECC: "Cambiare copertina EPUB",
    APP_NAME_PCM: "Crea copertina PDF",
    APP_NAME_EF: "Ripara EPUB",
    APP_DESC_CCFK: "Crea copertine per e-reader dalle tue immagini in pochi passaggi.",
    APP_DESC_ECC: "Sostituisci le copertine EPUB ed esporta i file aggiornati.",
    APP_DESC_PCM: "Sostituisci le copertine PDF ed esporta i file aggiornati.",
    APP_DESC_EF: "Diagnostica e ripara problemi comuni dei file EPUB",
  },
  "pt-BR": {
    TITLE: "Apps recomendados",
    OPEN_PLAY_STORE: "Ver na Play Store",
    EMPTY_STATE: "Nenhum app recomendado disponível",
    APP_NAME_CCFK: "Criador de capas e-reader",
    APP_NAME_ECC: "Alterar capa do EPUB",
    APP_NAME_PCM: "Criar capa para PDF",
    APP_NAME_EF: "Reparar EPUB",
    APP_DESC_CCFK: "Crie capas para e-reader a partir das suas imagens em poucos passos.",
    APP_DESC_ECC: "Substitua capas EPUB e exporte arquivos atualizados.",
    APP_DESC_PCM: "Substitua capas de PDF e exporte arquivos atualizados.",
    APP_DESC_EF: "Diagnostique e repare problemas comuns de EPUB",
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
