export type CollaboratorCategory =
  | "government"
  | "publishers"
  | "shops"
  | "clubs"
  | "creators";

export interface Collaborator {
  id: string;
  name: string;
  slug: string;
  category: CollaboratorCategory;
  logo: string;
  url: string;
  brandColor?: string; // Hex color for card/modal background accent
  invertLogo?: boolean; // Invert logo to white when on dark brandColor
}

export const CATEGORY_ORDER: CollaboratorCategory[] = [
  "government",
  "publishers",
  "shops",
  "clubs",
  "creators",
];

export const collaborators: Collaborator[] = [
  // ── Government & Institutions ──────────────────────────────────
  {
    id: "ajuntament-terrassa",
    name: "Ajuntament de Terrassa",
    slug: "ajuntament-terrassa",
    category: "government",
    logo: "/images/icons/logo-terrassa.svg",
    url: "https://www.terrassa.cat",
    brandColor: "#E42313",
    invertLogo: true,
  },
  {
    id: "diputacio-barcelona",
    name: "Diputació de Barcelona",
    slug: "diputacio-barcelona",
    category: "government",
    logo: "/images/icons/logo_diputaciobarcelona.svg",
    url: "https://www.diba.cat",
    brandColor: "#9D2235",
    invertLogo: true,
  },

  // ── Publishers ─────────────────────────────────────────────────
  {
    id: "devir",
    name: "Devir",
    slug: "devir",
    category: "publishers",
    logo: "/images/logos/collaborators/editorials/logo_devir.webp",
    url: "https://devir.es",
    brandColor: "#1F2448",
  },
  {
    id: "maldito-games",
    name: "Maldito Games",
    slug: "maldito-games",
    category: "publishers",
    logo: "/images/logos/collaborators/editorials/logo_maldito.webp",
    url: "https://www.malditogames.com",
  },
  {
    id: "2-tomatoes",
    name: "2 Tomatoes",
    slug: "2-tomatoes",
    category: "publishers",
    logo: "/images/logos/collaborators/editorials/logo_2tomatoes.webp",
    url: "https://2tomatoesgames.com",
    brandColor: "#D61518",
  },
  {
    id: "dmz",
    name: "DMZ",
    slug: "dmz",
    category: "publishers",
    logo: "/images/logos/collaborators/editorials/logo_DMZ.webp",
    url: "https://dmzgames.com",
  },
  {
    id: "draco-ideas",
    name: "Draco Ideas",
    slug: "draco-ideas",
    category: "publishers",
    logo: "/images/logos/collaborators/editorials/logo_dracoideas.webp",
    url: "https://dracoideas.com/editorial/",
    brandColor: "#FFFFFF",
  },
  {
    id: "eclipse",
    name: "Eclipse",
    slug: "eclipse",
    category: "publishers",
    logo: "/images/logos/collaborators/editorials/logo_eclipse.webp",
    url: "https://eclipseeditorial.com/games",
    brandColor: "#FFFFFF",
  },
  {
    id: "games-4-gamers",
    name: "Games 4 Gamers",
    slug: "games-4-gamers",
    category: "publishers",
    logo: "/images/logos/collaborators/editorials/logo_g4g.webp",
    url: "https://games4gamers.com",
    brandColor: "#FFFFFF",
  },
  {
    id: "juegorama",
    name: "Juegorama",
    slug: "juegorama",
    category: "publishers",
    logo: "/images/logos/collaborators/editorials/logo_juegorama.webp",
    url: "https://juegorama.eu/",
    brandColor: "#FFFFFF",
  },
  {
    id: "key-enigma",
    name: "Key Enigma",
    slug: "key-enigma",
    category: "publishers",
    logo: "/images/logos/collaborators/editorials/logo_keyenigma.webp",
    url: "https://keyenigma.com",
    brandColor: "#000000",
  },
  {
    id: "synergic-games",
    name: "Synergic Games",
    slug: "synergic-games",
    category: "publishers",
    logo: "/images/logos/collaborators/editorials/logo_synergic_games.webp",
    url: "https://synergicgames.com",
    brandColor: "#000000",
  },
  {
    id: "tranjis-games",
    name: "Tranjis Games",
    slug: "tranjis-games",
    category: "publishers",
    logo: "/images/logos/collaborators/editorials/logo_tranjis.webp",
    url: "https://tranjisgames.com",
    brandColor: "#E72A7B",
  },
  {
    id: "trencadaus",
    name: "TrencaDaus",
    slug: "trencadaus",
    category: "publishers",
    logo: "/images/logos/collaborators/editorials/logo_trencadaus.webp",
    url: "https://trencadaus.com",
    brandColor: "#1E1A3A",
  },

  // ── Shops ──────────────────────────────────────────────────────
  {
    id: "outlet-games",
    name: "Outlet Games",
    slug: "outlet-games",
    category: "shops",
    logo: "/images/logos/collaborators/botigues/logo_outlet_games.webp",
    url: "https://outletgames.es",
    brandColor: "#000000",
  },
  {
    id: "trollcave",
    name: "Trollcave",
    slug: "trollcave",
    category: "shops",
    logo: "/images/logos/collaborators/botigues/logo_trollcave.webp",
    url: "https://www.troll-cave.com/",
    brandColor: "#000000",
  },
  {
    id: "nikochan",
    name: "Nikochan",
    slug: "nikochan",
    category: "shops",
    logo: "/images/logos/collaborators/botigues/logo_nikochan.webp",
    url: "https://nikochan.es",
    brandColor: "#000000",
  },
  {
    id: "kame-kame-comics",
    name: "Kame Kame Comics",
    slug: "kame-kame-comics",
    category: "shops",
    logo: "/images/logos/collaborators/botigues/logo_kamekame.webp",
    url: "https://www.kamekame.es/",
  },
  {
    id: "el-carton-peleon",
    name: "El Cartón Peleón",
    slug: "el-carton-peleon",
    category: "shops",
    logo: "/images/logos/collaborators/botigues/logo_el_carton_peleon.webp",
    url: "https://elcartonpeleon.com",
    brandColor: "#43444D",
  },

  // ── Clubs, Associations & Communities ──────────────────────────
  {
    id: "stastarat",
    name: "Stastarat",
    slug: "stastarat",
    category: "clubs",
    logo: "/images/logos/collaborators/clubs/logo_stastarat.webp",
    url: "https://stastarat.com",
  },
  {
    id: "la-torre-de-daus",
    name: "La Torre de Daus",
    slug: "la-torre-de-daus",
    category: "clubs",
    logo: "/images/logos/collaborators/clubs/logo_la_torre_de_daus.webp",
    url: "https://latorrededaus.cat/",
    brandColor: "#030304",
  },
  {
    id: "tastajocs",
    name: "Tastajocs",
    slug: "tastajocs",
    category: "clubs",
    logo: "/images/logos/collaborators/clubs/logo_tastajocs.webp",
    url: "https://www.tastajocs.cat",
    brandColor: "#FFFFFF",
  },
  {
    id: "darkstone-es",
    name: "Darkstone (España)",
    slug: "darkstone-es",
    category: "clubs",
    logo: "/images/logos/collaborators/clubs/logo_darkstone_es.webp",
    url: "https://darkstone.es",
    brandColor: "#CCC5C4",
  },

  // ── Content Creators ───────────────────────────────────────────
  {
    id: "professor-mompi",
    name: "Professor Mompi",
    slug: "professor-mompi",
    category: "creators",
    logo: "/images/logos/collaborators/influencers/logo_mompi.webp",
    url: "https://www.youtube.com/@ProfesorMompi",
  },
  {
    id: "jugador-inicial",
    name: "Jugador Inicial",
    slug: "jugador-inicial",
    category: "creators",
    logo: "/images/logos/collaborators/influencers/logo_jugador_inicial.webp",
    url: "https://www.youtube.com/@JugadorInicial",
    brandColor: "#000000",
  },
  {
    id: "cunyadisme-ludic",
    name: "Cunyadisme Lúdic",
    slug: "cunyadisme-ludic",
    category: "creators",
    logo: "/images/logos/collaborators/influencers/logo_cunyadisme_ludic.webp",
    url: "https://www.instagram.com/cunyadismeludic",
  },
  {
    id: "barbut-indepe",
    name: "Barbut Indepe",
    slug: "barbut-indepe",
    category: "creators",
    logo: "/images/logos/collaborators/influencers/logo_barbut_indepe.webp",
    url: "https://www.instagram.com/barbutindepe",
  },
];

export function getCollaboratorsByCategory(
  category: CollaboratorCategory
): Collaborator[] {
  return collaborators.filter((c) => c.category === category);
}

export function getCollaboratorsGrouped(): {
  category: CollaboratorCategory;
  items: Collaborator[];
}[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: getCollaboratorsByCategory(category),
  }));
}
