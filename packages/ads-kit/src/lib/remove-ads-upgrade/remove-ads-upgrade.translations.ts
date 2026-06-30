import type { RemoveAdsUpgradeVariant } from './remove-ads-upgrade.types';

type VariantDictionary = Record<
  RemoveAdsUpgradeVariant,
  {
    INTRO?: string;
    TITLE: string;
    BENEFITS: {
      ONE: {
        TITLE: string;
        DESCRIPTION: string;
      };
      TWO: {
        TITLE: string;
        DESCRIPTION: string;
      };
      THREE: {
        TITLE: string;
        DESCRIPTION: string;
      };
    };
  }
>;

export type RemoveAdsUpgradeLocaleDictionary = {
  REMOVE_ADS_UPGRADE: {
    TITLE: VariantDictionary;
    INTRO: string;
    TRUST_LINE: string;
    OFFLINE_TITLE: string;
    OFFLINE_MESSAGE: string;
    PURCHASE: {
      WITH_PRICE: string;
      FALLBACK: string;
    };
    RESTORE_PROMPT: string;
    RESTORE_LABEL: string;
  };
};

type RemoveAdsUpgradeText = RemoveAdsUpgradeLocaleDictionary['REMOVE_ADS_UPGRADE'];

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K];
};

function mergeDeep<T>(base: T, overrides: DeepPartial<T>): T {
  const baseRecord = base as Record<string, unknown>;
  const result: Record<string, unknown> = { ...baseRecord };

  for (const [key, value] of Object.entries(overrides ?? {})) {
    const current = baseRecord[key];
    const canMerge =
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current);

    result[key] = canMerge
      ? mergeDeep(current as never, value as never)
      : value;
  }

  return result as T;
}

function buildLocale(
  overrides: DeepPartial<RemoveAdsUpgradeText>,
): RemoveAdsUpgradeLocaleDictionary {
  return {
    REMOVE_ADS_UPGRADE: mergeDeep(EN_BASE.REMOVE_ADS_UPGRADE, overrides),
  };
}

type PrimaryBenefitCopy = {
  title: string;
  description: string;
};

type VariantBenefitCopy = {
  title: string;
  description: string;
};

type VariantUpgradeCopy = {
  title: string;
  intro: string;
  benefits: {
    ONE: VariantBenefitCopy;
    TWO: VariantBenefitCopy;
    THREE: VariantBenefitCopy;
  };
};

function applyPrimaryBenefitCopy(
  locale: RemoveAdsUpgradeLocaleDictionary,
  copy: PrimaryBenefitCopy,
): RemoveAdsUpgradeLocaleDictionary {
  return mergeDeep(locale, {
    REMOVE_ADS_UPGRADE: {
      TITLE: {
        PCM: {
          BENEFITS: {
            ONE: {
              TITLE: copy.title,
              DESCRIPTION: copy.description,
            },
          },
        },
        ECC: {
          BENEFITS: {
            ONE: {
              TITLE: copy.title,
              DESCRIPTION: copy.description,
            },
          },
        },
      },
    },
  });
}

function applyVariantCopy(
  locale: RemoveAdsUpgradeLocaleDictionary,
  variant: RemoveAdsUpgradeVariant,
  copy: VariantUpgradeCopy,
): RemoveAdsUpgradeLocaleDictionary {
  return mergeDeep(locale, {
    REMOVE_ADS_UPGRADE: {
      TITLE: {
        [variant]: {
          INTRO: copy.intro,
          TITLE: copy.title,
          BENEFITS: {
            ONE: {
              TITLE: copy.benefits.ONE.title,
              DESCRIPTION: copy.benefits.ONE.description,
            },
            TWO: {
              TITLE: copy.benefits.TWO.title,
              DESCRIPTION: copy.benefits.TWO.description,
            },
            THREE: {
              TITLE: copy.benefits.THREE.title,
              DESCRIPTION: copy.benefits.THREE.description,
            },
          },
        },
      },
    },
  });
}

function applyLocaleCopies(
  locale: RemoveAdsUpgradeLocaleDictionary,
  lang: keyof typeof PRIMARY_BENEFIT_COPY_BY_LANG,
): RemoveAdsUpgradeLocaleDictionary {
  return applyVariantCopy(
    applyVariantCopy(
      applyPrimaryBenefitCopy(locale, PRIMARY_BENEFIT_COPY_BY_LANG[lang]),
      'CCFK',
      CCFK_COPY_BY_LANG[lang],
    ),
    'EF',
    EF_COPY_BY_LANG[lang],
  );
}

const PRIMARY_BENEFIT_COPY_BY_LANG: Record<string, PrimaryBenefitCopy> = {
  'en-US': {
    title: 'Export without waiting',
    description: 'Finish exports without rewarded ads. Keep working offline after purchase.',
  },
  'es-MX': {
    title: 'Exporta sin esperar',
    description: 'Finaliza tus exportaciones sin anuncios recompensados. Sigue trabajando sin conexion despues de comprar.',
  },
  'de-DE': {
    title: 'Ohne Wartezeit exportieren',
    description: 'Schließe Exporte ohne Belohnungsanzeigen ab. Arbeite nach dem Kauf offline weiter.',
  },
  'fr-FR': {
    title: 'Exporter sans attendre',
    description: "Terminez vos exports sans annonces récompensées. Continuez à travailler hors ligne après l'achat.",
  },
  'it-IT': {
    title: 'Esporta senza aspettare',
    description: 'Completa le esportazioni senza annunci premiati. Continua a lavorare offline dopo l’acquisto.',
  },
  'pt-BR': {
    title: 'Exportar sem esperar',
    description: 'Finalize as exportações sem anúncios recompensados. Continue trabalhando offline após a compra.',
  },
  'ar-SA': {
    title: 'التصدير دون انتظار',
    description: 'أنهِ عمليات التصدير من دون إعلانات مكافأة. واصل العمل دون اتصال بعد الشراء.',
  },
  'hi-IN': {
    title: 'बिना इंतज़ार के एक्सपोर्ट करें',
    description: 'रिवॉर्ड वाले विज्ञापनों के बिना एक्सपोर्ट पूरे करें। खरीद के बाद ऑफ़लाइन काम करते रहें।',
  },
  'ja-JP': {
    title: '待たずに書き出す',
    description: '報酬広告なしで書き出しを完了できます。購入後はオフラインで作業を続けられます。',
  },
  'ko-KR': {
    title: '기다리지 않고 내보내기',
    description: '보상형 광고 없이 내보내기를 완료하세요. 구매 후에는 오프라인으로 계속 작업할 수 있습니다.',
  },
  'ru-RU': {
    title: 'Экспорт без ожидания',
    description: 'Завершайте экспорты без рекламных роликов. После покупки продолжайте работать офлайн.',
  },
  'zh-CN': {
    title: '无需等待即可导出',
    description: '完成导出时无需奖励广告。购买后可继续离线工作。',
  },
  'zh-TW': {
    title: '無需等待即可匯出',
    description: '完成匯出時無需獎勵廣告。購買後可繼續離線工作。',
  },
};

