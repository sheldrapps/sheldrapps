export type EReaderBrand = 'kindle' | 'kobo' | 'generic';

export type EReaderColorId =
  | 'black'
  | 'white'
  | 'matcha'
  | 'jade'
  | 'pink'
  | 'metallic-black'
  | 'metallic-jade'
  | 'metallic-pink';

export interface EReaderFrameColorPreset {
  id: EReaderColorId;
  brand: EReaderBrand;
  i18nKey: string;
  swatch: string;
  frameBase: string;
  frameMid: string;
  frameDark: string;
  frameLight: string;
  strokeOuter: string;
  strokeInner: string;
  screenBorder: string;
  metallic?: boolean;
}

export const E_READER_FRAME_COLOR_PRESETS: EReaderFrameColorPreset[] = [
  {
    id: 'black',
    brand: 'generic',
    i18nKey: 'E_READER_FRAME.COLOR.BLACK',
    swatch: '#22262C',
    frameBase: '#10141A',
    frameMid: '#343A42',
    frameDark: '#070A0F',
    frameLight: '#6F7680',
    strokeOuter: '#7D848C',
    strokeInner: '#020305',
    screenBorder: '#0A0A0A',
  },
  {
    id: 'white',
    brand: 'generic',
    i18nKey: 'E_READER_FRAME.COLOR.WHITE',
    swatch: '#EAE6DF',
    frameBase: '#D4D0C8',
    frameMid: '#F2EFE8',
    frameDark: '#A6A299',
    frameLight: '#FFFFFF',
    strokeOuter: '#FFFFFF',
    strokeInner: '#9C978E',
    screenBorder: '#4D4C48',
  },
  {
    id: 'matcha',
    brand: 'generic',
    i18nKey: 'E_READER_FRAME.COLOR.MATCHA',
    swatch: '#A9C0AD',
    frameBase: '#7E9C88',
    frameMid: '#A9C0AD',
    frameDark: '#4E6657',
    frameLight: '#D2DFD2',
    strokeOuter: '#DFE9E0',
    strokeInner: '#445646',
    screenBorder: '#2C3A30',
  },
  {
    id: 'jade',
    brand: 'generic',
    i18nKey: 'E_READER_FRAME.COLOR.JADE',
    swatch: '#06A5A3',
    frameBase: '#0A7E7B',
    frameMid: '#06A5A3',
    frameDark: '#055C5A',
    frameLight: '#78CBC6',
    strokeOuter: '#A4E0DC',
    strokeInner: '#065453',
    screenBorder: '#0A4644',
  },
  {
    id: 'pink',
    brand: 'generic',
    i18nKey: 'E_READER_FRAME.COLOR.PINK',
    swatch: '#D76495',
    frameBase: '#A04371',
    frameMid: '#D76495',
    frameDark: '#6A2A4A',
    frameLight: '#E8A7C3',
    strokeOuter: '#F0BED3',
    strokeInner: '#5E2542',
    screenBorder: '#452035',
  },
  {
    id: 'metallic-black',
    brand: 'generic',
    i18nKey: 'E_READER_FRAME.COLOR.METALLIC_BLACK',
    swatch: '#2D3138',
    frameBase: '#1A1F28',
    frameMid: '#444B57',
    frameDark: '#0D1118',
    frameLight: '#8A92A0',
    strokeOuter: '#A0A9B6',
    strokeInner: '#11161D',
    screenBorder: '#0A0B0D',
    metallic: true,
  },
  {
    id: 'metallic-jade',
    brand: 'generic',
    i18nKey: 'E_READER_FRAME.COLOR.METALLIC_JADE',
    swatch: '#3E9A96',
    frameBase: '#1F6865',
    frameMid: '#4AAEAA',
    frameDark: '#104A48',
    frameLight: '#8DD4D0',
    strokeOuter: '#B7E4E0',
    strokeInner: '#1A4A48',
    screenBorder: '#0F3E3C',
    metallic: true,
  },
  {
    id: 'metallic-pink',
    brand: 'generic',
    i18nKey: 'E_READER_FRAME.COLOR.METALLIC_PINK',
    swatch: '#B95386',
    frameBase: '#7F2D57',
    frameMid: '#C76898',
    frameDark: '#4D1A36',
    frameLight: '#E5A8C8',
    strokeOuter: '#F2C6DA',
    strokeInner: '#5A2140',
    screenBorder: '#3E1A30',
    metallic: true,
  },
];

export const E_READER_FRAME_DEFAULT_BY_BRAND: Record<EReaderBrand, EReaderColorId> = {
  kindle: 'black',
  kobo: 'black',
  generic: 'black',
};
