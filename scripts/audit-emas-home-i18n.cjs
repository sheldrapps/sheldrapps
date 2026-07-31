const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const localeDir = path.join(root, 'apps', 'epub-merger-and-splitter', 'src', 'assets', 'i18n');

const localized = {
  'ar-SA': {
    confirm: 'تأكيد', how: 'كيفية التقسيم', chapters: 'حسب الفصول أو الأقسام', chapterSub: 'استخدم فهرس الكتاب.', manual: 'اختيار نقاط التقسيم', manualSub: 'اجمع الفصول يدويًا.', equal: 'أجزاء متساوية', equalSub: 'اختر عدد ملفات EPUB المراد إنشاؤها.', maximum: 'حسب الحجم الأقصى', maximumSub: 'أنشئ ملفات ضمن حجم تقريبي.', splitQuestion: 'كيف تريد تقسيم ملف EPUB هذا؟', analysis: 'تعذر تحليل فهرس ملف EPUB.', unavailable: 'الإعداد جاهز، لكن تصدير ملفات EPUB المقسمة غير متاح بعد.', title: 'تأكيد طريقة التقسيم', back: '← كيفية التقسيم', action: 'تقسيم EPUB →', byChapters: 'حسب الفصول', bySections: 'حسب الأقسام', bookStart: 'بداية الكتاب', splitHere: '+ تقسيم هنا', divided: '✓ تم التقسيم', output: 'EPUB {{number}}', fewer: 'عرض أقل', more: 'عرض كل ملفات EPUB وعددها {{count}}', chaptersUnit: 'فصول', parts: 'أجزاء', size: 'الحجم الأقصى', custom: 'مخصص', partOne: 'الجزء الأول', partTwo: 'الجزء الثاني', chapterOne: 'الفصل 1', chapterTwo: 'الفصل 2', chapterThree: 'الفصل 3', chapterFour: 'الفصل 4'
  },
  'de-DE': {
    confirm: 'Bestätigen', how: 'Teilungsmethode', chapters: 'Nach Kapiteln oder Abschnitten', chapterSub: 'Nutze das Inhaltsverzeichnis des Buchs.', manual: 'Teilungspunkte auswählen', manualSub: 'Kapitel manuell gruppieren.', equal: 'Gleich große Teile', equalSub: 'Wähle die Anzahl der EPUB-Dateien.', maximum: 'Nach maximaler Größe', maximumSub: 'Erstelle Dateien mit ungefähr begrenzter Größe.', splitQuestion: 'Wie möchtest du dieses EPUB aufteilen?', analysis: 'Das Inhaltsverzeichnis des EPUB konnte nicht analysiert werden.', unavailable: 'Die Konfiguration ist bereit, aber der Export geteilter EPUB-Dateien ist noch nicht verfügbar.', title: 'Teilung bestätigen', back: '← Teilungsmethode', action: 'EPUB aufteilen →', byChapters: 'Nach Kapiteln', bySections: 'Nach Abschnitten', bookStart: 'Buchanfang', splitHere: '+ Hier teilen', divided: '✓ Geteilt', output: 'EPUB {{number}}', fewer: 'Weniger anzeigen', more: 'Alle {{count}} EPUB-Dateien anzeigen', chaptersUnit: 'Kapitel', parts: 'Teile', size: 'Maximale Größe', custom: 'Benutzerdefiniert', partOne: 'Teil I', partTwo: 'Teil II', chapterOne: 'Kapitel 1', chapterTwo: 'Kapitel 2', chapterThree: 'Kapitel 3', chapterFour: 'Kapitel 4'
  },
  'fr-FR': {
    confirm: 'Confirmer', how: 'Méthode de division', chapters: 'Par chapitres ou sections', chapterSub: 'Utilisez la table des matières du livre.', manual: 'Choisir les points de division', manualSub: 'Regroupez les chapitres manuellement.', equal: 'Parts égales', equalSub: 'Choisissez le nombre d’EPUB à créer.', maximum: 'Par taille maximale', maximumSub: 'Créez des fichiers sous une taille approximative.', splitQuestion: 'Comment souhaitez-vous diviser cet EPUB ?', analysis: 'La table des matières de l’EPUB n’a pas pu être analysée.', unavailable: 'La configuration est prête, mais l’export des EPUB divisés n’est pas encore disponible.', title: 'Confirmer la division', back: '← Méthode de division', action: 'Diviser l’EPUB →', byChapters: 'Par chapitres', bySections: 'Par sections', bookStart: 'Début du livre', splitHere: '+ Diviser ici', divided: '✓ Divisé', output: 'EPUB {{number}}', fewer: 'Afficher moins', more: 'Afficher les {{count}} EPUB', chaptersUnit: 'chapitres', parts: 'parts', size: 'Taille maximale', custom: 'Personnalisé', partOne: 'Partie I', partTwo: 'Partie II', chapterOne: 'Chapitre 1', chapterTwo: 'Chapitre 2', chapterThree: 'Chapitre 3', chapterFour: 'Chapitre 4'
  },
  'it-IT': {
    confirm: 'Conferma', how: 'Metodo di divisione', chapters: 'Per capitoli o sezioni', chapterSub: 'Usa l’indice del libro.', manual: 'Scegli i punti di divisione', manualSub: 'Raggruppa i capitoli manualmente.', equal: 'Parti uguali', equalSub: 'Scegli quanti EPUB creare.', maximum: 'Per dimensione massima', maximumSub: 'Crea file entro una dimensione approssimativa.', splitQuestion: 'Come vuoi dividere questo EPUB?', analysis: 'Non è stato possibile analizzare l’indice dell’EPUB.', unavailable: 'La configurazione è pronta, ma l’esportazione degli EPUB divisi non è ancora disponibile.', title: 'Conferma la divisione', back: '← Metodo di divisione', action: 'Dividi EPUB →', byChapters: 'Per capitoli', bySections: 'Per sezioni', bookStart: 'Inizio del libro', splitHere: '+ Dividi qui', divided: '✓ Diviso', output: 'EPUB {{number}}', fewer: 'Mostra meno', more: 'Mostra tutti i {{count}} EPUB', chaptersUnit: 'capitoli', parts: 'parti', size: 'Dimensione massima', custom: 'Personalizzato', partOne: 'Parte I', partTwo: 'Parte II', chapterOne: 'Capitolo 1', chapterTwo: 'Capitolo 2', chapterThree: 'Capitolo 3', chapterFour: 'Capitolo 4'
  },
  'pt-BR': {
    confirm: 'Confirmar', how: 'Método de divisão', chapters: 'Por capítulos ou seções', chapterSub: 'Use o índice do livro.', manual: 'Escolher pontos de divisão', manualSub: 'Agrupe os capítulos manualmente.', equal: 'Partes iguais', equalSub: 'Escolha quantos EPUBs criar.', maximum: 'Por tamanho máximo', maximumSub: 'Crie arquivos dentro de um tamanho aproximado.', splitQuestion: 'Como você quer dividir este EPUB?', analysis: 'Não foi possível analisar o índice do EPUB.', unavailable: 'A configuração está pronta, mas a exportação de EPUBs divididos ainda não está disponível.', title: 'Confirmar a divisão', back: '← Método de divisão', action: 'Dividir EPUB →', byChapters: 'Por capítulos', bySections: 'Por seções', bookStart: 'Início do livro', splitHere: '+ Dividir aqui', divided: '✓ Dividido', output: 'EPUB {{number}}', fewer: 'Mostrar menos', more: 'Ver todos os {{count}} EPUBs', chaptersUnit: 'capítulos', parts: 'partes', size: 'Tamanho máximo', custom: 'Personalizado', partOne: 'Parte I', partTwo: 'Parte II', chapterOne: 'Capítulo 1', chapterTwo: 'Capítulo 2', chapterThree: 'Capítulo 3', chapterFour: 'Capítulo 4'
  },
  'ru-RU': {
    confirm: 'Подтвердить', how: 'Способ разделения', chapters: 'По главам или разделам', chapterSub: 'Используйте оглавление книги.', manual: 'Выбрать точки разделения', manualSub: 'Группируйте главы вручную.', equal: 'Равные части', equalSub: 'Выберите количество EPUB.', maximum: 'По максимальному размеру', maximumSub: 'Создавайте файлы примерно заданного размера.', splitQuestion: 'Как разделить этот EPUB?', analysis: 'Не удалось проанализировать оглавление EPUB.', unavailable: 'Настройка готова, но экспорт разделённых EPUB пока недоступен.', title: 'Подтвердите разделение', back: '← Способ разделения', action: 'Разделить EPUB →', byChapters: 'По главам', bySections: 'По разделам', bookStart: 'Начало книги', splitHere: '+ Разделить здесь', divided: '✓ Разделено', output: 'EPUB {{number}}', fewer: 'Показать меньше', more: 'Показать все EPUB ({{count}})', chaptersUnit: 'глав', parts: 'части', size: 'Максимальный размер', custom: 'Вручную', partOne: 'Часть I', partTwo: 'Часть II', chapterOne: 'Глава 1', chapterTwo: 'Глава 2', chapterThree: 'Глава 3', chapterFour: 'Глава 4'
  },
  'ja-JP': {
    confirm: '確認', how: '分割方法', chapters: '章またはセクションごと', chapterSub: '本の目次を使用します。', manual: '分割位置を選択', manualSub: '章を手動でグループ化します。', equal: '均等な分割', equalSub: '作成するEPUBの数を選択します。', maximum: '最大サイズごと', maximumSub: 'おおよそのサイズ以内でファイルを作成します。', splitQuestion: 'このEPUBをどのように分割しますか？', analysis: 'EPUBの目次を解析できませんでした。', unavailable: '設定は完了しましたが、分割したEPUBの書き出しはまだ利用できません。', title: '分割方法を確認', back: '← 分割方法', action: 'EPUBを分割 →', byChapters: '章ごと', bySections: 'セクションごと', bookStart: '本の先頭', splitHere: '+ ここで分割', divided: '✓ 分割済み', output: 'EPUB {{number}}', fewer: '少なく表示', more: '{{count}}個のEPUBをすべて表示', chaptersUnit: '章', parts: 'パート', size: '最大サイズ', custom: 'カスタム', partOne: 'パートI', partTwo: 'パートII', chapterOne: '第1章', chapterTwo: '第2章', chapterThree: '第3章', chapterFour: '第4章'
  },
  'ko-KR': {
    confirm: '확인', how: '분할 방법', chapters: '챕터 또는 섹션별', chapterSub: '책의 목차를 사용합니다.', manual: '분할 지점 선택', manualSub: '챕터를 직접 묶습니다.', equal: '같은 크기의 부분', equalSub: '만들 EPUB 수를 선택합니다.', maximum: '최대 파일 크기별', maximumSub: '대략적인 크기 이하로 파일을 만듭니다.', splitQuestion: '이 EPUB을 어떻게 분할할까요?', analysis: 'EPUB 목차를 분석할 수 없습니다.', unavailable: '설정은 완료되었지만 분할된 EPUB 내보내기는 아직 사용할 수 없습니다.', title: '분할 방법 확인', back: '← 분할 방법', action: 'EPUB 분할 →', byChapters: '챕터별', bySections: '섹션별', bookStart: '책 시작', splitHere: '+ 여기서 분할', divided: '✓ 분할됨', output: 'EPUB {{number}}', fewer: '간단히 보기', more: '{{count}}개 EPUB 모두 보기', chaptersUnit: '챕터', parts: '부분', size: '최대 크기', custom: '사용자 지정', partOne: '파트 I', partTwo: '파트 II', chapterOne: '챕터 1', chapterTwo: '챕터 2', chapterThree: '챕터 3', chapterFour: '챕터 4'
  },
  'zh-CN': {
    confirm: '确认', how: '拆分方式', chapters: '按章节或部分', chapterSub: '使用书籍目录。', manual: '选择拆分点', manualSub: '手动组合章节。', equal: '均等分段', equalSub: '选择要创建的EPUB数量。', maximum: '按最大大小', maximumSub: '创建大致不超过指定大小的文件。', splitQuestion: '你想如何拆分这个EPUB？', analysis: '无法分析EPUB的目录。', unavailable: '配置已准备好，但拆分EPUB导出功能尚不可用。', title: '确认拆分方式', back: '← 拆分方式', action: '拆分EPUB →', byChapters: '按章节', bySections: '按部分', bookStart: '书籍开头', splitHere: '+ 在此拆分', divided: '✓ 已拆分', output: 'EPUB {{number}}', fewer: '显示更少', more: '查看全部{{count}}个EPUB', chaptersUnit: '章节', parts: '部分', size: '最大大小', custom: '自定义', partOne: '第一部分', partTwo: '第二部分', chapterOne: '第1章', chapterTwo: '第2章', chapterThree: '第3章', chapterFour: '第4章'
  },
  'zh-TW': {
    confirm: '確認', how: '拆分方式', chapters: '依章節或部分', chapterSub: '使用書籍目錄。', manual: '選擇拆分點', manualSub: '手動組合章節。', equal: '平均分段', equalSub: '選擇要建立的EPUB數量。', maximum: '依最大大小', maximumSub: '建立大約不超過指定大小的檔案。', splitQuestion: '你想如何拆分這個EPUB？', analysis: '無法分析EPUB的目錄。', unavailable: '設定已準備好，但拆分EPUB匯出功能尚不可用。', title: '確認拆分方式', back: '← 拆分方式', action: '拆分EPUB →', byChapters: '依章節', bySections: '依部分', bookStart: '書籍開頭', splitHere: '+ 在此拆分', divided: '✓ 已拆分', output: 'EPUB {{number}}', fewer: '顯示較少', more: '查看全部{{count}}個EPUB', chaptersUnit: '章節', parts: '部分', size: '最大大小', custom: '自訂', partOne: '第一部分', partTwo: '第二部分', chapterOne: '第1章', chapterTwo: '第2章', chapterThree: '第3章', chapterFour: '第4章'
  },
  'hi-IN': {
    confirm: 'पुष्टि करें', how: 'विभाजन का तरीका', chapters: 'अध्याय या अनुभाग के अनुसार', chapterSub: 'पुस्तक की विषय-सूची का उपयोग करें।', manual: 'विभाजन बिंदु चुनें', manualSub: 'अध्यायों को मैन्युअल रूप से समूहित करें।', equal: 'समान भाग', equalSub: 'बनाए जाने वाले EPUB की संख्या चुनें।', maximum: 'अधिकतम आकार के अनुसार', maximumSub: 'लगभग निर्धारित आकार तक फ़ाइलें बनाएँ।', splitQuestion: 'इस EPUB को कैसे विभाजित करना चाहते हैं?', analysis: 'EPUB की विषय-सूची का विश्लेषण नहीं हो सका।', unavailable: 'कॉन्फ़िगरेशन तैयार है, लेकिन विभाजित EPUB का निर्यात अभी उपलब्ध नहीं है।', title: 'विभाजन की पुष्टि करें', back: '← विभाजन का तरीका', action: 'EPUB विभाजित करें →', byChapters: 'अध्याय के अनुसार', bySections: 'अनुभाग के अनुसार', bookStart: 'पुस्तक की शुरुआत', splitHere: '+ यहाँ विभाजित करें', divided: '✓ विभाजित', output: 'EPUB {{number}}', fewer: 'कम दिखाएँ', more: 'सभी {{count}} EPUB देखें', chaptersUnit: 'अध्याय', parts: 'भाग', size: 'अधिकतम आकार', custom: 'कस्टम', partOne: 'भाग I', partTwo: 'भाग II', chapterOne: 'अध्याय 1', chapterTwo: 'अध्याय 2', chapterThree: 'अध्याय 3', chapterFour: 'अध्याय 4'
  }
};

