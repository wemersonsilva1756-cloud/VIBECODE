import type { StudioApi } from '@shared/contract'

declare global {
  interface Window {
    studio: StudioApi
  }
}

export {}
