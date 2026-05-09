import { BestCandidateService } from './best-candidate.service';
import { BestCandidateImage } from '../models/best-candidate-image.model';

describe('BestCandidateService', () => {
  let service: BestCandidateService;

  beforeEach(() => {
    service = new BestCandidateService();
  });

  function image(
    id: string,
    width: number,
    height: number,
    fileName: string,
    index = 0,
  ): BestCandidateImage {
    return {
      id,
      src: `blob:${id}`,
      width,
      height,
      fileName,
      index,
    };
  }

  it('returns max 3 candidates by default', () => {
    const ranked = service.rankCandidates([
      image('1', 1200, 1800, 'cover-1.jpg', 0),
      image('2', 1200, 1800, 'cover-2.jpg', 1),
      image('3', 1200, 1800, 'cover-3.jpg', 2),
      image('4', 1200, 1800, 'cover-4.jpg', 3),
    ]);

    expect(ranked.length).toBe(3);
  });

  it('prioritizes cover-like names and cover ratio', () => {
    const ranked = service.rankCandidates([
      image('logo', 600, 600, 'logo.png', 0),
      image('cover', 1200, 1800, 'book-cover.jpg', 1),
    ]);

    expect(ranked[0].image.id).toBe('cover');
  });

  it('penalizes very small images', () => {
    const ranked = service.rankCandidates([
      image('small', 80, 80, 'cover-small.png', 0),
      image('large', 900, 1300, 'image.png', 1),
    ]);

    expect(ranked[0].image.id).toBe('large');
  });

  it('keeps deterministic order on tie by index then id', () => {
    const ranked = service.rankCandidates([
      image('b', 1000, 1500, 'image-b.jpg', 2),
      image('a', 1000, 1500, 'image-a.jpg', 1),
    ]);

    expect(ranked[0].image.id).toBe('a');
    expect(ranked[1].image.id).toBe('b');
  });
});
