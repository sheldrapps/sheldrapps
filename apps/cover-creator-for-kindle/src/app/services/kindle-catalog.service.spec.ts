import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import {
  DEFAULT_DEVICE_BRAND_ID,
  DEFAULT_DEVICE_MODEL_ID,
  KindleCatalogService,
  type KindleBrand,
} from './kindle-catalog.service';

describe('KindleCatalogService', () => {
  let service: KindleCatalogService;
  let brands: KindleBrand[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(KindleCatalogService);
    brands = [
      {
        id: DEFAULT_DEVICE_BRAND_ID,
        i18nKey: 'KINDLE_BRANDS.KINDLE',
        groups: [
          {
            id: 'basic',
            i18nKey: 'KINDLE_GROUPS.BASIC',
            items: [
              {
                id: 'basic_2010_2019',
                i18nKey: 'KINDLE_MODELS.BASIC_2010_2019',
                width: 600,
                height: 800,
              },
            ],
          },
          {
            id: 'paperwhite',
            i18nKey: 'KINDLE_GROUPS.PAPERWHITE',
            items: [
              {
                id: DEFAULT_DEVICE_MODEL_ID,
                i18nKey: 'KINDLE_MODELS.PAPERWHITE_2021',
                width: 1236,
                height: 1648,
              },
              {
                id: 'paperwhite_2015_2019',
                i18nKey: 'KINDLE_MODELS.PAPERWHITE_2015_2019',
                width: 1072,
                height: 1448,
              },
            ],
          },
        ],
      },
      {
        id: 'kobo',
        i18nKey: 'KOBO_BRANDS.KOBO',
        groups: [
          {
            brandId: 'kobo',
            id: 'clara',
            i18nKey: 'KOBO_GROUPS.CLARA',
            items: [
              {
                id: 'clara_all',
                i18nKey: 'KOBO_MODELS.CLARA_ALL',
                width: 1072,
                height: 1448,
              },
            ],
          },
        ],
      },
    ];
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('resolves the explicit default device path', () => {
    const selection = service.getDefaultSelection(brands);

    expect(selection.brandId).toBe(DEFAULT_DEVICE_BRAND_ID);
    expect(selection.groupId).toBe('paperwhite');
    expect(selection.modelId).toBe(DEFAULT_DEVICE_MODEL_ID);
  });

  it('falls back to the first model in the persisted brand when the model is invalid', () => {
    const selection = service.resolveSelection(brands, {
      brandId: DEFAULT_DEVICE_BRAND_ID,
      modelId: 'missing_model',
    });

    expect(selection.brandId).toBe(DEFAULT_DEVICE_BRAND_ID);
    expect(selection.groupId).toBe('basic');
    expect(selection.modelId).toBe('basic_2010_2019');
  });

  it('falls back to the explicit default when the brand is invalid', () => {
    const selection = service.resolveSelection(brands, {
      brandId: 'unknown_brand',
      modelId: 'missing_model',
    });

    expect(selection.brandId).toBe(DEFAULT_DEVICE_BRAND_ID);
    expect(selection.groupId).toBe('paperwhite');
    expect(selection.modelId).toBe(DEFAULT_DEVICE_MODEL_ID);
  });

  it('resolves valid selections from non-default brands', () => {
    const selection = service.resolveSelection(brands, {
      brandId: 'kobo',
      modelId: 'kobo_clara_bw',
    });

    expect(selection.brandId).toBe('kobo');
    expect(selection.groupId).toBe('clara');
    expect(selection.modelId).toBe('clara_all');
  });

  it('maps legacy model ids to the new consolidated catalog ids', () => {
    const selection = service.resolveSelection(brands, {
      brandId: DEFAULT_DEVICE_BRAND_ID,
      modelId: 'paperwhite_2019',
    });

    expect(selection.brandId).toBe(DEFAULT_DEVICE_BRAND_ID);
    expect(selection.groupId).toBe('paperwhite');
    expect(selection.modelId).toBe(DEFAULT_DEVICE_MODEL_ID);
  });
});
