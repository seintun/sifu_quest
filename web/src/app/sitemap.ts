import { getCanonicalSiteUrl } from '../lib/brand.ts'
import type { MetadataRoute } from 'next'

const ROUTES = ['/', '/coach', '/plan', '/dsa', '/system-design', '/jobs', '/calendar', '/memory', '/settings']

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getCanonicalSiteUrl()
  const now = new Date()
  return ROUTES.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: route === '/' ? 1 : 0.7,
  }))
}
