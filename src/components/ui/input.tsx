import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-all duration-150 outline-none placeholder:text-muted-foreground/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
        "focus:border-ring focus:shadow-focus",
        "aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--destructive)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
