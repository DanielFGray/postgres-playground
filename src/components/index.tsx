import clsx from "classnames";
import { classed } from "@tw-classed/react";

export const Error = classed("div", "bg-red-100 p-2 text-red-800");

export const Button = classed(
  "button",
  "border-0 font-bold tracking-wide shadow-md shadow-primary-400/50 transition-all duration-200",
  "focus:outline-primary-700 focus:ring-2 focus:ring-primary-300",
  "hover:shadow focus:shadow-none disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-30 disabled:shadow-none",
  {
    variants: {
      color: {
        danger: "bg-red-200 text-red-900 hover:bg-red-300",
        primary: "bg-primary-600 text-primary-100 hover:bg-primary-500",
        default: "bg-primary-50 text-primary-900 hover:bg-primary-50",
      },
      size: {
        sm: "p-1 text-sm",
        md: "text-md p-2",
        lg: "px-4 py-2 text-lg",
      },
    },
    defaultVariants: { color: "default", size: "md" },
  },
);

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx("animate-spin", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        className="opacity-75"
        fill="currentColor"
      />
    </svg>
  );
}

export function Stringify(props) {
  return <pre>{JSON.stringify(props, null, 2)}</pre>;
}
