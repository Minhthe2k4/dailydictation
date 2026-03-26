"use client";

import { signIn, signOut } from "next-auth/react";

type AuthButtonsProps = {
  isAuthenticated: boolean;
  userName?: string | null;
};

export function AuthButtons({ isAuthenticated, userName }: AuthButtonsProps) {
  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl: "/" })}
        className="cursor-pointer rounded-full border border-[#0f3f42] bg-[#0f3f42] px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-[#0a2d2f]"
      >
        Đăng nhập với Google
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[#0f3f42]">{userName ?? "Người dùng"}</span>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="cursor-pointer rounded-full border border-[#0f3f42] px-4 py-2 text-sm font-semibold text-[#0f3f42] transition hover:bg-[#e9f4f4]"
      >
        Đăng xuất
      </button>
    </div>
  );
}
