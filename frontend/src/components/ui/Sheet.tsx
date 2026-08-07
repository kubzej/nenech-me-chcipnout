import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { Text } from "./Text";
import "./sheet.css";

type SheetProps = {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
};

export function Sheet({ children, isOpen, onClose, title }: SheetProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="sheet" role="presentation">
      <button
        aria-label="Zavřít"
        className="sheet__backdrop"
        onClick={onClose}
        type="button"
      />
      <section aria-modal="true" className="sheet__panel" role="dialog">
        <div className="sheet__header">
          <Text variant="title">{title}</Text>
          <IconButton
            icon={<X aria-hidden="true" size={22} />}
            label="Zavřít"
            onClick={onClose}
            variant="surface"
          />
        </div>
        {children}
      </section>
    </div>
  );
}
