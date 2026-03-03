export interface BoardMember {
  name: string;
  roleKey: string;
  image?: string;
}

export const BOARD_MEMBERS: BoardMember[] = [
  { name: "Alba López", roleKey: "member_role_president" },
  { name: "Silvia Machado", roleKey: "member_role_secretary" },
  { name: "Ivan Martínez", roleKey: "member_role_treasurer" },
  { name: "Andreu Jaume", roleKey: "member_role_vocal" },
  { name: "Carles Sánchez", roleKey: "member_role_vocal" },
  { name: "Joan Arós", roleKey: "member_role_vocal" },
];
