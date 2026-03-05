export default {
  scanner: {
    // Skip crawling other locales and API routes
    exclude: ['/es/*', '/en/*', '/api/*'],
    device: 'mobile',
    throttle: true,
  },
  lighthouse: {
    categories: ['performance', 'accessibility', 'best-practices', 'seo'],
  },
}
