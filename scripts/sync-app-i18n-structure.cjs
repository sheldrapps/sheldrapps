const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { deepRepair } = require("./repair-app-i18n.cjs");

const repoRoot = path.resolve(__dirname, "..");
const appRoots = [
  "apps/cover-creator-for-kindle",
  "apps/epub-cover-changer",
  "apps/pdf-cover-maker",
  "apps/epub-fixer",
];

const localePacks = {
  "ar-SA": {
    exportTitle: "جودة التصدير",
    exportDesc:
      "يستخدم التصدير المجاني الوضع القياسي. أزل الإعلانات لفتح اختيار التصدير (بدون فقد/مضغوط).",
    closeTitle: "إغلاق الآن",
    closeDesc: "استمتع بالنسخة المجانية في الوقت الحالي. لست ملزماً بالشراء.",
    loadingPreview: "جارٍ تحميل المعاينة...",
    processCancelled: "تم إلغاء المعالجة",
    errorSize: "الملف كبير جدًا. الحد الأقصى {{maxSize}} MB.",
    invalid: (app) => `غلاف ${app} غير صالح. اضغط لاختيار صورة جديدة.`,
    corrupt: (app) => `تعذر قراءة ملف ${app}. جرّب ملفًا آخر.`,
    noCover: (app) => `لا يحتوي ملف ${app} هذا على غلاف قابل للاستبدال.`,
    rewrite: (app) => `تعذر معالجة ملف ${app}. يرجى المحاولة مرة أخرى.`,
    type: (app) => `ملف ${app} غير مدعوم.`,
    loadingCopy: (app) => `جارٍ نسخ ملف ${app} الكبير...`,
    loadingInspect: (app) => `جارٍ فحص بنية ${app}...`,
    processingLarge: (app) => `جارٍ معالجة ملف ${app} الكبير...`,
  },
  "de-DE": {
    exportTitle: "Exportqualität",
    exportDesc:
      "Der kostenlose Export verwendet Standard. Entferne Werbung, um zwischen verlustfreiem und komprimiertem Export zu wählen.",
    closeTitle: "Fürs Erste schließen",
    closeDesc: "Nutze vorerst die kostenlose Version. Ein Kauf ist nicht erforderlich.",
    loadingPreview: "Vorschau wird geladen...",
    processCancelled: "Verarbeitung abgebrochen",
    errorSize: "Die Datei ist zu groß. Maximum {{maxSize}} MB.",
    invalid: (app) => `Ungültiges ${app}-Cover. Tippe, um ein neues Bild auszuwählen.`,
    corrupt: (app) => `Die ${app}-Datei konnte nicht gelesen werden. Versuche eine andere Datei.`,
    noCover: (app) => `Diese ${app}-Datei enthält kein ersetzbares Cover.`,
    rewrite: (app) => `Die ${app}-Datei konnte nicht verarbeitet werden. Bitte versuche es erneut.`,
    type: (app) => `Nicht unterstützte ${app}-Datei.`,
    loadingCopy: (app) => `Große ${app}-Datei wird kopiert...`,
    loadingInspect: (app) => `Die ${app}-Struktur wird geprüft...`,
    processingLarge: (app) => `Große ${app}-Datei wird verarbeitet...`,
  },
  "fr-FR": {
    exportTitle: "Qualité d’export",
    exportDesc:
      "L’export gratuit utilise Standard. Supprime les publicités pour choisir entre export sans perte et compressé.",
    closeTitle: "Fermer pour l’instant",
    closeDesc: "Pour l’instant, profitez de la version gratuite. Vous n’êtes pas obligé d’acheter.",
    loadingPreview: "Chargement de l’aperçu...",
    processCancelled: "Traitement annulé",
    errorSize: "Le fichier est trop volumineux. Maximum {{maxSize}} Mo.",
    invalid: (app) => `Couverture ${app} non valide. Touchez pour choisir une nouvelle image.`,
    corrupt: (app) => `Le fichier ${app} n’a pas pu être lu. Essayez un autre fichier.`,
    noCover: (app) => `Ce fichier ${app} ne contient pas de couverture remplaçable.`,
    rewrite: (app) => `Le fichier ${app} n’a pas pu être traité. Veuillez réessayer.`,
    type: (app) => `Fichier ${app} non pris en charge.`,
    loadingCopy: (app) => `Copie du gros fichier ${app}...`,
    loadingInspect: (app) => `Examen de la structure ${app}...`,
    processingLarge: (app) => `Traitement du gros fichier ${app}...`,
  },
  "hi-IN": {
    exportTitle: "निर्यात गुणवत्ता",
    exportDesc:
      "निःशुल्क निर्यात Standard का उपयोग करता है. विज्ञापन हटाएँ ताकि लॉसलेस/संपीड़ित निर्यात चुन सकें.",
    closeTitle: "अभी बंद करें",
    closeDesc: "फ़िलहाल मुफ़्त संस्करण का आनंद लें. खरीदना आवश्यक नहीं है.",
    loadingPreview: "पूर्वावलोकन लोड हो रहा है...",
    processCancelled: "प्रक्रिया रद्द की गई",
    errorSize: "फ़ाइल बहुत बड़ी है. अधिकतम {{maxSize}} MB.",
    invalid: (app) => `अमान्य ${app} कवर. नई छवि चुनने के लिए टैप करें.`,
    corrupt: (app) => `${app} फ़ाइल पढ़ी नहीं जा सकी. कृपया दूसरी फ़ाइल आज़माएँ.`,
    noCover: (app) => `इस ${app} फ़ाइल में बदली जा सकने वाली कवर नहीं है.`,
    rewrite: (app) => `${app} फ़ाइल प्रोसेस नहीं की जा सकी. कृपया फिर से कोशिश करें.`,
    type: (app) => `असमर्थित ${app} फ़ाइल.`,
    loadingCopy: (app) => `बड़ी ${app} फ़ाइल की प्रतिलिपि बनाई जा रही है...`,
    loadingInspect: (app) => `${app} संरचना की जाँच की जा रही है...`,
    processingLarge: (app) => `बड़ी ${app} फ़ाइल प्रोसेस की जा रही है...`,
  },
  "it-IT": {
    exportTitle: "Qualità di esportazione",
    exportDesc:
      "L’esportazione gratuita usa Standard. Rimuovi le pubblicità per sbloccare la scelta tra esportazione senza perdita e compressa.",
    closeTitle: "Chiudi per ora",
    closeDesc: "Per ora, usa la versione gratuita. Non sei obbligato ad acquistare.",
    loadingPreview: "Caricamento dell’anteprima...",
    processCancelled: "Elaborazione annullata",
    errorSize: "Il file è troppo grande. Massimo {{maxSize}} MB.",
    invalid: (app) => `Copertina ${app} non valida. Tocca per scegliere una nuova immagine.`,
    corrupt: (app) => `Il file ${app} non può essere letto. Prova con un altro file.`,
    noCover: (app) => `Questo file ${app} non contiene una copertina sostituibile.`,
    rewrite: (app) => `Il file ${app} non può essere elaborato. Riprova.`,
    type: (app) => `File ${app} non supportato.`,
    loadingCopy: (app) => `Copia del file ${app} di grandi dimensioni...`,
    loadingInspect: (app) => `Controllo della struttura ${app}...`,
    processingLarge: (app) => `Elaborazione del file ${app} di grandi dimensioni...`,
  },
  "ja-JP": {
    exportTitle: "書き出し品質",
    exportDesc:
      "無料の書き出しでは Standard を使用します。広告を削除すると、ロスレス/圧縮の書き出しを選べます。",
    closeTitle: "いったん閉じる",
    closeDesc: "今は無料版をお使いください。購入は必須ではありません。",
    loadingPreview: "プレビューを読み込み中...",
    processCancelled: "処理がキャンセルされました",
    errorSize: "ファイルが大きすぎます。最大 {{maxSize}} MB。",
    invalid: (app) => `無効な ${app} カバーです。タップして新しい画像を選んでください。`,
    corrupt: (app) => `${app} ファイルを読み取れませんでした。別のファイルをお試しください。`,
    noCover: (app) => `この ${app} ファイルには置き換え可能なカバーが含まれていません。`,
    rewrite: (app) => `${app} ファイルを処理できませんでした。もう一度お試しください。`,
    type: (app) => `未対応の ${app} ファイルです。`,
    loadingCopy: (app) => `大きな ${app} ファイルをコピーしています...`,
    loadingInspect: (app) => `${app} 構造を確認しています...`,
    processingLarge: (app) => `大きな ${app} ファイルを処理しています...`,
  },
  "ko-KR": {
    exportTitle: "내보내기 품질",
    exportDesc:
      "무료 내보내기는 Standard를 사용합니다. 광고를 제거하면 무손실/압축 내보내기를 선택할 수 있습니다.",
    closeTitle: "일단 닫기",
    closeDesc: "지금은 무료 버전을 이용하세요. 구매는 필수가 아닙니다.",
    loadingPreview: "미리보기를 불러오는 중...",
    processCancelled: "처리가 취소되었습니다",
    errorSize: "파일이 너무 큽니다. 최대 {{maxSize}} MB.",
    invalid: (app) => `유효하지 않은 ${app} 표지입니다. 탭하여 새 이미지를 선택하세요.`,
    corrupt: (app) => `${app} 파일을 읽을 수 없습니다. 다른 파일을 시도해 보세요.`,
    noCover: (app) => `이 ${app} 파일에는 교체 가능한 표지가 없습니다.`,
    rewrite: (app) => `${app} 파일을 처리할 수 없습니다. 다시 시도하세요.`,
    type: (app) => `지원되지 않는 ${app} 파일입니다.`,
    loadingCopy: (app) => `큰 ${app} 파일을 복사하는 중...`,
    loadingInspect: (app) => `${app} 구조를 검사하는 중...`,
    processingLarge: (app) => `큰 ${app} 파일을 처리하는 중...`,
  },
  "pt-BR": {
    exportTitle: "Qualidade da exportação",
    exportDesc:
      "A exportação gratuita usa Standard. Remova os anúncios para desbloquear a escolha entre exportação sem perda e compactada.",
    closeTitle: "Fechar por enquanto",
    closeDesc: "Por enquanto, aproveite a versão gratuita. Você não é obrigado a comprar.",
    loadingPreview: "Carregando a prévia...",
    processCancelled: "Processamento cancelado",
    errorSize: "O arquivo é grande demais. Máximo de {{maxSize}} MB.",
    invalid: (app) => `Capa ${app} inválida. Toque para escolher uma nova imagem.`,
    corrupt: (app) => `Não foi possível ler o arquivo ${app}. Tente outro arquivo.`,
    noCover: (app) => `Este arquivo ${app} não contém uma capa substituível.`,
    rewrite: (app) => `Não foi possível processar o arquivo ${app}. Tente novamente.`,
    type: (app) => `Arquivo ${app} não compatível.`,
    loadingCopy: (app) => `Copiando ${app} grande...`,
    loadingInspect: (app) => `Inspecionando a estrutura de ${app}...`,
    processingLarge: (app) => `Processando ${app} grande...`,
  },
  "ru-RU": {
    exportTitle: "Качество экспорта",
    exportDesc:
      "Бесплатный экспорт использует Standard. Уберите рекламу, чтобы выбрать экспорт без потерь или сжатый.",
    closeTitle: "Закрыть пока",
    closeDesc: "Пока что пользуйтесь бесплатной версией. Покупка не обязательна.",
    loadingPreview: "Загрузка предпросмотра...",
    processCancelled: "Обработка отменена",
    errorSize: "Файл слишком большой. Максимум {{maxSize}} МБ.",
    invalid: (app) => `Неверная обложка ${app}. Нажмите, чтобы выбрать новое изображение.`,
    corrupt: (app) => `Не удалось прочитать файл ${app}. Попробуйте другой файл.`,
    noCover: (app) => `В этом файле ${app} нет заменяемой обложки.`,
    rewrite: (app) => `Не удалось обработать файл ${app}. Попробуйте еще раз.`,
    type: (app) => `Неподдерживаемый файл ${app}.`,
    loadingCopy: (app) => `Копирование большого файла ${app}...`,
    loadingInspect: (app) => `Проверка структуры ${app}...`,
    processingLarge: (app) => `Обработка большого файла ${app}...`,
  },
  "zh-CN": {
    exportTitle: "导出质量",
    exportDesc: "免费导出使用 Standard。移除广告后即可选择无损/压缩导出。",
    closeTitle: "暂时关闭",
    closeDesc: "目前先使用免费版即可。你不必购买。",
    loadingPreview: "正在加载预览...",
    processCancelled: "处理已取消",
    errorSize: "文件太大。最大 {{maxSize}} MB。",
    invalid: (app) => `无效的 ${app} 封面。点击选择新图片。`,
    corrupt: (app) => `无法读取 ${app} 文件。请尝试其他文件。`,
    noCover: (app) => `此 ${app} 文件不包含可替换的封面。`,
    rewrite: (app) => `无法处理 ${app} 文件。请重试。`,
    type: (app) => `不受支持的 ${app} 文件。`,
    loadingCopy: (app) => `正在复制大型 ${app} 文件...`,
    loadingInspect: (app) => `正在检查 ${app} 结构...`,
    processingLarge: (app) => `正在处理大型 ${app} 文件...`,
  },
  "zh-TW": {
    exportTitle: "匯出品質",
    exportDesc: "免費匯出會使用 Standard。移除廣告即可解鎖無損／壓縮匯出選項。",
    closeTitle: "暫時關閉",
    closeDesc: "目前先使用免費版即可。你不一定要購買。",
    loadingPreview: "正在載入預覽...",
    processCancelled: "處理已取消",
    errorSize: "檔案太大。最大 {{maxSize}} MB。",
    invalid: (app) => `無效的 ${app} 封面。點一下以選擇新圖片。`,
    corrupt: (app) => `無法讀取 ${app} 檔案。請嘗試其他檔案。`,
    noCover: (app) => `此 ${app} 檔案不包含可替換的封面。`,
    rewrite: (app) => `無法處理 ${app} 檔案。請再試一次。`,
    type: (app) => `不支援的 ${app} 檔案。`,
    loadingCopy: (app) => `正在複製大型 ${app} 檔案...`,
    loadingInspect: (app) => `正在檢查 ${app} 結構...`,
    processingLarge: (app) => `正在處理大型 ${app} 檔案...`,
  },
};

