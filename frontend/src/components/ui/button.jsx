import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

const Button = React.forwardRef(
  ({ className = "", variant = "primary", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    // Base button styles using unified theme system
    const baseClasses = "btn-base";
    
    // Variant styles using unified theme system
    const variantClasses = {
      primary: "btn-primary",
      secondary: "btn-secondary", 
      destructive: "btn-destructive",
      success: "btn-success",
      warning: "btn-warning",
      outline: "btn-outline",
      ghost: "btn-ghost",
      link: "text-primary hover:underline underline-offset-4 bg-transparent border-none"
    };
    
    // Size styles
    const sizeClasses = {
      default: "", // Default size handled by btn-base
      sm: "text-xs px-3 py-1.5 h-8",
      lg: "text-base px-6 py-3 h-12",
      icon: "w-10 h-10 p-0"
    };
    
    return (
      <Comp
        className={cn(
          baseClasses,
          variantClasses[variant] || variantClasses.primary,
          sizeClasses[size] || "",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
