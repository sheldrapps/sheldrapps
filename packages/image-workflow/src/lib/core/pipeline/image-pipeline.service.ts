import { Injectable } from '@angular/core';
import type {
  ImageValidationError,
  ImageDims,
  WorkingImageOptions,
  ImageValidationOptions,
  CropTarget,
  SmallImageWarnParams,
} from '../../types';
import {
  validateBasic as validateBasicFn,
  getDimensions as getDimensionsFn,
  normalizeFile as normalizeFileFn,
  materializeFile as materializeFileFn,
  prepareWorkingImage as prepareWorkingImageFn,
  getSmallWarnParams as getSmallWarnParamsFn,
  DEFAULT_VALIDATION_OPTIONS,
  DEFAULT_WORKING_OPTIONS,
} from '../../core/pipeline';

/**
 * Angular service wrapper for image pipeline functions
 * Provides the same API as the original ImagePipelineService
 */
@Injectable({ providedIn: 'root' })
export class ImagePipelineService {
  readonly allowedMime = DEFAULT_VALIDATION_OPTIONS.allowedMimeTypes;
  readonly maxBytes = DEFAULT_VALIDATION_OPTIONS.maxBytes;
  readonly workingMaxSide = DEFAULT_WORKING_OPTIONS.maxSide;
  readonly workingJpegQuality = DEFAULT_WORKING_OPTIONS.quality;

  validateBasic(file: File): ImageValidationError | null {
    return validateBasicFn(file);
  }

  async getDimensions(file: File): Promise<ImageDims | null> {
    return getDimensionsFn(file);
  }

  async normalizeFile(file: File): Promise<File | null> {
    return normalizeFileFn(file);
  }

  async materializeFile(file: File): Promise<File> {
    return materializeFileFn(file);
  }

  async prepareWorkingImage(file: File): Promise<File> {
    return prepareWorkingImageFn(file);
  }

  getSmallWarnParams(
    originalDims: ImageDims,
    target: CropTarget
  ): SmallImageWarnParams | null {
    return getSmallWarnParamsFn(originalDims, target);
  }
}