const CCFK_COPY_BY_LANG: Record<string, VariantUpgradeCopy> = {
  'en-US': {
    title: 'Create covers anytime',
    intro: 'Remove ads and create without interruptions.',
    benefits: {
      ONE: {
        title: 'Create without waiting',
        description:
          'Generate covers without rewarded ads. Keep working offline after purchase.',
      },
      TWO: {
        title: 'Unlock premium export quality',
        description: 'Choose Best and Thumbnail for your final cover.',
      },
      THREE: {
        title: 'No ads, no interruptions',
        description: 'Create, preview, and export with less friction.',
      },
    },
  },
  'es-MX': {
    title: 'Crea portadas cuando quieras',
    intro: 'Elimina anuncios y crea sin interrupciones.',
    benefits: {
      ONE: {
        title: 'Crea sin esperar',
        description:
          'Genera portadas sin anuncios recompensados. Sigue trabajando sin conexión después de comprar.',
      },
      TWO: {
        title: 'Desbloquea calidad de exportación premium',
        description: 'Elige Best y Thumbnail para tu portada final.',
      },
      THREE: {
        title: 'Sin anuncios, sin interrupciones',
        description: 'Crea, previsualiza y exporta con menos fricción.',
      },
    },
  },
  'de-DE': {
    title: 'Cover jederzeit erstellen',
    intro: 'Werbung entfernen und ohne Unterbrechungen erstellen.',
    benefits: {
      ONE: {
        title: 'Ohne Warten erstellen',
        description:
          'Erstelle Cover ohne Belohnungsanzeigen. Arbeite nach dem Kauf offline weiter.',
      },
      TWO: {
        title: 'Premium-Exportqualität freischalten',
        description: 'Wähle Best und Thumbnail für dein finales Cover.',
      },
      THREE: {
        title: 'Keine Werbung, keine Unterbrechungen',
        description: 'Erstellen, Vorschau und Export mit weniger Reibung.',
      },
    },
  },
  'fr-FR': {
    title: 'Créez des couvertures à tout moment',
    intro: 'Supprimez les pubs et créez sans interruption.',
    benefits: {
      ONE: {
        title: 'Créer sans attendre',
        description:
          'Générez des couvertures sans annonces récompensées. Continuez à travailler hors ligne après l’achat.',
      },
      TWO: {
        title: "Débloquer la qualité d'export premium",
        description: 'Choisissez Best et Thumbnail pour votre couverture finale.',
      },
      THREE: {
        title: 'Sans pubs, sans interruptions',
        description: 'Créez, prévisualisez et exportez avec moins de friction.',
      },
    },
  },
  'it-IT': {
    title: 'Crea copertine in qualsiasi momento',
    intro: 'Rimuovi gli annunci e crea senza interruzioni.',
    benefits: {
      ONE: {
        title: 'Crea senza aspettare',
        description:
          'Genera copertine senza annunci premiati. Continua a lavorare offline dopo l’acquisto.',
      },
      TWO: {
        title: 'Sblocca la qualità di esportazione premium',
        description: 'Scegli Best e Thumbnail per la copertina finale.',
      },
      THREE: {
        title: 'Niente annunci, nessuna interruzione',
        description: 'Crea, controlla l’anteprima ed esporta con meno attrito.',
      },
    },
  },
  'pt-BR': {
    title: 'Crie capas a qualquer momento',
    intro: 'Remova os anúncios e crie sem interrupções.',
    benefits: {
      ONE: {
        title: 'Crie sem esperar',
        description:
          'Gere capas sem anúncios recompensados. Continue trabalhando offline após a compra.',
      },
      TWO: {
        title: 'Desbloqueie a qualidade premium de exportação',
        description: 'Escolha Best e Thumbnail para sua capa final.',
      },
      THREE: {
        title: 'Sem anúncios, sem interrupções',
        description: 'Crie, visualize e exporte com menos atrito.',
      },
    },
  },
  'ar-SA': {
    title: 'أنشئ الأغلفة في أي وقت',
    intro: 'أزل الإعلانات وأنشئ دون انقطاع.',
    benefits: {
      ONE: {
        title: 'أنشئ دون انتظار',
        description:
          'أنشئ الأغلفة من دون إعلانات مكافأة. واصل العمل دون اتصال بعد الشراء.',
      },
      TWO: {
        title: 'افتح جودة التصدير المميزة',
        description: 'اختر Best و Thumbnail لغلافك النهائي.',
      },
      THREE: {
        title: 'لا إعلانات، ولا انقطاع',
        description: 'أنشئ وعاين وصدّر مع احتكاك أقل.',
      },
    },
  },
  'hi-IN': {
    title: 'कवर कभी भी बनाएं',
    intro: 'विज्ञापन हटाएँ और बिना रुकावट बनाएँ।',
    benefits: {
      ONE: {
        title: 'बिना इंतज़ार बनाएं',
        description:
          'रिवॉर्डेड विज्ञापनों के बिना कवर बनाएं। खरीद के बाद ऑफ़लाइन काम करते रहें।',
      },
      TWO: {
        title: 'प्रीमियम निर्यात गुणवत्ता अनलॉक करें',
        description: 'अपने अंतिम कवर के लिए Best और Thumbnail चुनें।',
      },
      THREE: {
        title: 'कोई विज्ञापन नहीं, कोई बाधा नहीं',
        description: 'कम रुकावट के साथ बनाएं, पूर्वावलोकन करें और निर्यात करें।',
      },
    },
  },
  'ja-JP': {
    title: 'いつでもカバーを作成',
    intro: '広告を削除して、中断なく作成しましょう。',
    benefits: {
      ONE: {
        title: '待たずに作成',
        description:
          '報酬動画なしでカバーを作成できます。購入後はオフラインでも作業を続けられます。',
      },
      TWO: {
        title: 'プレミアム書き出し品質を解放',
        description: '最終カバーには Best と Thumbnail を選べます。',
      },
      THREE: {
        title: '広告なし、中断なし',
        description: '作成、プレビュー、書き出しをよりスムーズに。',
      },
    },
  },
  'ko-KR': {
    title: '언제든지 커버 제작',
    intro: '광고를 제거하고 중단 없이 제작하세요.',
    benefits: {
      ONE: {
        title: '기다리지 않고 제작',
        description:
          '보상형 광고 없이 커버를 생성하세요. 구매 후에는 오프라인으로 계속 작업하세요.',
      },
      TWO: {
        title: '프리미엄 내보내기 품질 잠금 해제',
        description: '최종 커버에 Best와 Thumbnail을 선택하세요.',
      },
      THREE: {
        title: '광고 없이, 방해 없이',
        description: '더 적은 마찰로 만들고, 미리 보고, 내보내세요.',
      },
    },
  },
  'ru-RU': {
    title: 'Создавайте обложки в любое время',
    intro: 'Уберите рекламу и создавайте без помех.',
    benefits: {
      ONE: {
        title: 'Создавайте без ожидания',
        description:
          'Создавайте обложки без рекламных роликов. После покупки продолжайте работать офлайн.',
      },
      TWO: {
        title: 'Откройте премиальное качество экспорта',
        description: 'Выбирайте Best и Thumbnail для финальной обложки.',
      },
      THREE: {
        title: 'Без рекламы, без помех',
        description: 'Создавайте, просматривайте и экспортируйте без лишних шагов.',
      },
    },
  },
  'zh-CN': {
    title: '随时创建封面',
    intro: '移除广告，无缝创作。',
    benefits: {
      ONE: {
        title: '无需等待即可创建',
        description: '无需激励广告即可生成封面。购买后可继续离线工作。',
      },
      TWO: {
        title: '解锁高级导出质量',
        description: '为最终封面选择 Best 和 Thumbnail。',
      },
      THREE: {
        title: '无广告，无干扰',
        description: '更轻松地创建、预览并导出。',
      },
    },
  },
  'zh-TW': {
    title: '隨時建立封面',
    intro: '移除廣告，無中斷建立。',
    benefits: {
      ONE: {
        title: '無需等待即可建立',
        description: '無需獎勵廣告即可產生封面。購買後可繼續離線工作。',
      },
      TWO: {
        title: '解鎖進階匯出品質',
        description: '最終封面可選用 Best 與 Thumbnail。',
      },
      THREE: {
        title: '無廣告，無干擾',
        description: '以更少阻礙建立、預覽與匯出。',
      },
    },
  },
};

