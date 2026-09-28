import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-medium tracking-[-0.005em] transition-[background,box-shadow,border-color,color,filter,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "btn-primary bg-brand text-white shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_0_0_1px_rgba(114,80,238,0.6),0_6px_20px_-8px_rgba(114,80,238,0.8)] hover:brightness-110",
        secondary:
          "btn-secondary border border-line-strong bg-white/[0.03] text-fg shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] hover:border-white/[0.18] hover:bg-white/[0.06]",
        ghost: "text-fg-2 hover:bg-white/[0.05] hover:text-fg",
        outline: "border border-violet/35 text-violet-200 hover:border-violet/60 hover:bg-violet/[0.08]",
        danger: "border border-danger/40 bg-danger/10 text-red-300 hover:bg-danger/20",
      },
      size: {
        sm: "h-8 px-3 text-[12px]",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-[14px]",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, ...props },
  ref,
) {
  return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

type LinkButtonProps = ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

export function LinkButton({ className, variant, size, ...props }: LinkButtonProps) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
