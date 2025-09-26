export enum Mode {
  Create = 'create',
  Edit = 'edit',
  Enhance = 'enhance',
}

export enum CreateFunction {
  Free = 'free',
  Seedream4k = 'seedream4k',
  Cinema = 'cinema',
  Scenario = 'scenario',
  Portrait = 'portrait',
  Video = 'video',
  Anime = 'anime',
}

export enum EditFunction {
  AddRemove = 'add-remove',
  MagicExpand = 'magic-expand',
  Retouch = 'retouch',
  Style = 'style',
  Compose = 'compose',
}

export enum EnhanceFunction {
  Upscale = 'upscale',
  FixDetails = 'fix-details',
  AdjustColor = 'adjust-color',
  AdjustLighting = 'adjust-lighting',
}

export interface ImageFile {
  base64: string;
  mimeType: string;
  name: string;
}

export interface HistoryItem {
  id: number;
  imageUrl: string;
  beforeImageUrl?: string;
  prompt: string;
  mode: Mode;
  createFunction?: CreateFunction;
  enhanceFunction?: EnhanceFunction;
  aspectRatio?: string;
  negativePrompt?: string;
}

export interface UserSettings {
  activeCreateFunc: CreateFunction;
  aspectRatio: string;
}

export interface User {
  name: string;
  password?: string; // Should be hashed in a real app
  registrationDate: string;
}