const coverModeTexts = {
  "ar-SA": {
    title: "إجراء صفحة الغلاف",
    description: "اختر ما إذا كنت تريد إدراج صفحة أولى جديدة أو استبدال الصفحة الأولى الحالية.",
  },
  "de-DE": {
    title: "Aktion für die Titelseite",
    description:
      "Wähle, ob du eine neue erste Seite einfügen oder die aktuelle erste Seite ersetzen möchtest.",
  },
  "fr-FR": {
    title: "Action de la page de couverture",
    description:
      "Choisissez d’insérer une nouvelle première page ou de remplacer la première page actuelle.",
  },
  "hi-IN": {
    title: "कवर पेज क्रिया",
    description:
      "चुनें कि नई पहली पृष्ठ जोड़ना है या मौजूदा पहली पृष्ठ को बदलना है.",
  },
  "it-IT": {
    title: "Azione pagina di copertina",
    description:
      "Scegli se inserire una nuova prima pagina o sostituire quella attuale.",
  },
  "ja-JP": {
    title: "表紙ページの操作",
    description:
      "新しい1ページ目を挿入するか、現在の1ページ目を置き換えるかを選んでください。",
  },
  "ko-KR": {
    title: "표지 페이지 동작",
    description:
      "새 첫 페이지를 삽입할지 현재 첫 페이지를 바꿀지 선택하세요.",
  },
  "pt-BR": {
    title: "Ação da página de capa",
    description:
      "Escolha se deseja inserir uma nova primeira página ou substituir a primeira página atual.",
  },
  "ru-RU": {
    title: "Действие со страницей обложки",
    description:
      "Выберите, вставить ли новую первую страницу или заменить текущую первую страницу.",
  },
  "zh-CN": {
    title: "封面页操作",
    description: "选择是插入新的第一页还是替换当前第一页。",
  },
  "zh-TW": {
    title: "封面頁動作",
    description: "選擇要插入新的第一頁，還是取代目前的第一頁。",
  },
};

