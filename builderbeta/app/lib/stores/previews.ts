import { atom } from 'nanostores';

export interface PreviewInfo {
  port: number;
  ready: boolean;
  baseUrl: string;
}

export class PreviewsStore {
  #availablePreviews = new Map<number, PreviewInfo>();

  previews = atom<PreviewInfo[]>([]);

  constructor() {
    // E2B previews are added dynamically when ports are detected in terminal output
  }

  addExternalPreview(port: number, baseUrl: string) {
    const previews = this.previews.get();
    const existing = previews.find((p) => p.port === port);

    if (existing) {
      existing.baseUrl = baseUrl;
      existing.ready = true;
      this.previews.set([...previews]);
    } else {
      const previewInfo = { port, ready: true, baseUrl };
      this.#availablePreviews.set(port, previewInfo);
      this.previews.set([...previews, previewInfo]);
    }
  }

  removeExternalPreview(port: number) {
    this.#availablePreviews.delete(port);
    this.previews.set(this.previews.get().filter((preview) => preview.port !== port));
  }
}
