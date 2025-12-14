import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

const VolumeKnob = React.forwardRef(({ 
  className, 
  value, 
  onChange, 
  min = 0, 
  max = 1, 
  step = 0.001,
  label = "Volume",
  ...props 
}, ref) => {
  const [isDragging, setIsDragging] = useState(false)
  const [startY, setStartY] = useState(0)
  const [startValue, setStartValue] = useState(0)
  const knobRef = useRef(null)

  const percentage = ((value - min) / (max - min)) * 100
  const rotation = (percentage / 100) * 270 - 135 // -135 to 135 degrees

  const handleMouseDown = (e) => {
    setIsDragging(true)
    setStartY(e.clientY)
    setStartValue(value)
    e.preventDefault()
  }


  useEffect(() => {
    if (isDragging) {
      const moveHandler = (e) => {
        const deltaY = startY - e.clientY
        const sensitivity = 0.5
        const deltaValue = (deltaY / 100) * (max - min) * sensitivity
        const newValue = Math.max(min, Math.min(max, startValue + deltaValue))
        if (onChange) {
          onChange({ target: { value: newValue } })
        }
      }
      
      const upHandler = () => {
        setIsDragging(false)
      }
      
      document.addEventListener('mousemove', moveHandler)
      document.addEventListener('mouseup', upHandler)
      return () => {
        document.removeEventListener('mousemove', moveHandler)
        document.removeEventListener('mouseup', upHandler)
      }
    }
  }, [isDragging, startY, startValue, min, max, onChange])

  return (
    <div className={cn("flex flex-col items-center gap-2", className)} ref={ref} {...props}>
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <div 
        ref={knobRef}
        className="relative w-20 h-20 cursor-pointer select-none"
        onMouseDown={handleMouseDown}
      >
        {/* Knob background circle */}
        <div className="absolute inset-0 rounded-full bg-card border-2 border-border shadow-inner" />
        
        {/* Knob indicator */}
        <div 
          className="absolute top-1 left-1/2 w-1 h-3 bg-primary rounded-full transform -translate-x-1/2 origin-bottom transition-transform"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
        
        {/* Value display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-mono text-foreground">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{value.toFixed(3)}</span>
    </div>
  )
})

VolumeKnob.displayName = "VolumeKnob"

export { VolumeKnob }

