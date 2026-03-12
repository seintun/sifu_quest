import { BRAND_DESCRIPTION, BRAND_NAME } from '../lib/brand.ts'
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: BRAND_NAME,
    short_name: 'Sifu',
    description: BRAND_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    lang: 'en-US',
    background_color: '#09090B',
    theme_color: '#09090B',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
