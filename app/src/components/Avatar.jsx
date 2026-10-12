// src/components/Avatar.jsx
import { useMemo } from "react";

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Palette agréable (20 couleurs) — échantillonnée sur ta charte
const PALETTE = [
  "#7B0503", "#B80704", "#C0392B", "#E67E22", "#D35400",
  "#16A085", "#1ABC9C", "#27AE60", "#2ECC71", "#2980B9",
  "#3498DB", "#8E44AD", "#9B59B6", "#34495E", "#2C3E50",
  "#E74C3C", "#F39C12", "#F1C40F", "#1F618D", "#7D3C98",
];

export default function Avatar({ profile, size = 32, className = "" }) {
  const { initials, bg, rounded } = useMemo(() => {
    const seed = String(
      profile?.id || profile?.email || profile?.username || "?",
    );
    const source = profile?.username || profile?.email || "?";
    const parts = source
      .replace(/[._-]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    const raw =
      (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "");
    const upper = (raw || source[0] || "?").toUpperCase().slice(0, 2);

    const h = hashString(seed);
    return {
      initials: upper,
      bg: PALETTE[h % PALETTE.length],
      rounded: h % 2 === 0,
    };
  }, [profile]);

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.username || profile.email || "avatar"}
        className={`${rounded ? "rounded-full" : "rounded-lg"} object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center font-semibold text-white ${rounded ? "rounded-full" : "rounded-lg"} ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: Math.round(size * 0.42),
        letterSpacing: 0.3,
        flexShrink: 0,
      }}
      title={profile?.username || profile?.email}
    >
      {initials}
    </div>
  );
}