const EF_COPY_BY_LANG: Record<string, VariantUpgradeCopy> = {
  'en-US': {
    title: 'Fix EPUBs anytime',
    intro: 'Remove ads and repair without interruptions.',
    benefits: {
      ONE: {
        title: 'Repair without waiting',
        description:
          'Run fixes without rewarded ads. Keep working offline after purchase.',
      },
      TWO: {
        title: 'Repair without interruptions',
        description: 'Focus on diagnostics and repaired files.',
      },
      THREE: {
        title: 'Keep the app ad-free',
        description: 'Use EPUB Fixer without banners or video ads.',
      },
    },
  },
  'es-MX': {
    title: 'Repara EPUBs cuando quieras',
    intro: 'Elimina anuncios y repara sin interrupciones.',
    benefits: {
      ONE: {
        title: 'Repara sin esperar',
        description:
          'Ejecuta reparaciones sin anuncios recompensados. Sigue trabajando sin conexión después de comprar.',
      },
      TWO: {
        title: 'Repara sin interrupciones',
        description: 'Concéntrate en los diagnósticos y en los archivos reparados.',
      },
      THREE: {
        title: 'Mantén la app sin anuncios',
        description: 'Usa EPUB Fixer sin banners ni anuncios en video.',
      },
    },
  },
  'de-DE': {
    title: 'EPUBs jederzeit reparieren',
    intro: 'Werbung entfernen und ohne Unterbrechungen reparieren.',
    benefits: {
      ONE: {
        title: 'Ohne Warten reparieren',
        description:
          'Starte Reparaturen ohne Belohnungsanzeigen. Arbeite nach dem Kauf offline weiter.',
      },
      TWO: {
        title: 'Reparieren ohne Unterbrechungen',
        description: 'Konzentriere dich auf Diagnosen und reparierte Dateien.',
      },
      THREE: {
        title: 'Die App werbefrei halten',
        description: 'Nutze EPUB Fixer ohne Banner oder Videoanzeigen.',
      },
    },
  },
  'fr-FR': {
    title: 'Réparez les EPUB à tout moment',
    intro: 'Supprimez les pubs et réparez sans interruption.',
    benefits: {
      ONE: {
        title: 'Réparer sans attendre',
        description:
          'Lancez les réparations sans annonces récompensées. Continuez à travailler hors ligne après l’achat.',
      },
      TWO: {
        title: 'Réparer sans interruption',
        description: 'Concentrez-vous sur les diagnostics et les fichiers réparés.',
      },
      THREE: {
        title: "Gardez l'application sans pub",
        description: 'Utilisez EPUB Fixer sans bannières ni pubs vidéo.',
      },
    },
  },
  'it-IT': {
    title: 'Ripara EPUB in qualsiasi momento',
    intro: 'Rimuovi gli annunci e ripara senza interruzioni.',
    benefits: {
      ONE: {
        title: 'Ripara senza aspettare',
        description:
          'Esegui le correzioni senza annunci premiati. Continua a lavorare offline dopo l’acquisto.',
      },
      TWO: {
        title: 'Ripara senza interruzioni',
        description: 'Concentrati sulla diagnostica e sui file riparati.',
      },
      THREE: {
        title: "Mantieni l'app senza annunci",
        description: 'Usa EPUB Fixer senza banner o video pubblicitari.',
      },
    },
  },
  'pt-BR': {
    title: 'Corrija EPUBs a qualquer momento',
    intro: 'Remova os anúncios e corrija sem interrupções.',
    benefits: {
      ONE: {
        title: 'Corrija sem esperar',
        description:
          'Execute correções sem anúncios recompensados. Continue trabalhando offline após a compra.',
      },
      TWO: {
        title: 'Corrija sem interrupções',
        description: 'Concentre-se nos diagnósticos e nos arquivos corrigidos.',
      },
      THREE: {
        title: 'Mantenha o app sem anúncios',
        description: 'Use o EPUB Fixer sem banners ou anúncios em vídeo.',
      },
    },
  },
  'ar-SA': {
    title: 'أصلح EPUB في أي وقت',
    intro: 'أزل الإعلانات وأصلح دون انقطاع.',
    benefits: {
      ONE: {
        title: 'أصلح دون انتظار',
        description:
          'شغّل الإصلاحات من دون إعلانات مكافأة. واصل العمل دون اتصال بعد الشراء.',
      },
      TWO: {
        title: 'أصلح دون انقطاع',
        description: 'ركّز على التشخيص والملفات المُصلحة.',
      },
      THREE: {
        title: 'أبقِ التطبيق بلا إعلانات',
        description: 'استخدم EPUB Fixer من دون لافتات أو إعلانات فيديو.',
      },
    },
  },
  'hi-IN': {
    title: 'EPUB कभी भी ठीक करें',
    intro: 'विज्ञापन हटाएँ और बिना रुकावट सुधारें।',
    benefits: {
      ONE: {
        title: 'बिना इंतज़ार सुधारें',
        description:
          'रिवॉर्डेड विज्ञापनों के बिना सुधार चलाएँ। खरीद के बाद ऑफ़लाइन काम करते रहें।',
      },
      TWO: {
        title: 'बिना रुकावट सुधारें',
        description: 'निदान और सुधरी हुई फ़ाइलों पर ध्यान दें।',
      },
      THREE: {
        title: 'ऐप को विज्ञापन-मुक्त रखें',
        description: 'EPUB Fixer को बिना बैनर या वीडियो विज्ञापनों के इस्तेमाल करें।',
      },
    },
  },
  'ja-JP': {
    title: 'いつでもEPUBを修復',
    intro: '広告を削除して、中断なく修復しましょう。',
    benefits: {
      ONE: {
        title: '待たずに修復',
        description:
          '報酬広告なしで修復を実行できます。購入後はオフラインでも作業を続けられます。',
      },
      TWO: {
        title: '中断なく修復',
        description: '診断と修復済みファイルに集中できます。',
      },
      THREE: {
        title: 'アプリを広告なしに保つ',
        description: 'バナーや動画広告なしで EPUB Fixer を使えます。',
      },
    },
  },
  'ko-KR': {
    title: '언제든지 EPUB 수정',
    intro: '광고를 제거하고 중단 없이 수정하세요.',
    benefits: {
      ONE: {
        title: '기다리지 않고 수정',
        description:
          '보상형 광고 없이 수정을 실행하세요. 구매 후에는 오프라인으로 계속 작업하세요.',
      },
      TWO: {
        title: '중단 없이 수정',
        description: '진단과 수정된 파일에 집중하세요.',
      },
      THREE: {
        title: '앱을 광고 없이 유지',
        description: '배너나 동영상 광고 없이 EPUB Fixer를 사용하세요.',
      },
    },
  },
  'ru-RU': {
    title: 'Исправляйте EPUB в любое время',
    intro: 'Уберите рекламу и исправляйте без помех.',
    benefits: {
      ONE: {
        title: 'Исправляйте без ожидания',
        description:
          'Запускайте исправления без рекламных роликов. После покупки продолжайте работать офлайн.',
      },
      TWO: {
        title: 'Исправляйте без помех',
        description: 'Сосредоточьтесь на диагностике и исправленных файлах.',
      },
      THREE: {
        title: 'Сделайте приложение без рекламы',
        description: 'Используйте EPUB Fixer без баннеров и видеорекламы.',
      },
    },
  },
  'zh-CN': {
    title: '随时修复 EPUB',
    intro: '移除广告，无间断修复。',
    benefits: {
      ONE: {
        title: '无需等待即可修复',
        description: '无需激励广告即可运行修复。购买后可继续离线工作。',
      },
      TWO: {
        title: '无干扰修复',
        description: '专注于诊断和修复后的文件。',
      },
      THREE: {
        title: '让应用保持无广告',
        description: '使用 EPUB Fixer，不受横幅或视频广告打扰。',
      },
    },
  },
  'zh-TW': {
    title: '隨時修復 EPUB',
    intro: '移除廣告，無中斷修復。',
    benefits: {
      ONE: {
        title: '無需等待即可修復',
        description: '無需獎勵廣告即可執行修復。購買後可繼續離線工作。',
      },
      TWO: {
        title: '無干擾修復',
        description: '專注於診斷與已修復的檔案。',
      },
      THREE: {
        title: '讓應用保持無廣告',
        description: '使用 EPUB Fixer，不受橫幅或影片廣告打擾。',
      },
    },
  },
};

const EN_BASE: RemoveAdsUpgradeLocaleDictionary = {
  REMOVE_ADS_UPGRADE: {
    TITLE: {
      PCM: {
        TITLE: 'Unlock a smoother workflow',
        BENEFITS: {
          ONE: {
            TITLE: 'Export without waiting',
            DESCRIPTION: 'Finish your export without a rewarded video or internet connection after purchase.',
          },
          TWO: {
            TITLE: 'Unlock premium export quality',
            DESCRIPTION: 'Choose Best and Thumbnail instead of Compressed only.',
          },
          THREE: {
            TITLE: 'No ads, no interruptions',
            DESCRIPTION: 'Create, preview, and save with less friction.',
          },
        },
      },
      ECC: {
        TITLE: 'Unlock a smoother workflow',
        BENEFITS: {
          ONE: {
            TITLE: 'Export without waiting',
            DESCRIPTION: 'Finish your export without a rewarded video or internet connection after purchase.',
          },
          TWO: {
            TITLE: 'Unlock premium export quality',
            DESCRIPTION: 'Choose Best and Thumbnail instead of Compressed only.',
          },
          THREE: {
            TITLE: 'No ads, no interruptions',
            DESCRIPTION: 'Create, preview, and save with less friction.',
          },
        },
      },
      CCFK: {
        TITLE: 'Create covers anytime',
        BENEFITS: {
          ONE: {
            TITLE: 'Create without waiting',
            DESCRIPTION: 'Skip rewarded videos and generate your cover right away.',
          },
          TWO: {
            TITLE: 'Unlock premium export quality',
            DESCRIPTION: 'Use Best and Thumbnail quality for your final cover.',
          },
          THREE: {
            TITLE: 'Works offline after purchase',
            DESCRIPTION: 'Create and export without depending on ads or a connection.',
          },
        },
      },
      EF: {
        TITLE: 'Fix EPUBs anytime',
        BENEFITS: {
          ONE: {
            TITLE: 'Repair without waiting',
            DESCRIPTION: 'Run fixes immediately without rewarded videos.',
          },
          TWO: {
            TITLE: 'Works offline after purchase',
            DESCRIPTION: 'Complete repairs without depending on ads or a connection.',
          },
          THREE: {
            TITLE: 'No ads, no interruptions',
            DESCRIPTION: 'Stay focused on diagnostics and repaired files.',
          },
        },
      },
    },
    INTRO: 'Remove ads and keep working without interruptions.',
    TRUST_LINE: 'One-time purchase - No subscription',
    OFFLINE_TITLE: 'Connect to continue',
    OFFLINE_MESSAGE: 'Connect to the internet to purchase or restore your upgrade.',
    PURCHASE: {
      WITH_PRICE: 'Unlock for {{price}}',
      FALLBACK: 'Unlock ad-free',
    },
    RESTORE_PROMPT: 'Already purchased?',
    RESTORE_LABEL: 'Restore purchase',
  },
};

