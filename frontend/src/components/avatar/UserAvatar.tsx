import { createAvatar } from "@dicebear/core";
import { micah } from "@dicebear/collection";
import { useMemo } from "react";
import "./user-avatar.css";

type UserAvatarProps = {
  label: string;
  seed: string;
  size?: "sm" | "md";
};

export function UserAvatar({ label, seed, size = "md" }: UserAvatarProps) {
  const avatarSrc = useMemo(() => {
    const persona = getPersona(label, seed);
    const avatarSeed = persona.seed ?? seed;

    return createAvatar(micah, {
      backgroundColor: ["d9ef6e", "8ed6d1", "f4c76a", "f27d80"],
      backgroundType: ["gradientLinear"],
      radius: 50,
      seed: avatarSeed,
    }).toDataUri();
  }, [label, seed]);

  return (
    <img
      alt={label}
      className={`user-avatar user-avatar--${size}`}
      height={size === "sm" ? 40 : 56}
      src={avatarSrc}
      width={size === "sm" ? 40 : 56}
    />
  );
}

function getPersona(label: string, seed: string): { seed?: string } {
  const normalized = `${label} ${seed}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/\b(terka|terca|terci|tercu|tereza|terezi|terezka)\b/.test(normalized)) {
    return {
      seed: "6pmwkqa0",
    };
  }

  if (/\b(jakub|kub[aao]?|ja)\b/.test(normalized)) {
    return {
      seed: "p0zig6eu",
    };
  }

  return {};
}
