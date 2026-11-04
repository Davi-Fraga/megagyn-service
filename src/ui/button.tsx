import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-acento text-white hover:bg-acento-escuro border-transparent",
  secondary: "bg-papel text-grafite border-grafite hover:bg-concreto",
  ghost: "bg-transparent text-grafite border-transparent hover:bg-concreto-2",
  danger: "bg-papel text-erro border-erro hover:bg-erro-claro",
  dark: "bg-grafite text-white border-transparent hover:bg-grafite-2",
};
const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-5 text-[0.95rem]",
  lg: "min-h-14 px-5 text-[1.0625rem] w-full",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-ctl border font-semibold leading-tight transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-55",
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

export function Button({ variant, size, icon, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

type LinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

export function ButtonLink({ variant, size, icon, className, children, ...rest }: LinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
