import { useCallback, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Text } from "./Text";
import "./confirm-dialog.css";

type ConfirmDialogTone = "default" | "danger";

type ConfirmOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  message?: string;
  title: string;
  tone?: ConfirmDialogTone;
};

type ConfirmRequest = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

export function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setRequest({ options, resolve });
    });
  }, []);

  function close(value: boolean) {
    if (!request) {
      return;
    }

    request.resolve(value);
    setRequest(null);
  }

  const confirmDialog = request ? (
    <div className="confirm-dialog" role="presentation">
      <button
        aria-label="Zrušit"
        className="confirm-dialog__backdrop"
        onClick={() => close(false)}
        type="button"
      />
      <section aria-modal="true" className="confirm-dialog__panel" role="dialog">
        <div
          className={`confirm-dialog__icon confirm-dialog__icon--${
            request.options.tone ?? "default"
          }`}
        >
          <AlertTriangle aria-hidden="true" size={22} />
        </div>
        <div className="confirm-dialog__content">
          <Text as="h2" variant="title">
            {request.options.title}
          </Text>
          {request.options.message ? (
            <Text as="p" tone="muted" variant="body">
              {request.options.message}
            </Text>
          ) : null}
        </div>
        <div className="confirm-dialog__actions">
          <Button onClick={() => close(false)} type="button" variant="ghost">
            {request.options.cancelLabel ?? "Zrušit"}
          </Button>
          <Button
            className={
              request.options.tone === "danger" ? "confirm-dialog__danger-button" : ""
            }
            onClick={() => close(true)}
            type="button"
          >
            {request.options.confirmLabel ?? "Potvrdit"}
          </Button>
        </div>
      </section>
    </div>
  ) : null;

  return { confirm, confirmDialog };
}
