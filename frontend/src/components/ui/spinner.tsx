import { LoaderIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Spinner({ className , ...props }: React.ComponentProps<"svg">) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn(`size-${props.fontSize || 10} animate-spin`, className)}
      {...props}
    />
  )
}

export { Spinner }