"use client";
import { Mail } from "lucide-react";

export default function TopBar() {
  return (
    <div className="bg-[#050505]">
      <div className="mx-auto flex h-10 items-center justify-between px-4 sm:px-6 lg:px-10">
        <div className="hidden items-center gap-2 text-sm text-zinc-300 sm:flex">
          <Mail className="h-4 w-4 shrink-0" />
          <span>support@tyrevault.com.au</span>
        </div>
        <div className="hidden items-center gap-4 text-sm text-zinc-300 xl:flex">
          <span>Free shipping on all orders</span>
          <span className="text-primary">|</span>
          <span>4.8 ★ ShopperApproved rating</span>
        </div>
      </div>
    </div>
  );
}