const ES_BASE: RemoveAdsUpgradeLocaleDictionary = {
  REMOVE_ADS_UPGRADE: {
    TITLE: {
      PCM: {
        TITLE: 'Desbloquea un flujo mas fluido',
        BENEFITS: {
          ONE: {
            TITLE: 'Exporta sin esperar',
            DESCRIPTION: 'Termina tu exportacion sin un video recompensado ni conexion a internet despues de comprar.',
          },
          TWO: {
            TITLE: 'Desbloquea calidad premium',
            DESCRIPTION: 'Elige Best y Thumbnail en lugar de solo Compressed.',
          },
          THREE: {
            TITLE: 'Sin anuncios, sin interrupciones',
            DESCRIPTION: 'Crea, previsualiza y guarda con menos friccion.',
          },
        },
      },
      ECC: {
        TITLE: 'Desbloquea un flujo mas fluido',
        BENEFITS: {
          ONE: {
            TITLE: 'Exporta sin esperar',
            DESCRIPTION: 'Termina tu exportacion sin un video recompensado ni conexion a internet despues de comprar.',
          },
          TWO: {
            TITLE: 'Desbloquea calidad premium',
            DESCRIPTION: 'Elige Best y Thumbnail en lugar de solo Compressed.',
          },
          THREE: {
            TITLE: 'Sin anuncios, sin interrupciones',
            DESCRIPTION: 'Crea, previsualiza y guarda con menos friccion.',
          },
        },
      },
      CCFK: {
        TITLE: 'Crea portadas cuando quieras',
        BENEFITS: {
          ONE: {
            TITLE: 'Crea sin esperar',
            DESCRIPTION: 'Salta los videos recompensados y genera tu portada de inmediato.',
          },
          TWO: {
            TITLE: 'Desbloquea calidad premium',
            DESCRIPTION: 'Usa Best y Thumbnail para tu portada final.',
          },
          THREE: {
            TITLE: 'Funciona sin conexion despues de comprar',
            DESCRIPTION: 'Crea y exporta sin depender de anuncios o de internet.',
          },
        },
      },
      EF: {
        TITLE: 'Repara EPUBs cuando quieras',
        BENEFITS: {
          ONE: {
            TITLE: 'Repara sin esperar',
            DESCRIPTION: 'Ejecuta las reparaciones de inmediato sin videos recompensados.',
          },
          TWO: {
            TITLE: 'Funciona sin conexion despues de comprar',
            DESCRIPTION: 'Completa reparaciones sin depender de anuncios o de internet.',
          },
          THREE: {
            TITLE: 'Sin anuncios, sin interrupciones',
            DESCRIPTION: 'Concentra tu atencion en el diagnostico y en los archivos reparados.',
          },
        },
      },
    },
    INTRO: 'Elimina anuncios y sigue trabajando sin interrupciones.',
    TRUST_LINE: 'Pago unico - Sin suscripcion',
    OFFLINE_TITLE: 'Conectate para continuar',
    OFFLINE_MESSAGE: 'Conectate a internet para comprar o restaurar tu mejora.',
    PURCHASE: {
      WITH_PRICE: 'Desbloquear por {{price}}',
      FALLBACK: 'Desbloquear sin anuncios',
    },
    RESTORE_PROMPT: 'Ya lo compraste?',
    RESTORE_LABEL: 'Restaurar compra',
  },
};

const DE_BASE = buildLocale({
  INTRO: 'Werbung entfernen und ohne Unterbrechungen weiterarbeiten.',
  TRUST_LINE: 'Einmaliger Kauf · Kein Abo',
  OFFLINE_TITLE: 'Verbinde dich, um fortzufahren',
  OFFLINE_MESSAGE: 'Verbinde dich mit dem Internet, um dein Upgrade zu kaufen oder wiederherzustellen.',
  PURCHASE: {
    WITH_PRICE: 'Für {{price}} freischalten',
    FALLBACK: 'Werbefrei freischalten',
  },
  RESTORE_PROMPT: 'Schon gekauft?',
  RESTORE_LABEL: 'Kauf wiederherstellen',
  TITLE: {
    PCM: {
      TITLE: 'Einen flüssigeren Arbeitsablauf freischalten',
      BENEFITS: {
        ONE: {
          TITLE: 'Ohne Warten exportieren',
          DESCRIPTION: 'Schließe deinen Export nach dem Kauf ohne Reward-Video oder Internetverbindung ab.',
        },
        TWO: {
          TITLE: 'Premium-Exportqualität freischalten',
          DESCRIPTION: 'Wähle Best und Thumbnail statt nur Compressed.',
        },
        THREE: {
          TITLE: 'Keine Werbung, keine Unterbrechungen',
          DESCRIPTION: 'Erstellen, Vorschau ansehen und speichern ohne Reibung.',
        },
      },
    },
    ECC: {
      TITLE: 'Einen flüssigeren Arbeitsablauf freischalten',
      BENEFITS: {
        ONE: {
          TITLE: 'Ohne Warten exportieren',
          DESCRIPTION: 'Schließe deinen Export nach dem Kauf ohne Reward-Video oder Internetverbindung ab.',
        },
        TWO: {
          TITLE: 'Premium-Exportqualität freischalten',
          DESCRIPTION: 'Wähle Best und Thumbnail statt nur Compressed.',
        },
        THREE: {
          TITLE: 'Keine Werbung, keine Unterbrechungen',
          DESCRIPTION: 'Erstellen, Vorschau ansehen und speichern ohne Reibung.',
        },
      },
    },
    CCFK: {
      TITLE: 'Jederzeit Cover erstellen',
      BENEFITS: {
        ONE: {
          TITLE: 'Ohne Warten erstellen',
          DESCRIPTION: 'Überspringe Reward-Videos und generiere dein Cover sofort.',
        },
        TWO: {
          TITLE: 'Premium-Exportqualität freischalten',
          DESCRIPTION: 'Nutze Best- und Thumbnail-Qualität für dein finales Cover.',
        },
        THREE: {
          TITLE: 'Funktioniert nach dem Kauf offline',
          DESCRIPTION: 'Erstellen und exportieren ohne Werbung oder Verbindung.',
        },
      },
    },
    EF: {
      TITLE: 'EPUBs jederzeit reparieren',
      BENEFITS: {
        ONE: {
          TITLE: 'Ohne Warten reparieren',
          DESCRIPTION: 'Starte Reparaturen sofort ohne Reward-Videos.',
        },
        TWO: {
          TITLE: 'Funktioniert nach dem Kauf offline',
          DESCRIPTION: 'Schließe Reparaturen ohne Werbung oder Verbindung ab.',
        },
        THREE: {
          TITLE: 'Keine Werbung, keine Unterbrechungen',
          DESCRIPTION: 'Konzentriere dich auf Diagnose und reparierte Dateien.',
        },
      },
    },
  },
});

