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
    return createAvatar(micah, {
      backgroundColor: ["d9ef6e", "8ed6d1", "f4c76a", "f27d80"],
      backgroundType: ["gradientLinear"],
      radius: 50,
      seed,
    }).toDataUri();
  }, [seed]);

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
