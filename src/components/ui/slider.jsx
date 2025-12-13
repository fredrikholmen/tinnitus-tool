import * as React from "react"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef(({ className, value, onChange, min, max, step, ...props }, ref) => {
  const handleChange = (e) => {
    if (onChange) {
      onChange(e)
    }
  }
  
  return (
    <input
      type="range"
      ref={ref}
      className={cn(
        "w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary",
        className
      )}
      value={value}
      onChange={handleChange}
      min={min}
      max={max}
      step={step}
      {...props}
    />
  )
})
Slider.displayName = "Slider"

export { Slider }

