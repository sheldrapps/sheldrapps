import type { AdFallbackAppVariant } from './ad-fallback.types';

export type AdFallbackLocaleDictionary = {
  AD_FALLBACK: {
    TITLE: string;
    MESSAGE: Record<Uppercase<AdFallbackAppVariant>, string>;
    REMAINING: string;
    REASON: {
      NETWORK: string;
      DNS: string;
      NO_FILL: string;
      BLOCKED: string;
      REGION: string;
    };
    BUTTON: {
      WAIT: string;
      USE_TRIAL: string;
    };
  };
};

const EN_BASE: AdFallbackLocaleDictionary = {
  AD_FALLBACK: {
    TITLE: 'Could not load ad',
    MESSAGE: {
      CCFK: 'We could not load an ad right now. You can use a trial export to create a cover.',
      ECC: 'We could not load an ad right now. You can use a trial export to change a cover.',
      EF: 'We could not load an ad right now. You can use a trial repair to continue.',
      PCM: 'We could not load an ad right now. You can use a trial export to create a cover.',
    },
    REMAINING: 'You have {{remaining}} of {{total}} trial exports left.',
    REASON: {
      NETWORK: 'Network problem while loading ad.',
      DNS: 'Could not resolve ad connection.',
      NO_FILL: 'No ads available right now.',
      BLOCKED: 'An ad blocker may be preventing ads.',
      REGION: 'No ads available in your region right now.',
    },
    BUTTON: {
      WAIT: 'Continue in {{count}}...',
      USE_TRIAL: 'Use trial export ({{remaining}} of {{total}})',
    },
  },
};

const ES_BASE: AdFallbackLocaleDictionary = {
  AD_FALLBACK: {
    TITLE: 'No se pudo cargar el anuncio',
    MESSAGE: {
      CCFK: 'No pudimos cargar anuncio ahora. Puedes usar una exportacion de prueba para crear portada.',
      ECC: 'No pudimos cargar anuncio ahora. Puedes usar una exportacion de prueba para cambiar portada.',
      EF: 'No pudimos cargar anuncio ahora. Puedes usar una reparacion de prueba para continuar.',
      PCM: 'No pudimos cargar anuncio ahora. Puedes usar una exportacion de prueba para crear portada.',
    },
    REMAINING: 'Te quedan {{remaining}} de {{total}} exportaciones de prueba.',
    REASON: {
      NETWORK: 'Problema de red al cargar anuncio.',
      DNS: 'No pudimos resolver conexion de anuncios.',
      NO_FILL: 'No hay anuncios disponibles ahora.',
      BLOCKED: 'Parece que un bloqueador impidio cargar anuncios.',
      REGION: 'No hay anuncios disponibles en tu region ahora.',
    },
    BUTTON: {
      WAIT: 'Continuar en {{count}}...',
      USE_TRIAL: 'Usar exportacion de prueba ({{remaining}} de {{total}})',
    },
  },
};

export const AD_FALLBACK_KIT_TRANSLATIONS: Record<
  string,
  AdFallbackLocaleDictionary
> = {
  'es-MX': ES_BASE,
  'en-US': EN_BASE,
  'de-DE': EN_BASE,
  'fr-FR': EN_BASE,
  'it-IT': EN_BASE,
  'pt-BR': EN_BASE,
  'ar-SA': EN_BASE,
  'hi-IN': EN_BASE,
  'ja-JP': EN_BASE,
  'ko-KR': EN_BASE,
  'ru-RU': EN_BASE,
  'zh-CN': EN_BASE,
  'zh-TW': EN_BASE,
};
