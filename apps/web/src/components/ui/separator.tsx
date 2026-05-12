import * as S from "@radix-ui/react-separator";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Separator({
  className,
  orientation = "horizontal",
  ...p
}: ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      decorative
      orientation={orientation}
      className={cn(
        "shrink-0 bg-line/70",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...p}
    />
  );
}
