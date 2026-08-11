import type { ReactNode } from "react";
import { Text } from "./Text";
import "./screen-header.css";

type ScreenHeaderProps = {
  action?: ReactNode;
  title: string;
  titleBadge?: ReactNode;
  subtitle?: string;
};

export function ScreenHeader({ action, subtitle, title, titleBadge }: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      <div>
        <div className="screen-header__title-row">
          <Text as="h1" variant="kicker">
            {title}
          </Text>
          {titleBadge}
        </div>
        {subtitle ? <Text variant="heading">{subtitle}</Text> : null}
      </div>
      {action ? <div className="screen-header__action">{action}</div> : null}
    </header>
  );
}
