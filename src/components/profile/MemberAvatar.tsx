import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/profile/initials";

type MemberAvatarProps = {
  firstName: string;
  lastName: string;
  className?: string;
};

/** Initials on an orange disc. Decorative: the member's name is always rendered next to it. */
export default function MemberAvatar({ firstName, lastName, className }: MemberAvatarProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="member-avatar"
      className={cn(
        "flex size-20 shrink-0 items-center justify-center rounded-full bg-brand-orange text-3xl font-bold text-brand-white sm:size-28 sm:text-[40px]",
        className
      )}
    >
      {getInitials(firstName, lastName)}
    </div>
  );
}
