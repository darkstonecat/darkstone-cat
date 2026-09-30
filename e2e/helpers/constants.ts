// ─── Test credentials ─────────────────────────────────────────────
export const MEMBER_EMAIL = 'e2e-member@test.local'
export const MEMBER_PASSWORD = 'Test1234!'
export const MEMBER_FIRST_NAME = 'E2E'
export const MEMBER_LAST_NAME = 'Member'

export const ADMIN_EMAIL = 'e2e-admin@test.local'
export const ADMIN_PASSWORD = 'Admin1234!'
export const ADMIN_FIRST_NAME = 'E2E'
export const ADMIN_LAST_NAME = 'Admin'

// Dedicated user for tests that mutate profile data. Tests run fully parallel,
// so writing to the shared member would race with tests that read it.
export const EDITOR_EMAIL = 'e2e-editor@test.local'
export const EDITOR_PASSWORD = 'Editor1234!'
export const EDITOR_FIRST_NAME = 'E2E'
export const EDITOR_LAST_NAME = 'Editor'

// ─── Storage state paths ─────────────────────────────────────────
export const MEMBER_STATE_PATH = '.auth/member.json'
export const ADMIN_STATE_PATH = '.auth/admin.json'
export const EDITOR_STATE_PATH = '.auth/editor.json'

// ─── Common paths ────────────────────────────────────────────────
export const PAGES = {
  home: '/',
  about: '/about',
  ludoteca: '/ludoteca',
  contact: '/contact',
  events: '/events',
  faq: '/faq',
  conduct: '/conduct',
  legal: '/legal',
  privacy: '/privacy',
  cookies: '/cookies',
  dataProtection: '/data-protection',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  profile: '/profile',
  profileEdit: '/profile/edit',
  profileCard: '/profile/card',
  admin: '/admin',
  adminMembers: '/admin/members',
} as const

// ─── UI texts (Catalan — default locale) ─────────────────────────
// These must match the EXACT values in src/messages/ca.json
export const TEXT = {
  // Nav
  nav_home: 'Inici',
  nav_about: 'Qui som',
  nav_ludoteca: 'Ludoteca',
  nav_contact: 'Contacte',
  nav_events: 'Esdeveniments',
  nav_conduct: 'Pautes de conducta',
  nav_faq: 'Preguntes freqüents',
  nav_login: 'Iniciar sessió',
  nav_register: 'Registre',
  nav_profile: 'Perfil',
  nav_logout: 'Tancar sessió',
  nav_admin: 'Admin',

  // Hero
  hero_tagline: 'Jocs de Taula i Rol a Terrassa',

  // Auth
  login_submit: 'Entra',
  login_magic_button: "Envia'm un enllaç d'accés",
  login_magic_sent_title: 'Revisa el teu correu',
  login_magic_error: "L'enllaç d'accés no és vàlid o ha caducat. Demana'n un de nou.",
  login_error_invalid: 'Correu o contrasenya incorrectes.',
  register_submit: 'Crea el meu compte',
  register_done_title: 'Revisa el teu correu',
  register_done_resend: 'Torna a enviar el correu',
  register_done_resent: 'Correu enviat',
  register_done_back: 'Torna al formulari',
  register_done_login: "Ja l'he confirmat · Entra",
  required_field: 'Aquest camp és obligatori.',
  invalid_email: 'Introdueix un correu electrònic vàlid.',
  password_min_length: 'Mínim 8 caràcters.',
  must_accept_conduct: "Has d'acceptar les pautes de conducta.",
  must_accept_privacy: "Has d'acceptar la política de privadesa.",

  // Contact
  contact_title: 'Contacte',
  contact_submit: 'Enviar missatge',
  contact_sending: 'Enviant...',
  contact_success_title: 'Missatge enviat!',
  contact_error_title: 'Error en enviar',

  // Profile
  profile_title: 'El meu perfil',
  profile_edit_save: 'Desar canvis',
  profile_edit_saving: 'Desant...',
  profile_section_personal: 'Dades personals',
  profile_section_gaming: 'Perfils de joc',
  profile_section_membership: 'Afiliació',

  // Admin
  admin_title: 'Administració',
  admin_nav_members: 'Gestió de socis',
  admin_members_title: 'Socis',

  // Footer
  footer_rights: 'Tots els drets reservats.',
} as const
