import type { IconType } from "react-icons";
import {
  MdFavoriteBorder,
  MdOutlineAutoStories,
  MdOutlineBrush,
  MdOutlineCampaign,
  MdOutlineCardGiftcard,
  MdOutlineCasino,
  MdOutlineCelebration,
  MdOutlineEmojiEvents,
  MdOutlineExtension,
  MdOutlineGroups,
  MdOutlineHandshake,
  MdOutlineHowToReg,
  MdOutlineMilitaryTech,
  MdOutlineSchool,
  MdOutlineStarBorder,
  MdOutlineVolunteerActivism,
} from "react-icons/md";
import type { BadgeIconKey } from "@/lib/badges/catalogue";

/** The component behind each icon key of the catalogue (`badge_icon_keys()`). */
export const BADGE_ICONS: Record<BadgeIconKey, IconType> = {
  star: MdOutlineStarBorder,
  how_to_reg: MdOutlineHowToReg,
  gift: MdOutlineCardGiftcard,
  dice: MdOutlineCasino,
  puzzle: MdOutlineExtension,
  trophy: MdOutlineEmojiEvents,
  volunteer: MdOutlineVolunteerActivism,
  groups: MdOutlineGroups,
  school: MdOutlineSchool,
  celebration: MdOutlineCelebration,
  book: MdOutlineAutoStories,
  medal: MdOutlineMilitaryTech,
  heart: MdFavoriteBorder,
  handshake: MdOutlineHandshake,
  brush: MdOutlineBrush,
  megaphone: MdOutlineCampaign,
};
