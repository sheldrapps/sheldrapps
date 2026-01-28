# @sheldrapps/image-workflow

Shared image workflow library for Sheldrapps monorepo.

## Features

- 🔍 **Validation**: Type and size validation with typed errors
- 📐 **Dimensions**: Extract image width/height with fallbacks
- 🔄 **Processing**: Resize, optimize, and normalize images
- ✂️ **Cropping**: Reusable cropper modal with rotation, color adjustments, export to exact dimensions
- 🔌 **Adapters**: Optional Capacitor filesystem/share adapters

## Usage

```typescript
import {
  validateBasic,
  getDimensions,
  prepareWorkingImage,
  CoverCropperComponent
} from '@sheldrapps/image-workflow';

// Validate image
const error = validateBasic(file, { maxBytes: 20_000_000 });

// Get dimensions
const dims = await getDimensions(file);

// Prepare optimized working image
const workingImage = await prepareWorkingImage(file, {
  maxSide: 2048,
  quality: 0.85
});
```

## Structure

- `lib/types/` - Interfaces and type definitions
- `lib/core/` - Pure TS/Canvas logic (validation, processing)
- `lib/ui/` - Angular/Ionic components (cropper modal)
- `lib/adapters/` - Optional platform adapters (Capacitor)
