import React from 'react';
import { Loader2 } from 'lucide-react';

// Simple icon-only spinner for inline use in enterprise components
export const LoadingSpinner = ({ className = '' }) => (
  <Loader2 className={`animate-spin ${className}`} />
);

// Original full-page loading component
const LoadingPage = ({ size = 'default', text = 'Loading...' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    default: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
      {text && (
        <p className="text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );
};

export default LoadingPage;