const FR_BASE = buildLocale({
  INTRO: 'Supprimez les pubs et continuez sans interruption.',
  TRUST_LINE: 'Achat unique · Sans abonnement',
  OFFLINE_TITLE: 'Connectez-vous pour continuer',
  OFFLINE_MESSAGE: "Connectez-vous à internet pour acheter ou restaurer votre amélioration.",
  PURCHASE: {
    WITH_PRICE: 'Débloquer pour {{price}}',
    FALLBACK: 'Débloquer sans pub',
  },
  RESTORE_PROMPT: 'Déjà acheté ?',
  RESTORE_LABEL: "Restaurer l'achat",
  TITLE: {
    PCM: {
      TITLE: 'Débloquez un flux de travail plus fluide',
      BENEFITS: {
        ONE: {
          TITLE: 'Exporter sans attendre',
          DESCRIPTION: "Terminez votre export sans vidéo récompensée ni connexion après l'achat.",
        },
        TWO: {
          TITLE: "Débloquer la qualité d'export premium",
          DESCRIPTION: 'Choisissez Best et Thumbnail au lieu de Compressed uniquement.',
        },
        THREE: {
          TITLE: 'Sans pubs, sans interruptions',
          DESCRIPTION: 'Créez, prévisualisez et enregistrez avec moins de friction.',
        },
      },
    },
    ECC: {
      TITLE: 'Débloquez un flux de travail plus fluide',
      BENEFITS: {
        ONE: {
          TITLE: 'Exporter sans attendre',
          DESCRIPTION: "Terminez votre export sans vidéo récompensée ni connexion après l'achat.",
        },
        TWO: {
          TITLE: "Débloquer la qualité d'export premium",
          DESCRIPTION: 'Choisissez Best et Thumbnail au lieu de Compressed uniquement.',
        },
        THREE: {
          TITLE: 'Sans pubs, sans interruptions',
          DESCRIPTION: 'Créez, prévisualisez et enregistrez avec moins de friction.',
        },
      },
    },
    CCFK: {
      TITLE: 'Créez des couvertures à tout moment',
      BENEFITS: {
        ONE: {
          TITLE: 'Créer sans attendre',
          DESCRIPTION: 'Ignorez les vidéos récompensées et générez votre couverture immédiatement.',
        },
        TWO: {
          TITLE: "Débloquer la qualité d'export premium",
          DESCRIPTION: 'Utilisez les qualités Best et Thumbnail pour votre couverture finale.',
        },
        THREE: {
          TITLE: "Fonctionne hors ligne après l'achat",
          DESCRIPTION: "Créez et exportez sans dépendre des pubs ou d'une connexion.",
        },
      },
    },
    EF: {
      TITLE: 'Réparez les EPUB à tout moment',
      BENEFITS: {
        ONE: {
          TITLE: 'Réparer sans attendre',
          DESCRIPTION: 'Lancez les réparations immédiatement sans vidéos récompensées.',
        },
        TWO: {
          TITLE: "Fonctionne hors ligne après l'achat",
          DESCRIPTION: "Terminez les réparations sans dépendre des pubs ou d'une connexion.",
        },
        THREE: {
          TITLE: 'Sans pubs, sans interruptions',
          DESCRIPTION: 'Restez concentré sur le diagnostic et les fichiers réparés.',
        },
      },
    },
  },
});

const IT_BASE = buildLocale({
  INTRO: 'Rimuovi gli annunci e continua senza interruzioni.',
  TRUST_LINE: 'Acquisto una tantum · Nessun abbonamento',
  OFFLINE_TITLE: 'Connettiti per continuare',
  OFFLINE_MESSAGE: 'Connettiti a internet per acquistare o ripristinare l’upgrade.',
  PURCHASE: {
    WITH_PRICE: 'Sblocca a {{price}}',
    FALLBACK: 'Sblocca senza annunci',
  },
  RESTORE_PROMPT: 'Hai già acquistato?',
  RESTORE_LABEL: 'Ripristina acquisto',
  TITLE: {
    PCM: {
      TITLE: 'Sblocca un flusso di lavoro più fluido',
      BENEFITS: {
        ONE: {
          TITLE: 'Esporta senza aspettare',
          DESCRIPTION: 'Completa l’esportazione senza un video premiato o una connessione dopo l’acquisto.',
        },
        TWO: {
          TITLE: 'Sblocca la qualità di esportazione premium',
          DESCRIPTION: 'Scegli Best e Thumbnail invece di solo Compressed.',
        },
        THREE: {
          TITLE: 'Niente annunci, nessuna interruzione',
          DESCRIPTION: 'Crea, visualizza l’anteprima e salva con meno attrito.',
        },
      },
    },
    ECC: {
      TITLE: 'Sblocca un flusso di lavoro più fluido',
      BENEFITS: {
        ONE: {
          TITLE: 'Esporta senza aspettare',
          DESCRIPTION: 'Completa l’esportazione senza un video premiato o una connessione dopo l’acquisto.',
        },
        TWO: {
          TITLE: 'Sblocca la qualità di esportazione premium',
          DESCRIPTION: 'Scegli Best e Thumbnail invece di solo Compressed.',
        },
        THREE: {
          TITLE: 'Niente annunci, nessuna interruzione',
          DESCRIPTION: 'Crea, visualizza l’anteprima e salva con meno attrito.',
        },
      },
    },
    CCFK: {
      TITLE: 'Crea copertine in qualsiasi momento',
      BENEFITS: {
        ONE: {
          TITLE: 'Crea senza aspettare',
          DESCRIPTION: 'Salta i video premiati e genera la copertina subito.',
        },
        TWO: {
          TITLE: 'Sblocca la qualità di esportazione premium',
          DESCRIPTION: 'Usa le qualità Best e Thumbnail per la tua copertina finale.',
        },
        THREE: {
          TITLE: 'Funziona offline dopo l’acquisto',
          DESCRIPTION: 'Crea ed esporta senza dipendere da annunci o connessione.',
        },
      },
    },
    EF: {
      TITLE: 'Ripara EPUB in qualsiasi momento',
      BENEFITS: {
        ONE: {
          TITLE: 'Ripara senza aspettare',
          DESCRIPTION: 'Avvia le riparazioni subito senza video premiati.',
        },
        TWO: {
          TITLE: 'Funziona offline dopo l’acquisto',
          DESCRIPTION: 'Completa le riparazioni senza dipendere da annunci o connessione.',
        },
        THREE: {
          TITLE: 'Niente annunci, nessuna interruzione',
          DESCRIPTION: 'Rimani concentrato sulla diagnosi e sui file riparati.',
        },
      },
    },
  },
});

const PT_BASE = buildLocale({
  INTRO: 'Remova os anúncios e continue sem interrupções.',
  TRUST_LINE: 'Compra única · Sem assinatura',
  OFFLINE_TITLE: 'Conecte-se para continuar',
  OFFLINE_MESSAGE: 'Conecte-se à internet para comprar ou restaurar sua atualização.',
  PURCHASE: {
    WITH_PRICE: 'Desbloquear por {{price}}',
    FALLBACK: 'Desbloquear sem anúncios',
  },
  RESTORE_PROMPT: 'Já comprou?',
  RESTORE_LABEL: 'Restaurar compra',
  TITLE: {
    PCM: {
      TITLE: 'Desbloqueie um fluxo de trabalho mais fluido',
      BENEFITS: {
        ONE: {
          TITLE: 'Exportar sem esperar',
          DESCRIPTION: 'Conclua sua exportação sem um vídeo recompensado ou conexão após a compra.',
        },
        TWO: {
          TITLE: 'Desbloqueie a qualidade premium de exportação',
          DESCRIPTION: 'Escolha Best e Thumbnail em vez de apenas Compressed.',
        },
        THREE: {
          TITLE: 'Sem anúncios, sem interrupções',
          DESCRIPTION: 'Crie, visualize e salve com menos atrito.',
        },
      },
    },
    ECC: {
      TITLE: 'Desbloqueie um fluxo de trabalho mais fluido',
      BENEFITS: {
        ONE: {
          TITLE: 'Exportar sem esperar',
          DESCRIPTION: 'Conclua sua exportação sem um vídeo recompensado ou conexão após a compra.',
        },
        TWO: {
          TITLE: 'Desbloqueie a qualidade premium de exportação',
          DESCRIPTION: 'Escolha Best e Thumbnail em vez de apenas Compressed.',
        },
        THREE: {
          TITLE: 'Sem anúncios, sem interrupções',
          DESCRIPTION: 'Crie, visualize e salve com menos atrito.',
        },
      },
    },
    CCFK: {
      TITLE: 'Crie capas quando quiser',
      BENEFITS: {
        ONE: {
          TITLE: 'Criar sem esperar',
          DESCRIPTION: 'Pule os vídeos recompensados e gere sua capa imediatamente.',
        },
        TWO: {
          TITLE: 'Desbloqueie a qualidade premium de exportação',
          DESCRIPTION: 'Use as qualidades Best e Thumbnail para sua capa final.',
        },
        THREE: {
          TITLE: 'Funciona offline após a compra',
          DESCRIPTION: 'Crie e exporte sem depender de anúncios ou conexão.',
        },
      },
    },
    EF: {
      TITLE: 'Repare EPUBs quando quiser',
      BENEFITS: {
        ONE: {
          TITLE: 'Reparar sem esperar',
          DESCRIPTION: 'Inicie os reparos imediatamente sem vídeos recompensados.',
        },
        TWO: {
          TITLE: 'Funciona offline após a compra',
          DESCRIPTION: 'Conclua os reparos sem depender de anúncios ou conexão.',
        },
        THREE: {
          TITLE: 'Sem anúncios, sem interrupções',
          DESCRIPTION: 'Mantenha o foco no diagnóstico e nos arquivos reparados.',
        },
      },
    },
  },
});

