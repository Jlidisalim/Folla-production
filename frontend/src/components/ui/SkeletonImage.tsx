import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

type SkeletonImageProps = {
  variant?: "square" | "rectangle" | "rounded";
  aspectRatio?: string;
  className?: string;
};

const VARIANT_CLASSES = {
  square: "aspect-square rounded-md",
  rectangle: "aspect-video rounded-md",
  rounded: "aspect-square rounded-full",
};

const DEFAULT_ASPECTS = {
  square: "1/1",
  rectangle: "16/9",
  rounded: "1/1",
};

export function SkeletonImage({
  variant = "square",
  aspectRatio,
  className,
}: SkeletonImageProps) {
  const aspect = aspectRatio || DEFAULT_ASPECTS[variant];

  return (
    <Skeleton
      className={cn(VARIANT_CLASSES[variant], className)}
      style={{ aspectRatio: aspect }}
      role="status"
      aria-busy="true"
    />
  );
}

export default SkeletonImage;
