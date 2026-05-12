import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: "right" | "left" | "bottom";
}

export function Sheet({ open, onOpenChange, children, side = "right" }: SheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.aside
                initial={sideFrom(side)}
                animate={{ x: 0, y: 0, opacity: 1 }}
                exit={sideFrom(side)}
                transition={{ type: "spring", stiffness: 280, damping: 30 }}
                className={cn(
                  "glass-strong fixed z-50 flex flex-col gap-2 rounded-2xl shadow-glass",
                  side === "right" && "right-0 top-0 h-full w-[min(720px,92vw)] rounded-l-2xl rounded-r-none border-l border-line",
                  side === "left" && "left-0 top-0 h-full w-[min(420px,92vw)] rounded-r-2xl rounded-l-none border-r border-line",
                  side === "bottom" && "bottom-0 left-0 right-0 h-[min(80vh,720px)] rounded-b-none border-t border-line",
                )}
              >
                {children}
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}

function sideFrom(side: "right" | "left" | "bottom") {
  if (side === "right") return { x: 40, opacity: 0 };
  if (side === "left") return { x: -40, opacity: 0 };
  return { y: 40, opacity: 0 };
}

export const SheetHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex items-start justify-between gap-4 border-b border-line px-6 py-5", className)}>{children}</div>
);
export const SheetBody = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)}>{children}</div>
);
export const SheetFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex items-center justify-end gap-3 border-t border-line px-6 py-4", className)}>{children}</div>
);
