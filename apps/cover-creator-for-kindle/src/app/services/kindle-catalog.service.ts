import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  KindleGroup,
  KindleModel,
} from '../components/kindle-model-picker/kindle-model-picker.component';

export const DEFAULT_DEVICE_BRAND_ID = 'kindle';
export const DEFAULT_DEVICE_GROUP_ID = 'paperwhite';
export const DEFAULT_DEVICE_MODEL_ID = 'paperwhite_2021';

const LEGACY_MODEL_ID_ALIASES: Record<string, string> = {
  kindle_basic_2019: 'basic_2010_2019',
  kindle_basic_2022: 'basic_2022_2024',
  kindle_basic_2024: 'basic_2022_2024',
  paperwhite_2015: 'paperwhite_2015_2019',
  paperwhite_2018: 'paperwhite_2015_2019',
  paperwhite_2019: 'paperwhite_2015_2019',
  colorsoft_2024: 'colorsoft',
  colorsoft_signature_2024: 'colorsoft_signature_edition',
  scribe_2022: 'scribe_2022_2024',
  scribe_2024: 'scribe_2022_2024',
  kobo_clara_hd: 'clara_all',
  kobo_clara_2e: 'clara_all',
  kobo_clara_bw: 'clara_all',
  kobo_clara_colour: 'clara_all',
  kobo_libra_h2o: 'libra_all',
  kobo_libra_2: 'libra_all',
  kobo_libra_colour: 'libra_all',
  kobo_elipsa: 'elipsa_all',
  kobo_elipsa_2e: 'elipsa_all',
};

export interface KindleBrand {
  id: string;
  i18nKey: string;
  groups: KindleGroup[];
}

export interface ResolvedKindleSelection {
  brandId: string;
  groupId: string;
  modelId: string;
  model: KindleModel;
}

@Injectable({ providedIn: 'root' })
export class KindleCatalogService {
  private cached?: KindleGroup[];

  constructor(private http: HttpClient) {}

  async getGroups(): Promise<KindleGroup[]> {
    if (this.cached) return this.cached;
    const groups = await firstValueFrom(
      this.http.get<KindleGroup[]>('assets/data/kindle-model-groups.json')
    );
    this.cached = groups ?? [];
    return this.cached;
  }

  async getBrands(): Promise<KindleBrand[]> {
    const groups = await this.getGroups();
    const brandMap = new Map<string, KindleBrand>();

    for (const group of groups) {
      const brandId = this.normalizeId(group.brandId) ?? DEFAULT_DEVICE_BRAND_ID;
      const existing = brandMap.get(brandId);

      if (existing) {
        existing.groups.push(group);
        continue;
      }

      brandMap.set(brandId, {
        id: brandId,
        i18nKey: this.getBrandI18nKey(brandId),
        groups: [group],
      });
    }

    return Array.from(brandMap.values());
  }

  getGroupsForBrand(brands: KindleBrand[], brandId?: string): KindleGroup[] {
    return this.findBrandById(brands, brandId)?.groups ?? [];
  }

  resolveSelection(
    brands: KindleBrand[],
    opts: {
      brandId?: string;
      modelId?: string;
    }
  ): ResolvedKindleSelection {
    const defaultSelection = this.getDefaultSelection(brands);
    const brandId = this.normalizeId(opts.brandId);
    const modelId = this.normalizeModelId(opts.modelId);

    if (modelId && brandId) {
      return (
        this.resolveSelectionForBrand(brands, brandId, modelId) ??
        this.resolveFirstSelectionInBrand(brands, brandId) ??
        defaultSelection
      );
    }

    if (modelId) {
      return (
        this.resolveSelectionForBrand(brands, DEFAULT_DEVICE_BRAND_ID, modelId) ??
        defaultSelection
      );
    }

    return defaultSelection;
  }

  resolveFirstSelectionInBrand(
    brands: KindleBrand[],
    brandId?: string
  ): ResolvedKindleSelection | null {
    const brand = this.findBrandById(brands, brandId);
    if (!brand) {
      return null;
    }

    const firstGroup = brand.groups.find((group) => group.items?.length);
    const firstModel = firstGroup?.items?.[0];
    if (!firstGroup || !firstModel) {
      return null;
    }

    return {
      brandId: brand.id,
      groupId: firstGroup.id,
      modelId: firstModel.id,
      model: firstModel,
    };
  }

  getDefaultSelection(brands: KindleBrand[]): ResolvedKindleSelection {
    const exactDefault =
      this.resolveSelectionForBrand(
        brands,
        DEFAULT_DEVICE_BRAND_ID,
        DEFAULT_DEVICE_MODEL_ID
      ) ??
      this.resolveFirstSelectionInBrand(brands, DEFAULT_DEVICE_BRAND_ID);

    if (exactDefault) {
      return exactDefault;
    }

    for (const brand of brands) {
      const fallback = this.resolveFirstSelectionInBrand(brands, brand.id);
      if (fallback) {
        return fallback;
      }
    }

    throw new Error('Kindle catalog must contain at least one valid device.');
  }

  findModelById(groups: KindleGroup[], id: string): KindleModel | undefined {
    for (const g of groups) {
      const hit = g.items.find((m) => m.id === id);
      if (hit) return hit;
    }
    return undefined;
  }

  private resolveSelectionForBrand(
    brands: KindleBrand[],
    brandId: string,
    modelId: string
  ): ResolvedKindleSelection | null {
    const brand = this.findBrandById(brands, brandId);
    if (!brand) {
      return null;
    }

    const model = this.findModelById(brand.groups, modelId);
    if (!model) {
      return null;
    }

    const group = brand.groups.find((entry) =>
      entry.items.some((item) => item.id === modelId)
    );
    if (!group) {
      return null;
    }

    return {
      brandId: brand.id,
      groupId: group.id,
      modelId: model.id,
      model,
    };
  }

  private findBrandById(
    brands: KindleBrand[],
    brandId?: string
  ): KindleBrand | undefined {
    const normalized = this.normalizeId(brandId);
    if (!normalized) {
      return undefined;
    }

    return brands.find((brand) => brand.id === normalized);
  }

  private normalizeId(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private getBrandI18nKey(brandId: string): string {
    switch (brandId) {
      case 'kindle':
        return 'KINDLE_BRANDS.KINDLE';
      case 'kobo':
        return 'KOBO_BRANDS.KOBO';
      case 'nook':
        return 'NOOK_BRANDS.NOOK';
      case 'pocketbook':
        return 'POCKETBOOK_BRANDS.POCKETBOOK';
      case 'tolino':
        return 'TOLINO_BRANDS.TOLINO';
      default:
        return `DEVICE_BRANDS.${brandId.toUpperCase()}`;
    }
  }

  private normalizeModelId(value: string | undefined): string | undefined {
    const normalized = this.normalizeId(value);
    if (!normalized) {
      return undefined;
    }

    return LEGACY_MODEL_ID_ALIASES[normalized] ?? normalized;
  }
}