const privacyTexts = {
  "ar-SA": {
    hint: "تحكم في كيفية التعامل مع البيانات والإعلانات",
    options: "خيارات الخصوصية",
    policy: "سياسة الخصوصية",
    section: "الخصوصية",
  },
  "de-DE": {
    hint: "Steuere, wie mit Daten und Werbung umgegangen wird",
    options: "Datenschutzoptionen",
    policy: "Datenschutzrichtlinie",
    section: "Datenschutz",
  },
  "fr-FR": {
    hint: "Contrôlez la manière dont les données et la publicité sont gérées",
    options: "Options de confidentialité",
    policy: "Politique de confidentialité",
    section: "Confidentialité",
  },
  "hi-IN": {
    hint: "डेटा और विज्ञापनों को कैसे संभाला जाता है, इसे नियंत्रित करें",
    options: "गोपनीयता विकल्प",
    policy: "गोपनीयता नीति",
    section: "गोपनीयता",
  },
  "it-IT": {
    hint: "Controlla come vengono gestiti i dati e la pubblicità",
    options: "Opzioni privacy",
    policy: "Informativa sulla privacy",
    section: "Privacy",
  },
  "ja-JP": {
    hint: "データと広告の扱いを管理します",
    options: "プライバシー設定",
    policy: "プライバシーポリシー",
    section: "プライバシー",
  },
  "ko-KR": {
    hint: "데이터와 광고 처리 방식을 제어합니다",
    options: "개인정보 옵션",
    policy: "개인정보 처리방침",
    section: "개인정보",
  },
  "pt-BR": {
    hint: "Controle como os dados e os anúncios são tratados",
    options: "Opções de privacidade",
    policy: "Política de privacidade",
    section: "Privacidade",
  },
  "ru-RU": {
    hint: "Управляйте тем, как обрабатываются данные и реклама",
    options: "Параметры конфиденциальности",
    policy: "Политика конфиденциальности",
    section: "Конфиденциальность",
  },
  "zh-CN": {
    hint: "控制数据和广告的处理方式",
    options: "隐私选项",
    policy: "隐私政策",
    section: "隐私",
  },
  "zh-TW": {
    hint: "控制資料和廣告的處理方式",
    options: "隱私選項",
    policy: "隱私權政策",
    section: "隱私",
  },
};

