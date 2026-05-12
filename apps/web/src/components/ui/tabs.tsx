import * as React from "react";
import * as RTabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = RTabs.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof RTabs.List>,
  React.ComponentPropsWithoutRef<typeof RTabs.List>
>(({ className, ...p }, ref) => (
  <RTabs.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center gap-1 rounded-lg border border-line bg-bg-elevated/50 p-1 backdrop-blur",
      className,
    )}
    {...p}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof RTabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof RTabs.Trigger>
>(({ className, ...p }, ref) => (
  <RTabs.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-ink-dim transition",
      "hover:text-ink focus-ring",
      "data-[state=active]:bg-leaf data-[state=active]:text-bg data-[state=active]:shadow-glow",
      className,
    )}
    {...p}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof RTabs.Content>,
  React.ComponentPropsWithoutRef<typeof RTabs.Content>
>(({ className, ...p }, ref) => (
  <RTabs.Content ref={ref} className={cn("mt-4 focus-ring", className)} {...p} />
));
TabsContent.displayName = "TabsContent";
