/** First letter of the first and last name, upper-cased ("Ada Lovelace" -> "AL"). */
export function getInitials(firstName: string, lastName: string): string {
  const first = Array.from(firstName.trim())[0] ?? "";
  const last = Array.from(lastName.trim())[0] ?? "";
  return (first + last).toLocaleUpperCase();
}
