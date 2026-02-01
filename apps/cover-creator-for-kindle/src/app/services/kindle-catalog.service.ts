import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  KindleGroup,
  KindleModel,
} from '../components/kindle-model-picker/kindle-model-picker.component';

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

  findModelById(groups: KindleGroup[], id: string): KindleModel | undefined {
    for (const g of groups) {
      const hit = g.items.find((m) => m.id === id);
      if (hit) return hit;
    }
    return undefined;
  }
}
