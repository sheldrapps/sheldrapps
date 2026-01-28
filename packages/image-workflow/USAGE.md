## Integration Example

### Basic Image Validation & Processing

```typescript
import {
  validateBasic,
  getDimensions,
  materializeFile,
  prepareWorkingImage,
  DEFAULT_VALIDATION_OPTIONS
} from '@sheldrapps/image-workflow';

// Pick a file from input
const file = inputElement.files[0];

// Validate
const error = validateBasic(file, DEFAULT_VALIDATION_OPTIONS);
if (error) {
  console.error('Invalid image:', error);
  return;
}

// Materialize (ensure fully loaded)
const materialized = await materializeFile(file);

// Get dimensions
const dims = await getDimensions(materialized);
console.log(`Image: ${dims.width}x${dims.height}`);

// Prepare optimized working image
const working = await prepareWorkingImage(materialized, {
  maxSide: 2048,
  quality: 0.85
});
```

### Using the Cropper

```typescript
import { ModalController } from '@ionic/angular';
import { CoverCropperModalComponent, CropTarget } from '@sheldrapps/image-workflow';

constructor(private modalCtrl: ModalController) {}

async openCropper(imageFile: File, target: CropTarget) {
  const modal = await this.modalCtrl.create({
    component: CoverCropperModalComponent,
    componentProps: {
      file: imageFile,
      model: target,  // { width: 1236, height: 1648 }
      onReady: () => console.log('Cropper ready'),
    },
  });

  await modal.present();

  const { data, role } = await modal.onWillDismiss();
  
  if (role === 'done' && data) {
    const { file: croppedImage, state } = data;
    // Use cropped image or save state for later
  }
}
```

### Using Angular Service

```typescript
import { ImagePipelineService } from '@sheldrapps/image-workflow';

constructor(private pipeline: ImagePipelineService) {}

async processImage(file: File) {
  const error = this.pipeline.validateBasic(file);
  if (error) return;

  const dims = await this.pipeline.getDimensions(file);
  const working = await this.pipeline.prepareWorkingImage(file);
}
```

### Optional: Capacitor Adapters

```typescript
import {
  CapacitorFileWriter,
  CapacitorFileSharer
} from '@sheldrapps/image-workflow/capacitor';

const writer = new CapacitorFileWriter();
const sharer = new CapacitorFileSharer();

// Write file
await writer.write('covers/my_cover.jpg', jpegBytes, {
  directory: 'Documents'
});

// Share file
await sharer.share({
  title: 'My Cover',
  files: ['file:///path/to/cover.jpg']
});
```
