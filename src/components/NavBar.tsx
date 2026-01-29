"use client";

import Image from "next/image";
import { Link } from "@/i18n/routing";
import LanguageSwitcher from "./LanguageSwitcher";

export default function NavBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 py-3">
      <div className="container mx-auto flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative h-10 w-10 overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-105">
            <Image
              src="/images/darkstone_logo.png"
              alt="Darkstone Logo"
              fill
              className="object-cover"
            />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Darkstone<span className="font-light opacity-60">.cat</span>
          </span>
        </Link>

        <LanguageSwitcher />
      </div>
    </nav>
  );
}
