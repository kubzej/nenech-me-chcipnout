import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./plant-avatar.css";

type PlantAvatarProps = {
  bucket: string | null;
  path: string | null;
  label: string;
  size?: "sm" | "md" | "lg" | "full";
};

const ICON_SIZE: Record<NonNullable<PlantAvatarProps["size"]>, number> = {
  sm: 18,
  md: 26,
  lg: 40,
  full: 48,
};

export function PlantAvatar({ bucket, path, label, size = "md" }: PlantAvatarProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    setSignedUrl(null);

    if (!supabase || !bucket || !path) {
      return;
    }

    let isActive = true;

    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (isActive && data) {
          setSignedUrl(data.signedUrl);
        }
      });

    return () => {
      isActive = false;
    };
  }, [bucket, path]);

  if (!signedUrl) {
    return (
      <div className={`plant-avatar plant-avatar--${size} plant-avatar--placeholder`}>
        <Leaf aria-hidden="true" size={ICON_SIZE[size]} strokeWidth={2.1} />
      </div>
    );
  }

  return (
    <img alt={label} className={`plant-avatar plant-avatar--${size}`} src={signedUrl} />
  );
}
