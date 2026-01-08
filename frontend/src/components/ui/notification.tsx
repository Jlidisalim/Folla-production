// src/components/ui/notification.tsx
import {
  Check,
  X as CloseIcon,
  Info,
  AlertTriangle,
  CircleX,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NotificationType = "success" | "error" | "info" | "warning";

interface NotificationProps {
  type: NotificationType;
  message: string;
  onClose: () => void;
}

export function Notification({ type, message, onClose }: NotificationProps) {
  const icons = {
    success: Check,
    error: CircleX,
    info: Info,
    warning: AlertTriangle,
  };

  const Icon = icons[type];

  const iconBgColors = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500",
    warning: "bg-yellow-500",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3 rounded-lg shadow-lg bg-gray-900 text-white max-w-sm"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn("rounded-full p-1", iconBgColors[type])}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm">{message}</span>
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-white">
        <CloseIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
