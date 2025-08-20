import * as React from "react";
import { cn } from "../../lib/utils";

function Badge({ className, variant = "default", ...props }) {
  const baseClasses = "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variantClasses = {
    default: "border-transparent bg-button-primary text-on-dark shadow hover:bg-button-primary/80",
    secondary: "border-transparent bg-button-secondary text-primary hover:bg-button-secondary/80",
    destructive: "border-transparent bg-button-destructive text-on-dark shadow hover:bg-button-destructive/80",
    success: "border-transparent bg-button-success text-on-dark shadow hover:bg-button-success/80",
    warning: "border-transparent bg-button-warning text-primary shadow hover:bg-button-warning/80",
    outline: "text-primary border-primary bg-transparent hover:bg-muted",
  };
  
  return (
    <div 
      className={cn(
        baseClasses,
        variantClasses[variant] || variantClasses.default,
        className
      )} 
      {...props} 
    />
  );
}

export { Badge };
