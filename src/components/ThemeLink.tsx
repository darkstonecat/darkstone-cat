"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type ThemeLinkProps = ComponentProps<typeof Link>;

export default function ThemeLink({
  className,
  children,
  ...props
}: ThemeLinkProps) {
  return (
    <Link
      className={cn(
        "opacity-60 transition-opacity duration-300 hover:opacity-100",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
