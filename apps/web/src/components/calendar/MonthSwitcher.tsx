import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthLabel } from "@/lib/utils";

interface MonthSwitcherProps {
  month: Date;
  onChange: (d: Date) => void;
  rightSlot?: React.ReactNode;
}

export function MonthSwitcher({ month, onChange, rightSlot }: MonthSwitcherProps) {
  const prev = () => onChange(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const next = () => onChange(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={prev} aria-label="Предыдущий месяц">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-display text-2xl font-semibold tracking-tight capitalize">
          {monthLabel(month)}
        </h2>
        <Button variant="ghost" size="icon" onClick={next} aria-label="Следующий месяц">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div>{rightSlot}</div>
    </div>
  );
}