const AR_BASE = buildLocale({
  INTRO: 'أزل الإعلانات وواصل العمل بدون انقطاع.',
  TRUST_LINE: 'شراء لمرة واحدة · بدون اشتراك',
  OFFLINE_TITLE: 'اتصل للمتابعة',
  OFFLINE_MESSAGE: 'اتصل بالإنترنت لشراء الترقية أو استعادتها.',
  PURCHASE: {
    WITH_PRICE: 'افتح مقابل {{price}}',
    FALLBACK: 'افتح بدون إعلانات',
  },
  RESTORE_PROMPT: 'هل اشتريته مسبقًا؟',
  RESTORE_LABEL: 'استعادة الشراء',
  TITLE: {
    PCM: {
      TITLE: 'افتح سير عمل أكثر سلاسة',
      BENEFITS: {
        ONE: {
          TITLE: 'التصدير دون انتظار',
          DESCRIPTION: 'أنهِ التصدير من دون فيديو مكافأة أو اتصال بالإنترنت بعد الشراء.',
        },
        TWO: {
          TITLE: 'افتح جودة التصدير المميزة',
          DESCRIPTION: 'اختر Best وThumbnail بدلًا من Compressed فقط.',
        },
        THREE: {
          TITLE: 'من دون إعلانات، من دون انقطاع',
          DESCRIPTION: 'أنشئ واعرض المعاينة واحفظ بسلاسة أكبر.',
        },
      },
    },
    ECC: {
      TITLE: 'افتح سير عمل أكثر سلاسة',
      BENEFITS: {
        ONE: {
          TITLE: 'التصدير دون انتظار',
          DESCRIPTION: 'أنهِ التصدير من دون فيديو مكافأة أو اتصال بالإنترنت بعد الشراء.',
        },
        TWO: {
          TITLE: 'افتح جودة التصدير المميزة',
          DESCRIPTION: 'اختر Best وThumbnail بدلًا من Compressed فقط.',
        },
        THREE: {
          TITLE: 'من دون إعلانات، من دون انقطاع',
          DESCRIPTION: 'أنشئ واعرض المعاينة واحفظ بسلاسة أكبر.',
        },
      },
    },
    CCFK: {
      TITLE: 'أنشئ أغلفة في أي وقت',
      BENEFITS: {
        ONE: {
          TITLE: 'أنشئ دون انتظار',
          DESCRIPTION: 'تخطَّى فيديوهات المكافأة وأنشئ غلافك فورًا.',
        },
        TWO: {
          TITLE: 'افتح جودة التصدير المميزة',
          DESCRIPTION: 'استخدم Best وThumbnail لغلافك النهائي.',
        },
        THREE: {
          TITLE: 'يعمل دون اتصال بعد الشراء',
          DESCRIPTION: 'أنشئ وصدّر دون الاعتماد على الإعلانات أو الاتصال.',
        },
      },
    },
    EF: {
      TITLE: 'أصلح ملفات EPUB في أي وقت',
      BENEFITS: {
        ONE: {
          TITLE: 'أصلح دون انتظار',
          DESCRIPTION: 'ابدأ الإصلاحات فورًا من دون فيديوهات مكافأة.',
        },
        TWO: {
          TITLE: 'يعمل دون اتصال بعد الشراء',
          DESCRIPTION: 'أكمل الإصلاحات دون الاعتماد على الإعلانات أو الاتصال.',
        },
        THREE: {
          TITLE: 'من دون إعلانات، من دون انقطاع',
          DESCRIPTION: 'أبقِ تركيزك على التشخيص والملفات التي تم إصلاحها.',
        },
      },
    },
  },
});

const HI_BASE = buildLocale({
  INTRO: 'विज्ञापन हटाएँ और बिना रुकावट काम करते रहें।',
  TRUST_LINE: 'एकमुश्त खरीद · कोई सदस्यता नहीं',
  OFFLINE_TITLE: 'जारी रखने के लिए कनेक्ट करें',
  OFFLINE_MESSAGE: 'अपग्रेड खरीदने या पुनर्स्थापित करने के लिए इंटरनेट से कनेक्ट करें।',
  PURCHASE: {
    WITH_PRICE: '₹{{price}} में अनलॉक करें',
    FALLBACK: 'विज्ञापन-मुक्त अनलॉक करें',
  },
  RESTORE_PROMPT: 'पहले से खरीदा है?',
  RESTORE_LABEL: 'खरीद पुनर्स्थापित करें',
  TITLE: {
    PCM: {
      TITLE: 'एक अधिक सहज वर्कफ़्लो अनलॉक करें',
      BENEFITS: {
        ONE: {
          TITLE: 'बिना इंतज़ार के एक्सपोर्ट करें',
          DESCRIPTION: 'खरीद के बाद रिवॉर्ड वीडियो या इंटरनेट कनेक्शन के बिना अपना एक्सपोर्ट पूरा करें।',
        },
        TWO: {
          TITLE: 'प्रीमियम एक्सपोर्ट गुणवत्ता अनलॉक करें',
          DESCRIPTION: 'सिर्फ Compressed की जगह Best और Thumbnail चुनें।',
        },
        THREE: {
          TITLE: 'कोई विज्ञापन नहीं, कोई बाधा नहीं',
          DESCRIPTION: 'कम रुकावट के साथ बनाएँ, पूर्वावलोकन करें और सेव करें।',
        },
      },
    },
    ECC: {
      TITLE: 'एक अधिक सहज वर्कफ़्लो अनलॉक करें',
      BENEFITS: {
        ONE: {
          TITLE: 'बिना इंतज़ार के एक्सपोर्ट करें',
          DESCRIPTION: 'खरीद के बाद रिवॉर्ड वीडियो या इंटरनेट कनेक्शन के बिना अपना एक्सपोर्ट पूरा करें।',
        },
        TWO: {
          TITLE: 'प्रीमियम एक्सपोर्ट गुणवत्ता अनलॉक करें',
          DESCRIPTION: 'सिर्फ Compressed की जगह Best और Thumbnail चुनें।',
        },
        THREE: {
          TITLE: 'कोई विज्ञापन नहीं, कोई बाधा नहीं',
          DESCRIPTION: 'कम रुकावट के साथ बनाएँ, पूर्वावलोकन करें और सेव करें।',
        },
      },
    },
    CCFK: {
      TITLE: 'कभी भी कवर बनाएँ',
      BENEFITS: {
        ONE: {
          TITLE: 'बिना इंतज़ार किए बनाएँ',
          DESCRIPTION: 'रिवॉर्ड वीडियो छोड़ें और अपना कवर तुरंत बनाएँ।',
        },
        TWO: {
          TITLE: 'प्रीमियम एक्सपोर्ट गुणवत्ता अनलॉक करें',
          DESCRIPTION: 'अपने अंतिम कवर के लिए Best और Thumbnail क्वालिटी का उपयोग करें।',
        },
        THREE: {
          TITLE: 'खरीद के बाद ऑफ़लाइन काम करता है',
          DESCRIPTION: 'विज्ञापनों या कनेक्शन पर निर्भर हुए बिना बनाएँ और एक्सपोर्ट करें।',
        },
      },
    },
    EF: {
      TITLE: 'कभी भी EPUB ठीक करें',
      BENEFITS: {
        ONE: {
          TITLE: 'बिना इंतज़ार के सुधारें',
          DESCRIPTION: 'रिवॉर्ड वीडियो के बिना तुरंत सुधार शुरू करें।',
        },
        TWO: {
          TITLE: 'खरीद के बाद ऑफ़लाइन काम करता है',
          DESCRIPTION: 'विज्ञापनों या कनेक्शन पर निर्भर हुए बिना सुधार पूरा करें।',
        },
        THREE: {
          TITLE: 'कोई विज्ञापन नहीं, कोई बाधा नहीं',
          DESCRIPTION: 'डायग्नोस्टिक्स और सुधारी गई फाइलों पर ध्यान बनाए रखें।',
        },
      },
    },
  },
});

