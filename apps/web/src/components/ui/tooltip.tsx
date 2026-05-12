import * as React from "react";
import * as T from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = T.Provider;
export const Tooltip = T.Root;
export const TooltipTrigger = T.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof T.Content>,
  React.ComponentPropsWithoutRef<typeof T.Content>
>(({ className, sideOffset = 6, ...p }, ref) => (
  <T.Portal>
    <T.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-xs rounded-md border border-line bg-bg-elevated px-3 py-1.5 text-xs text-ink shadow-glass",
        "data-[state=delayed-open]:animate-fade-up",
        className,
      )}
      {...p}
    />
  </T.Portal>
));
TooltipContent.displayName = "TooltipContent";