const set = (object, keyPath, value) => {
  const parts = keyPath.split('.');
  let cursor = object;
  for (const part of parts.slice(0, -1)) {
    cursor[part] ??= {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
};

for (const [locale, words] of Object.entries(localized)) {
  const file = path.join(localeDir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  data.HOME.STEPPER.CONFIRM = words.confirm;
  data.HOME.SPLIT_OPTIONS = {
    BY_CHAPTERS_OR_SECTIONS: { TITLE: words.chapters, SUBLINE: words.chapterSub },
    MANUAL_SPLIT_POINTS: { TITLE: words.manual, SUBLINE: words.manualSub },
    EQUAL_PARTS: { TITLE: words.equal, SUBLINE: words.equalSub },
    MAXIMUM_FILE_SIZE: { TITLE: words.maximum, SUBLINE: words.maximumSub },
  };
  data.HOME.SPLIT_HOW_TO = words.how;
  data.HOME.SPLIT_HOW_TO_TITLE = words.splitQuestion;
  data.HOME.SPLIT_ANALYSIS_ERROR = words.analysis;
  data.HOME.SPLIT_EXPORT_NOT_AVAILABLE = words.unavailable;

  const confirm = {
    BY_CHAPTERS_TITLE: words.splitQuestion,
    MANUAL_TITLE: words.manual,
    EQUAL_TITLE: words.equal,
    MAXIMUM_SIZE_TITLE: words.maximum,
    FILE_SUMMARY: '{{name}} · {{count}} · {{size}}',
    ANALYZING: words.analysis,
    BY_CHAPTER: words.byChapters,
    BY_CHAPTER_SUBLINE: words.chapterSub,
    BY_SECTION: words.bySections,
    BY_SECTION_SUBLINE: words.chapterSub,
    BOOK_START: words.bookStart,
    BOOK_START_SUBLINE: words.bookStart,
    BEFORE_CHAPTER: '{{title}}',
    BEFORE_CHAPTER_SUBLINE: words.splitHere,
    EQUAL_HELP: words.equalSub,
    PART_COUNT: '{{count}}',
    PART_COUNT_SUBLINE: words.parts,
    CUSTOM_PART_COUNT: words.custom,
    CUSTOM_PART_COUNT_SUBLINE: words.custom,
    INVALID_PART_COUNT: words.custom,
    MAXIMUM_SIZE_HELP: words.maximumSub,
    MAXIMUM_SIZE_OPTION: '{{size}} MB',
    MAXIMUM_SIZE_OPTION_SUBLINE: words.maximumSub,
    CUSTOM_SIZE: words.custom,
    CUSTOM_SIZE_SUBLINE: words.custom,
    INVALID_MAXIMUM_SIZE: words.custom,
    ESTIMATED_RESULT: '{{count}} EPUB',
    OUTPUT_NUMBER: words.output,
    MORE_OUTPUTS: words.more,
    SHOW_FEWER_OUTPUTS: words.fewer,
    NEEDS_TWO_OUTPUTS: words.equalSub,
    BACK_TO_HOW_TO: words.back,
    SPLIT_EPUB: words.action,
    TITLE: words.title,
    SAFE_SPLIT_HINT: words.chapterSub,
    TREE_LABEL: words.how,
    VARIANT_LABEL: words.how,
    ONE_PER_CHAPTER: words.byChapters,
    ONE_PER_SECTION: words.bySections,
    MANUAL_HINT: words.manualSub,
    SPLIT_HERE: words.splitHere,
    DIVIDED: words.divided,
    EQUAL_HINT: words.equalSub,
    EQUAL_MODE_LABEL: words.equal,
    RESULT_COUNT: words.equal,
    PARTS_UNIT: words.parts,
    MEGABYTES_UNIT: 'MB',
    CHAPTERS_PER_FILE: words.chapters,
    SIZE_HINT: words.maximumSub,
    SIZE_LABEL: words.size,
    SIZE_10: '10 MB',
    SIZE_25: '25 MB',
    SIZE_50: '50 MB',
    SIZE_CUSTOM: words.custom,
    APPROXIMATE_SIZE: words.maximumSub,
    EXAMPLE_PART_ONE: words.partOne,
    EXAMPLE_CHAPTER_ONE: words.chapterOne,
    EXAMPLE_CHAPTER_TWO: words.chapterTwo,
    EXAMPLE_PART_TWO: words.partTwo,
    EXAMPLE_CHAPTER_THREE: words.chapterThree,
    EXAMPLE_CHAPTER_FOUR: words.chapterFour,
  };
  data.HOME.SPLIT_CONFIRM = confirm;

  const appNames = {
    'ar-SA': 'تغيير غلاف EPUB', 'de-DE': 'EPUB-Cover ändern', 'es-MX': 'Cambiar portada de EPUB', 'fr-FR': 'Changer la couverture EPUB',
    'hi-IN': 'EPUB कवर बदलें', 'it-IT': 'Cambiare copertina EPUB', 'ja-JP': 'EPUB表紙チェンジャー',
    'ko-KR': 'EPUB 표지 변경기', 'pt-BR': 'Alterar capa do EPUB', 'ru-RU': 'Изменить обложку EPUB',
    'zh-CN': 'EPUB 封面更换工具', 'zh-TW': 'EPUB 封面更換工具'
  };
  data.HOME.SPLIT_COVER.ECC_TITLE = appNames[locale];
  const visibleLabels = {
    'ar-SA': { toc: 'الفهرس', cover: 'الغلاف', preview: 'معاينة', eccDescription: 'ستحصل كل ملفات EPUB على الغلاف نفسه. لتخصيصها بشكل فردي، استخدم تطبيقنا.' },
    'de-DE': { toc: 'Inhaltsverzeichnis', cover: 'Umschlag', preview: 'Vorschau', eccDescription: 'Alle EPUB-Dateien erhalten denselben Umschlag. Für individuelle Anpassungen kannst du unsere App nutzen.' },
    'es-MX': { toc: 'Índice', cover: 'Portada', preview: 'Vista previa', eccDescription: 'Todos tus EPUB tendrán la misma portada. Para personalizarlos individualmente, usa nuestra app.' },
    'fr-FR': { toc: 'Sommaire', cover: 'Couverture', preview: 'Aperçu', eccDescription: 'Tous vos EPUB auront la même couverture. Pour les personnaliser individuellement, utilisez notre application.' },
    'hi-IN': { toc: 'विषय-सूची', cover: 'कवर', preview: 'पूर्वावलोकन', eccDescription: 'सभी EPUB में एक ही कवर होगा। उन्हें अलग-अलग सजाने के लिए हमारा ऐप इस्तेमाल करें।' },
    'it-IT': { toc: 'Indice', cover: 'Copertina', preview: 'Anteprima', eccDescription: 'Tutti i tuoi EPUB avranno la stessa copertina. Per personalizzarli singolarmente, usa la nostra app.' },
    'ja-JP': { toc: '目次', cover: '表紙', preview: 'プレビュー', eccDescription: 'すべてのEPUBに同じ表紙が適用されます。個別にカスタマイズするにはアプリをご利用ください。' },
    'ko-KR': { toc: '목차', cover: '표지', preview: '미리보기', eccDescription: '모든 EPUB에 같은 표지가 적용됩니다. 개별로 꾸미려면 앱을 사용하세요.' },
    'pt-BR': { toc: 'Índice', cover: 'Capa', preview: 'Prévia', eccDescription: 'Todos os seus EPUBs terão a mesma capa. Para personalizá-los individualmente, use nosso aplicativo.' },
    'ru-RU': { toc: 'Оглавление', cover: 'Обложка', preview: 'Предпросмотр', eccDescription: 'Все EPUB получат одну и ту же обложку. Чтобы настроить их отдельно, используйте наше приложение.' },
    'zh-CN': { toc: '目录', cover: '封面', preview: '预览', eccDescription: '所有EPUB都会使用同一封面。如需分别自定义，请使用我们的应用。' },
    'zh-TW': { toc: '目錄', cover: '封面', preview: '預覽', eccDescription: '所有EPUB都會使用同一封面。如需個別自訂，請使用我們的應用程式。' },
  }[locale];
  data.HOME.STEPPER.TOC = visibleLabels.toc;
  data.HOME.STEPPER.COVER = visibleLabels.cover;
  data.HOME.PREVIEW_TITLE = visibleLabels.preview;
  data.HOME.SPLIT_COVER.ECC_DESCRIPTION = visibleLabels.eccDescription;
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const spanishFile = path.join(localeDir, 'es-MX.json');
const spanishData = JSON.parse(fs.readFileSync(spanishFile, 'utf8').replace(/^\uFEFF/, ''));
spanishData.HOME.STEPPER.TOC = 'Índice';
spanishData.HOME.PREVIEW_TITLE = 'Vista previa';
spanishData.HOME.SPLIT_COVER.ECC_TITLE = 'Cambiar portada de EPUB';
fs.writeFileSync(spanishFile, `${JSON.stringify(spanishData, null, 2)}\n`, 'utf8');
