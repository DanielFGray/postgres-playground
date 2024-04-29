import clsx from "classnames";
import { classed } from "@tw-classed/react";
import { Input as AriaInput, Button as AriaButton } from "react-aria-components";

export const Error = classed("div", "bg-red-100 p-2 text-red-800");

export const Input = classed(
  AriaInput,
  "px-2 py-1.5 flex-1 min-w-0 outline outline-0 bg-white dark:bg-primary-900 text-sm text-primary-800 dark:text-primary-200 disabled:text-primary-200 dark:disabled:text-primary-600"
)

export const Button = classed(
  AriaButton,
  "border-0 font-bold tracking-wide shadow-md shadow-primary-400/50 transition-color duration-200 shadow-black/30 dark:shadow-black/40",
  "focus:outline-primary-700 focus:ring-2 focus:ring-primary-300",
  "hover:shadow-lg focus:shadow-none disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-30 disabled:shadow-none",
  {
    variants: {
      color: {
        danger: "bg-red-200 text-red-900 hover:bg-red-300",
        primary: "bg-primary-600 text-primary-100 hover:bg-primary-500",
        default:
          "bg-primary-100 hover:bg-primary-50 text-primary-900 dark:hover:bg-primary-600 hover:bg-primary-50 dark:bg-primary-700 dark:text-primary-100",
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
