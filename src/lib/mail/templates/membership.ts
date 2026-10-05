import { escapeHtml } from "../html";

/*
 * Membership e-mails (spec A-6 / BR-8 and A-7 / §4.3). Always in Catalan: no locale is stored
 * per member (decision D-C). Pure functions: plain text plus a simple HTML version in which
 * every interpolated value is escaped (names and the reason are user input). They take no
 * DNI, phone or other sensitive field.
 */

export type MembershipEmail = { subject: string; text: string; html: string };

const CONTACT_EMAIL = "hola@darkstone.cat";
const SITE_URL = "https://www.darkstone.cat";
const PROFILE_URL = `${SITE_URL}/profile`;
const SIGNATURE = "Darkstone Catalunya";

/** `2026-10-05` → `5/10/2026` (the format of the dialogs); anything else is shown as given. */
function formatDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${Number(day)}/${Number(month)}/${year}`;
}

function greeting(firstName: string): string {
  const name = firstName.trim();
  return name ? `Hola, ${name}:` : "Hola:";
}

/** A paragraph of escaped text; line breaks become `<br />`. */
function htmlParagraph(text: string): string {
  return `<p>${escapeHtml(text).replace(/\r?\n/g, "<br />")}</p>`;
}

const CONTACT_LINK = `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`;
const PROFILE_LINK = `<a href="${PROFILE_URL}">${PROFILE_URL}</a>`;
const HTML_SIGNATURE = `<p>${SIGNATURE}<br /><a href="${SITE_URL}">www.darkstone.cat</a></p>`;

// ---------------------------------------------------------------------------------------------
// A-6 · The board gives a member baixa (BR-8: the member is told the reason)
// ---------------------------------------------------------------------------------------------

export type BoardLeaveEmailInput = {
  firstName: string;
  memberNumber: string;
  /** ISO date (`YYYY-MM-DD`) recorded as the leave date. */
  leftOn: string;
  reason: string;
};

export function boardLeaveEmail({ firstName, memberNumber, leftOn, reason }: BoardLeaveEmailInput): MembershipEmail {
  const hello = greeting(firstName);
  const intro = `La junta de Darkstone Catalunya t'ha donat de baixa com a soci (número ${memberNumber}) amb data ${formatDate(leftOn)}.`;
  const reasonLabel = "Motiu de la baixa:";
  const effects =
    "Des d'ara ja no pots entrar a la zona de socis i el teu carnet deixa de ser vàlid. Hem esborrat el teu telèfon, el codi postal i els usuaris de joc. El registre de soci es conserva bloquejat durant 3 anys i després es destrueix.";
  const contact = `Si tens dubtes sobre aquesta decisió o vols tornar a ser soci, escriu-nos a ${CONTACT_EMAIL}.`;

  const text = [hello, intro, `${reasonLabel}\n${reason}`, effects, contact, `${SIGNATURE}\n${SITE_URL}`].join("\n\n");

  const html = [
    htmlParagraph(hello),
    htmlParagraph(intro),
    `<p><strong>${reasonLabel}</strong></p>`,
    `<blockquote>${htmlParagraph(reason)}</blockquote>`,
    htmlParagraph(effects),
    `<p>Si tens dubtes sobre aquesta decisió o vols tornar a ser soci, escriu-nos a ${CONTACT_LINK}.</p>`,
    HTML_SIGNATURE,
  ].join("\n");

  return { subject: "Baixa de Darkstone Catalunya", text, html };
}

// ---------------------------------------------------------------------------------------------
// A-7 · The board reinstates a former member (§4.3: "Tornes a ser soci")
// ---------------------------------------------------------------------------------------------

export type RejoinEmailInput = {
  firstName: string;
  memberNumber: string;
};

export function rejoinEmail({ firstName, memberNumber }: RejoinEmailInput): MembershipEmail {
  const hello = greeting(firstName);
  const intro = `Ens alegra tornar-te a tenir amb nosaltres. La junta t'ha reincorporat com a soci de Darkstone Catalunya i mantens el mateix número de soci, ${memberNumber}.`;
  const signIn = "Pots entrar a la zona de socis amb el mateix correu i la mateixa contrasenya que tenies:";
  const notes = [
    "Tens un carnet nou a l'apartat «Carnet». L'anterior ja no funciona.",
    "El butlletí està desactivat. Si el vols rebre, activa'l des del teu perfil.",
    "El telèfon, el codi postal i els usuaris de joc es van esborrar amb la baixa. Els pots tornar a afegir des de «Completa el perfil».",
  ];
  const password = "Si no recordes la contrasenya, la pots recuperar des de la pàgina d'inici de sessió.";
  const contact = `Per a qualsevol dubte, escriu-nos a ${CONTACT_EMAIL}.`;

  const text = [
    hello,
    intro,
    `${signIn}\n${PROFILE_URL}`,
    notes.map((note) => `- ${note}`).join("\n"),
    password,
    contact,
    `${SIGNATURE}\n${SITE_URL}`,
  ].join("\n\n");

  const html = [
    htmlParagraph(hello),
    htmlParagraph(intro),
    `<p>${escapeHtml(signIn)}<br />${PROFILE_LINK}</p>`,
    `<ul>\n${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("\n")}\n</ul>`,
    htmlParagraph(password),
    `<p>Per a qualsevol dubte, escriu-nos a ${CONTACT_LINK}.</p>`,
    HTML_SIGNATURE,
  ].join("\n");

  return { subject: "Tornes a ser soci de Darkstone Catalunya", text, html };
}