const JA_BASE = buildLocale({
  INTRO: '広告を消して、中断なく作業を続けましょう。',
  TRUST_LINE: '買い切り · サブスクなし',
  OFFLINE_TITLE: '続けるには接続してください',
  OFFLINE_MESSAGE: 'アップグレードの購入または復元にはインターネット接続が必要です。',
  PURCHASE: {
    WITH_PRICE: '￥{{price}}で解除',
    FALLBACK: '広告なしで解除',
  },
  RESTORE_PROMPT: 'すでに購入しましたか？',
  RESTORE_LABEL: '購入を復元',
  TITLE: {
    PCM: {
      TITLE: 'よりスムーズな作業フローを解放',
      BENEFITS: {
        ONE: {
          TITLE: '待たずに書き出す',
          DESCRIPTION: '購入後は、報酬動画やインターネット接続なしで書き出しを完了できます。',
        },
        TWO: {
          TITLE: 'プレミアム書き出し品質を解放',
          DESCRIPTION: 'Compressed だけでなく Best と Thumbnail を選べます。',
        },
        THREE: {
          TITLE: '広告なし、中断なし',
          DESCRIPTION: '作成、プレビュー、保存をよりスムーズに。',
        },
      },
    },
    ECC: {
      TITLE: 'よりスムーズな作業フローを解放',
      BENEFITS: {
        ONE: {
          TITLE: '待たずに書き出す',
          DESCRIPTION: '購入後は、報酬動画やインターネット接続なしで書き出しを完了できます。',
        },
        TWO: {
          TITLE: 'プレミアム書き出し品質を解放',
          DESCRIPTION: 'Compressed だけでなく Best と Thumbnail を選べます。',
        },
        THREE: {
          TITLE: '広告なし、中断なし',
          DESCRIPTION: '作成、プレビュー、保存をよりスムーズに。',
        },
      },
    },
    CCFK: {
      TITLE: 'いつでもカバーを作成',
      BENEFITS: {
        ONE: {
          TITLE: '待たずに作成',
          DESCRIPTION: '報酬動画をスキップして、すぐにカバーを生成できます。',
        },
        TWO: {
          TITLE: 'プレミアム書き出し品質を解放',
          DESCRIPTION: '最終カバーには Best と Thumbnail 品質を使えます。',
        },
        THREE: {
          TITLE: '購入後はオフラインで利用可能',
          DESCRIPTION: '広告や接続に頼らず、作成と書き出しができます。',
        },
      },
    },
    EF: {
      TITLE: 'いつでも EPUB を修復',
      BENEFITS: {
        ONE: {
          TITLE: '待たずに修復',
          DESCRIPTION: '報酬動画なしで、すぐに修復を開始できます。',
        },
        TWO: {
          TITLE: '購入後はオフラインで利用可能',
          DESCRIPTION: '広告や接続に頼らず修復を完了できます。',
        },
        THREE: {
          TITLE: '広告なし、中断なし',
          DESCRIPTION: '診断と修復済みファイルに集中できます。',
        },
      },
    },
  },
});

const KO_BASE = buildLocale({
  INTRO: '광고를 제거하고 방해 없이 계속 작업하세요.',
  TRUST_LINE: '일회성 구매 · 구독 없음',
  OFFLINE_TITLE: '계속하려면 연결하세요',
  OFFLINE_MESSAGE: '업그레이드를 구매하거나 복원하려면 인터넷에 연결하세요.',
  PURCHASE: {
    WITH_PRICE: '₩{{price}}에 잠금 해제',
    FALLBACK: '광고 없이 잠금 해제',
  },
  RESTORE_PROMPT: '이미 구매하셨나요?',
  RESTORE_LABEL: '구매 복원',
  TITLE: {
    PCM: {
      TITLE: '더 매끄러운 작업 흐름 잠금 해제',
      BENEFITS: {
        ONE: {
          TITLE: '기다리지 않고 내보내기',
          DESCRIPTION: '구매 후에는 보상형 동영상이나 인터넷 연결 없이 내보내기를 완료할 수 있습니다.',
        },
        TWO: {
          TITLE: '프리미엄 내보내기 품질 잠금 해제',
          DESCRIPTION: 'Compressed 대신 Best와 Thumbnail을 선택하세요.',
        },
        THREE: {
          TITLE: '광고 없이, 방해 없이',
          DESCRIPTION: '더 적은 마찰로 만들고, 미리 보고, 저장하세요.',
        },
      },
    },
    ECC: {
      TITLE: '더 매끄러운 작업 흐름 잠금 해제',
      BENEFITS: {
        ONE: {
          TITLE: '기다리지 않고 내보내기',
          DESCRIPTION: '구매 후에는 보상형 동영상이나 인터넷 연결 없이 내보내기를 완료할 수 있습니다.',
        },
        TWO: {
          TITLE: '프리미엄 내보내기 품질 잠금 해제',
          DESCRIPTION: 'Compressed 대신 Best와 Thumbnail을 선택하세요.',
        },
        THREE: {
          TITLE: '광고 없이, 방해 없이',
          DESCRIPTION: '더 적은 마찰로 만들고, 미리 보고, 저장하세요.',
        },
      },
    },
    CCFK: {
      TITLE: '언제든지 표지 만들기',
      BENEFITS: {
        ONE: {
          TITLE: '기다리지 않고 만들기',
          DESCRIPTION: '보상형 동영상을 건너뛰고 표지를 바로 생성하세요.',
        },
        TWO: {
          TITLE: '프리미엄 내보내기 품질 잠금 해제',
          DESCRIPTION: '최종 표지에는 Best와 Thumbnail 품질을 사용하세요.',
        },
        THREE: {
          TITLE: '구매 후 오프라인으로 작동',
          DESCRIPTION: '광고나 연결에 의존하지 않고 만들고 내보낼 수 있습니다.',
        },
      },
    },
    EF: {
      TITLE: '언제든지 EPUB 수정',
      BENEFITS: {
        ONE: {
          TITLE: '기다리지 않고 수정',
          DESCRIPTION: '보상형 동영상 없이 바로 수정을 시작하세요.',
        },
        TWO: {
          TITLE: '구매 후 오프라인으로 작동',
          DESCRIPTION: '광고나 연결에 의존하지 않고 수정을 완료할 수 있습니다.',
        },
        THREE: {
          TITLE: '광고 없이, 방해 없이',
          DESCRIPTION: '진단과 수정된 파일에 집중하세요.',
        },
      },
    },
  },
});

const RU_BASE = buildLocale({
  INTRO: 'Уберите рекламу и работайте без помех.',
  TRUST_LINE: 'Одноразовая покупка · Без подписки',
  OFFLINE_TITLE: 'Подключитесь, чтобы продолжить',
  OFFLINE_MESSAGE: 'Подключитесь к интернету, чтобы купить или восстановить улучшение.',
  PURCHASE: {
    WITH_PRICE: 'Разблокировать за {{price}}',
    FALLBACK: 'Разблокировать без рекламы',
  },
  RESTORE_PROMPT: 'Уже покупали?',
  RESTORE_LABEL: 'Восстановить покупку',
  TITLE: {
    PCM: {
      TITLE: 'Откройте более плавный рабочий процесс',
      BENEFITS: {
        ONE: {
          TITLE: 'Экспорт без ожидания',
          DESCRIPTION: 'Завершайте экспорт без рекламного видео и без интернета после покупки.',
        },
        TWO: {
          TITLE: 'Откройте премиальное качество экспорта',
          DESCRIPTION: 'Выбирайте Best и Thumbnail вместо только Compressed.',
        },
        THREE: {
          TITLE: 'Без рекламы, без помех',
          DESCRIPTION: 'Создавайте, просматривайте и сохраняйте с меньшими задержками.',
        },
      },
    },
    ECC: {
      TITLE: 'Откройте более плавный рабочий процесс',
      BENEFITS: {
        ONE: {
          TITLE: 'Экспорт без ожидания',
          DESCRIPTION: 'Завершайте экспорт без рекламного видео и без интернета после покупки.',
        },
        TWO: {
          TITLE: 'Откройте премиальное качество экспорта',
          DESCRIPTION: 'Выбирайте Best и Thumbnail вместо только Compressed.',
        },
        THREE: {
          TITLE: 'Без рекламы, без помех',
          DESCRIPTION: 'Создавайте, просматривайте и сохраняйте с меньшими задержками.',
        },
      },
    },
    CCFK: {
      TITLE: 'Создавайте обложки в любое время',
      BENEFITS: {
        ONE: {
          TITLE: 'Создавайте без ожидания',
          DESCRIPTION: 'Пропускайте рекламные видео и сразу создавайте обложку.',
        },
        TWO: {
          TITLE: 'Откройте премиальное качество экспорта',
          DESCRIPTION: 'Используйте качества Best и Thumbnail для финальной обложки.',
        },
        THREE: {
          TITLE: 'Работает офлайн после покупки',
          DESCRIPTION: 'Создавайте и экспортируйте без рекламы и без соединения.',
        },
      },
    },
    EF: {
      TITLE: 'Исправляйте EPUB в любое время',
      BENEFITS: {
        ONE: {
          TITLE: 'Исправляйте без ожидания',
          DESCRIPTION: 'Запускайте исправления сразу без рекламных видео.',
        },
        TWO: {
          TITLE: 'Работает офлайн после покупки',
          DESCRIPTION: 'Завершайте исправления без рекламы и без соединения.',
        },
        THREE: {
          TITLE: 'Без рекламы, без помех',
          DESCRIPTION: 'Сосредоточьтесь на диагностике и исправленных файлах.',
        },
      },
    },
  },
});

