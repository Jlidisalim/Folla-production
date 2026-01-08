import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

type SkeletonButtonProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASSES = {
  sm: "h-8 w-20",
  md: "h-10 w-28",
  lg: "h-12 w-36",
};

export function SkeletonButton({ size = "md", className }: SkeletonButtonProps) {
  return (
    <Skeleton
      className={cn("rounded-lg", SIZE_CLASSES[size], className)}
      role="status"
      aria-busy="true"
    />
  );
}

export default SkeletonButton;
