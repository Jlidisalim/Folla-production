import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

type SkeletonTextProps = {
  lines?: 1 | 2 | 3 | 4 | 5;
  className?: string;
};

// Deterministic line widths for natural look without randomness
const LINE_WIDTHS = [
  ["w-full"],
  ["w-11/12", "w-3/4"],
  ["w-full", "w-5/6", "w-2/3"],
  ["w-11/12", "w-full", "w-4/5", "w-3/4"],
  ["w-full", "w-11/12", "w-5/6", "w-full", "w-2/3"],
];

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  const widths = LINE_WIDTHS[lines - 1] || LINE_WIDTHS[2];

  return (
    <div className={cn("space-y-2", className)} role="status" aria-busy="true">
      {widths.map((width, index) => (
        <Skeleton key={index} className={cn("h-4", width)} />
      ))}
      <span className="sr-only">Chargement...</span>
    </div>
  );
}

export default SkeletonText;
