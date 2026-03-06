/**
 * Lighthouse audit configuration — pages, devices, thresholds, and flags.
 */

export const PAGES = [
  { slug: 'home', path: '/' },
  { slug: 'about', path: '/about' },
  { slug: 'ludoteca', path: '/ludoteca' },
  { slug: 'contact', path: '/contact' },
  { slug: 'events', path: '/events' },
  { slug: 'faq', path: '/faq' },
  { slug: 'conduct', path: '/conduct' },
  { slug: 'legal', path: '/legal' },
  { slug: 'privacy', path: '/privacy' },
  { slug: 'cookies', path: '/cookies' },
];

export const DEVICES = ['mobile', 'desktop'];

export const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

export const PRODUCTION_BASE_URL = 'https://www.darkstone.cat';

export const LIGHTHOUSE_FLAGS = {
  logLevel: 'error',
  output: ['json', 'html'],
};

// Score thresholds for emoji classification
export const THRESHOLDS = {
  green: 90,
  yellow: 50,
};

// Category weights for task prioritization
export const CATEGORY_WEIGHTS = {
  'accessibility': 4,
  'seo': 3,
  'performance': 2,
  'best-practices': 1,
};
