import type { Experience } from './logic';
import { sampleExperiences } from './sampleData';

export type CatalogResult = {
  items: Experience[];
  mode: 'sample' | 'live';
  fetchedAt: string;
};

export interface ExperienceCatalog {
  load(): Promise<CatalogResult>;
}

// Replace this adapter when the existing API integration is ready.
export const catalog: ExperienceCatalog = {
  async load() {
    return { items: sampleExperiences, mode: 'sample', fetchedAt: new Date().toISOString() };
  },
};
