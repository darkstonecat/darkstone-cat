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
  { slug: 'data-protection', path: '/data-protection' },
  { slug: 'login', path: '/login' },
  { slug: 'register', path: '/register' },
  { slug: 'forgot-password', path: '/forgot-password' },
  { slug: 'profile', path: '/profile' },
  { slug: 'profile-edit', path: '/profile/edit' },
  { slug: 'profile-card', path: '/profile/card' },
  { slug: 'admin', path: '/admin' },
  { slug: 'admin-members', path: '/admin/members' },
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
