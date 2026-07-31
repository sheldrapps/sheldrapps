import type {
  CropOutputMode,
  CropTarget,
  CropTargetUnit,
} from "../types";
export type { CropOutputMode, CropTargetUnit } from "../types";

export type CropTargetCategory =
  | "e-reader"
  | "publishing"
  | "paper"
  | "ratio";

export type CropOrientation = "portrait" | "landscape";

/** Fully explicit target contract used by new editor sessions. */
export interface EditorCropTarget {
  formatId: string;
  width: number;
  height: number;
  unit: CropTargetUnit;
  outputMode: CropOutputMode;
}

export interface CropTargetPreset {
  id: string;
  i18nKey: string;
  width: number;
  height: number;
  unit: CropTargetUnit;
  outputMode: CropOutputMode;
  badgeI18nKey?: string;
  descriptionI18nKey?: string;
}

export interface PublishingCropPreset extends CropTargetPreset {
  coverUsage: 'embedded' | 'external' | 'both';
  evidence: 'official' | 'derived-from-official' | 'user-reported';
  badge: 'ideal' | 'recommended' | 'compatible' | 'alternative' | 'minimum';
  acceptedMimeTypes?: Array<'image/jpeg' | 'image/png' | 'image/tiff'>;
  maxFileSizeMb?: number;
}

export interface CropTargetGroup {
  parentId: string;
  parentI18nKey?: string;
  id: string;
  i18nKey: string;
  items: CropTargetPreset[];
}

export interface PersistedCropTargetSelection {
  category: CropTargetCategory;
  parentId?: string;
  groupId?: string;
  presetId?: string;
  width: number;
  height: number;
  unit: CropTargetUnit;
  outputMode: CropOutputMode;
  orientation?: CropOrientation;
}

export interface CropTargetCategoryConfig {
  catalog: CropTargetGroup[];
  selectedParentId?: string;
  selectedGroupId?: string;
  selectedPreset?: CropTargetPreset;
  supportsOrientation?: boolean;
  defaultOrientation?: CropOrientation;
}

export interface CropTargetsConfig {
  activeCategory?: CropTargetCategory;
  categories?: Partial<Record<CropTargetCategory, CropTargetCategoryConfig>>;
  eReader?: CropTargetCategoryConfig;
  publishing?: CropTargetCategoryConfig;
  paper?: CropTargetCategoryConfig;
  ratio?: CropTargetCategoryConfig;
  selections?: Partial<Record<CropTargetCategory, PersistedCropTargetSelection>>;
}

export interface CropTargetSelection extends PersistedCropTargetSelection {
  presetId: string;
}

export interface EffectiveCropTarget extends CropTarget {
  unit: CropTargetUnit;
  outputMode: CropOutputMode;
  orientation: CropOrientation;
}