const ZH_CN_BASE = buildLocale({
  INTRO: '移除广告，继续流畅工作。',
  TRUST_LINE: '一次购买 · 无需订阅',
  OFFLINE_TITLE: '请连接后继续',
  OFFLINE_MESSAGE: '请连接互联网以购买或恢复升级。',
  PURCHASE: {
    WITH_PRICE: '以 {{price}} 解锁',
    FALLBACK: '无广告解锁',
  },
  RESTORE_PROMPT: '已经购买过？',
  RESTORE_LABEL: '恢复购买',
  TITLE: {
    PCM: {
      TITLE: '解锁更流畅的工作流',
      BENEFITS: {
        ONE: {
          TITLE: '无需等待即可导出',
          DESCRIPTION: '购买后，即使没有奖励视频或网络连接也能完成导出。',
        },
        TWO: {
          TITLE: '解锁高级导出质量',
          DESCRIPTION: '可选择 Best 和 Thumbnail，而不只是 Compressed。',
        },
        THREE: {
          TITLE: '无广告，无打扰',
          DESCRIPTION: '创建、预览和保存都更顺畅。',
        },
      },
    },
    ECC: {
      TITLE: '解锁更流畅的工作流',
      BENEFITS: {
        ONE: {
          TITLE: '无需等待即可导出',
          DESCRIPTION: '购买后，即使没有奖励视频或网络连接也能完成导出。',
        },
        TWO: {
          TITLE: '解锁高级导出质量',
          DESCRIPTION: '可选择 Best 和 Thumbnail，而不只是 Compressed。',
        },
        THREE: {
          TITLE: '无广告，无打扰',
          DESCRIPTION: '创建、预览和保存都更顺畅。',
        },
      },
    },
    CCFK: {
      TITLE: '随时创建封面',
      BENEFITS: {
        ONE: {
          TITLE: '无需等待即可创建',
          DESCRIPTION: '跳过奖励视频，立即生成封面。',
        },
        TWO: {
          TITLE: '解锁高级导出质量',
          DESCRIPTION: '为最终封面使用 Best 和 Thumbnail 质量。',
        },
        THREE: {
          TITLE: '购买后可离线使用',
          DESCRIPTION: '无需依赖广告或连接即可创建和导出。',
        },
      },
    },
    EF: {
      TITLE: '随时修复 EPUB',
      BENEFITS: {
        ONE: {
          TITLE: '无需等待即可修复',
          DESCRIPTION: '无需奖励视频即可立即开始修复。',
        },
        TWO: {
          TITLE: '购买后可离线使用',
          DESCRIPTION: '无需依赖广告或连接即可完成修复。',
        },
        THREE: {
          TITLE: '无广告，无打扰',
          DESCRIPTION: '专注于诊断和已修复的文件。',
        },
      },
    },
  },
});

const ZH_TW_BASE = buildLocale({
  INTRO: '移除廣告，繼續流暢工作。',
  TRUST_LINE: '一次購買 · 無需訂閱',
  OFFLINE_TITLE: '請連線後繼續',
  OFFLINE_MESSAGE: '請連線到網際網路以購買或還原升級。',
  PURCHASE: {
    WITH_PRICE: '以 {{price}} 解鎖',
    FALLBACK: '無廣告解鎖',
  },
  RESTORE_PROMPT: '已經購買過？',
  RESTORE_LABEL: '還原購買',
  TITLE: {
    PCM: {
      TITLE: '解鎖更順暢的工作流程',
      BENEFITS: {
        ONE: {
          TITLE: '無需等待即可匯出',
          DESCRIPTION: '購買後，即使沒有獎勵影片或網路連線也能完成匯出。',
        },
        TWO: {
          TITLE: '解鎖進階匯出品質',
          DESCRIPTION: '可選擇 Best 和 Thumbnail，而不只是 Compressed。',
        },
        THREE: {
          TITLE: '無廣告，無干擾',
          DESCRIPTION: '建立、預覽與儲存都更順暢。',
        },
      },
    },
    ECC: {
      TITLE: '解鎖更順暢的工作流程',
      BENEFITS: {
        ONE: {
          TITLE: '無需等待即可匯出',
          DESCRIPTION: '購買後，即使沒有獎勵影片或網路連線也能完成匯出。',
        },
        TWO: {
          TITLE: '解鎖進階匯出品質',
          DESCRIPTION: '可選擇 Best 和 Thumbnail，而不只是 Compressed。',
        },
        THREE: {
          TITLE: '無廣告，無干擾',
          DESCRIPTION: '建立、預覽與儲存都更順暢。',
        },
      },
    },
    CCFK: {
      TITLE: '隨時建立封面',
      BENEFITS: {
        ONE: {
          TITLE: '無需等待即可建立',
          DESCRIPTION: '跳過獎勵影片，立即產生封面。',
        },
        TWO: {
          TITLE: '解鎖進階匯出品質',
          DESCRIPTION: '為最終封面使用 Best 和 Thumbnail 品質。',
        },
        THREE: {
          TITLE: '購買後可離線使用',
          DESCRIPTION: '無需依賴廣告或連線即可建立與匯出。',
        },
      },
    },
    EF: {
      TITLE: '隨時修復 EPUB',
      BENEFITS: {
        ONE: {
          TITLE: '無需等待即可修復',
          DESCRIPTION: '無需獎勵影片即可立即開始修復。',
        },
        TWO: {
          TITLE: '購買後可離線使用',
          DESCRIPTION: '無需依賴廣告或連線即可完成修復。',
        },
        THREE: {
          TITLE: '無廣告，無干擾',
          DESCRIPTION: '專注於診斷和已修復的檔案。',
        },
      },
    },
  },
});

export const REMOVE_ADS_UPGRADE_KIT_TRANSLATIONS: Record<
  string,
  RemoveAdsUpgradeLocaleDictionary
> = {
  'en-US': applyLocaleCopies(EN_BASE, 'en-US'),
  'es-MX': applyLocaleCopies(ES_BASE, 'es-MX'),
  'de-DE': applyLocaleCopies(DE_BASE, 'de-DE'),
  'fr-FR': applyLocaleCopies(FR_BASE, 'fr-FR'),
  'it-IT': applyLocaleCopies(IT_BASE, 'it-IT'),
  'pt-BR': applyLocaleCopies(PT_BASE, 'pt-BR'),
  'ar-SA': applyLocaleCopies(AR_BASE, 'ar-SA'),
  'hi-IN': applyLocaleCopies(HI_BASE, 'hi-IN'),
  'ja-JP': applyLocaleCopies(JA_BASE, 'ja-JP'),
  'ko-KR': applyLocaleCopies(KO_BASE, 'ko-KR'),
  'ru-RU': applyLocaleCopies(RU_BASE, 'ru-RU'),
  'zh-CN': applyLocaleCopies(ZH_CN_BASE, 'zh-CN'),
  'zh-TW': applyLocaleCopies(ZH_TW_BASE, 'zh-TW'),
};
