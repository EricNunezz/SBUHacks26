import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn helper: join class names and resolve Tailwind conflicts
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