const epubFixerErrorAliasKeys = [
  "ERROR_LOAD",
  "ERROR_PREVIEW",
  "ERROR_OPEN",
  "ERROR_SHARE",
  "ERROR_DELETE",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function setPath(target, dottedPath, value) {
  const parts = dottedPath.split(".");
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!current[key] || typeof current[key] !== "object" || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

function patchCommonTour(target, pack) {
  setPath(target, "HOME_TOUR.STEPS.EXPORT.TITLE", pack.exportTitle);
  setPath(target, "HOME_TOUR.STEPS.EXPORT.DESCRIPTION", pack.exportDesc);
  setPath(target, "HOME_TOUR.STEPS.REMOVE_ADS_CLOSE.TITLE", pack.closeTitle);
  setPath(target, "HOME_TOUR.STEPS.REMOVE_ADS_CLOSE.DESCRIPTION", pack.closeDesc);
}

function patchAppLocale(target, appKey, locale, pack, options = {}) {
  patchCommonTour(target, pack);

  if (appKey === "cover-creator-for-kindle") {
    return;
  }

  const appLabel = appKey === "epub-cover-changer" ? "EPUB" : "PDF";
  const appPrefix = appLabel;

  if (options.includeCoverMode) {
    const coverMode = coverModeTexts[locale];
    if (coverMode) {
      setPath(target, "HOME_TOUR.STEPS.COVER_MODE.TITLE", coverMode.title);
      setPath(
        target,
        "HOME_TOUR.STEPS.COVER_MODE.DESCRIPTION",
        coverMode.description
      );
    }
  }

  setPath(target, "COVERS.LOADING_PREVIEW", pack.loadingPreview);
  setPath(
    target,
    `CHANGE.IMAGE_WARN_INVALID_${appPrefix}_COVER`,
    pack.invalid(appLabel)
  );
  setPath(target, `CHANGE.${appPrefix}_ERROR_CORRUPT`, pack.corrupt(appLabel));
  setPath(target, `CHANGE.${appPrefix}_ERROR_NO_COVER`, pack.noCover(appLabel));
  setPath(target, `CHANGE.${appPrefix}_ERROR_REWRITE`, pack.rewrite(appLabel));
  setPath(target, `CHANGE.${appPrefix}_ERROR_SIZE`, pack.errorSize);
  setPath(target, `CHANGE.${appPrefix}_ERROR_TYPE`, pack.type(appLabel));
  setPath(
    target,
    `CHANGE.${appPrefix}_LOADING_COPY`,
    pack.loadingCopy(appLabel)
  );
  setPath(
    target,
    `CHANGE.${appPrefix}_LOADING_INSPECT`,
    pack.loadingInspect(appLabel)
  );
  setPath(
    target,
    `CHANGE.PROCESSING_LARGE_${appPrefix}`,
    pack.processingLarge(appLabel)
  );
  setPath(target, "CHANGE.PROCESS_CANCELLED", pack.processCancelled);
}

function patchAndroidPrivacy(target, locale) {
  const pack = privacyTexts[locale];
  if (!pack) {
    return;
  }

  setPath(target, "SETTINGS.PRIVACY_HINT", pack.hint);
  setPath(target, "SETTINGS.PRIVACY_OPTIONS", pack.options);
  setPath(target, "SETTINGS.PRIVACY_POLICY", pack.policy);
  setPath(target, "SETTINGS.PRIVACY_SECTION", pack.section);
}

function patchEpubFixerLocale(target) {
  const my = target.MY_EPUBS || {};
  target.MY_EPUBS = {
    TITLE: my.TITLE,
    EMPTY: my.EMPTY,
    PLACEHOLDER: my.PLACEHOLDER,
    PREVIEW_TITLE: my.PREVIEW_TITLE,
    PREVIEW_UNAVAILABLE: my.PREVIEW_UNAVAILABLE,
    REGENERATE_PREVIEW: my.REGENERATE_PREVIEW,
    GETTING_COVER: my.GETTING_COVER,
    LOADING_PREVIEW: my.LOADING_PREVIEW,
    ACTION_OPEN: my.ACTION_OPEN,
    ACTION_EDIT: my.ACTION_EDIT,
    ACTION_SHARE: my.ACTION_SHARE,
    ACTION_DELETE: my.ACTION_DELETE,
    DELETE_TITLE: my.DELETE_TITLE,
    DELETE_MESSAGE: my.DELETE_MESSAGE,
    DELETED: my.DELETED,
    ERROR: my.ERROR,
    "ERROR.LOAD": my.ERROR_LOAD,
    "ERROR.PREVIEW": my.ERROR_PREVIEW,
    "ERROR.OPEN": my.ERROR_OPEN,
    "ERROR.SHARE": my.ERROR_SHARE,
    "ERROR.DELETE": my.ERROR_DELETE,
    EMPTY_TITLE: my.EMPTY_TITLE,
    EMPTY_BODY: my.EMPTY_BODY,
    GO_TO_FIXER: my.GO_TO_FIXER,
  };

  delete target.HOME_TOUR;
  delete target.COVERS;
  delete target.CHANGE;
}

function mirrorToCopies(sourcePath, appRoot) {
  const rel = path.relative(path.join(repoRoot, appRoot, "src", "assets", "i18n"), sourcePath);
  const mirrors = [
    path.join(repoRoot, appRoot, "www", "assets", "i18n", rel),
    path.join(
      repoRoot,
      appRoot,
      "android",
      "app",
      "src",
      "main",
      "assets",
      "public",
      "assets",
      "i18n",
      rel
    ),
  ];

  for (const mirror of mirrors) {
    const parent = path.dirname(mirror);
    if (fs.existsSync(parent)) {
      fs.copyFileSync(sourcePath, mirror);
    }
  }
}

for (const appRoot of appRoots) {
  const srcDir = path.join(repoRoot, appRoot, "src", "assets", "i18n");
  if (!fs.existsSync(srcDir)) {
    continue;
  }

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name === "en-US.json") {
      continue;
    }

    const locale = path.basename(entry.name, ".json");
    const pack = localePacks[locale];
    if (!pack) {
      continue;
    }

    const filePath = path.join(srcDir, entry.name);

    const appName = appRoot.split("/").pop();
    if (appName === "epub-fixer") {
      const headPath = `${appRoot}/src/assets/i18n/${entry.name}`;
      const headRaw = execFileSync("git", ["show", `HEAD:${headPath}`], {
        encoding: "utf8",
      }).replace(/^\uFEFF/, "");
      const headJson = JSON.parse(headRaw);
      const myEpubs = headJson?.MY_EPUBS;
      if (myEpubs && typeof myEpubs === "object") {
        for (const aliasKey of epubFixerErrorAliasKeys) {
          delete myEpubs[aliasKey];
        }
      }
      writeJson(filePath, deepRepair(headJson));
      mirrorToCopies(filePath, appRoot);
      console.log(
        `synced ${path.relative(repoRoot, filePath).split(path.sep).join("/")}`
      );
      continue;
    }

    const json = readJson(filePath);

    if (appName === "pdf-cover-maker") {
      patchAppLocale(json, appName, locale, pack, { includeCoverMode: true });
    } else {
      patchAppLocale(json, appName, locale, pack);
    }

    writeJson(filePath, json);
    mirrorToCopies(filePath, appRoot);

    const androidLocalePath = path.join(
      repoRoot,
      appRoot,
      "android",
      "app",
      "src",
      "main",
      "assets",
      "public",
      "assets",
      "i18n",
      entry.name
    );
    if (fs.existsSync(androidLocalePath)) {
      const androidJson = readJson(androidLocalePath);
      if (appName === "pdf-cover-maker") {
        // The Android bundle keeps a privacy section plus the PDF cover-mode tour.
        patchAppLocale(androidJson, appName, locale, pack, { includeCoverMode: true });
        patchAndroidPrivacy(androidJson, locale);
      } else if (
        appName === "cover-creator-for-kindle" ||
        appName === "epub-cover-changer"
      ) {
        patchAppLocale(androidJson, appName, locale, pack);
        patchAndroidPrivacy(androidJson, locale);
      } else {
        patchAppLocale(androidJson, appName, locale, pack);
      }
      writeJson(androidLocalePath, androidJson);
    }
    console.log(`synced ${path.relative(repoRoot, filePath).split(path.sep).join("/")}`);
  }
}
