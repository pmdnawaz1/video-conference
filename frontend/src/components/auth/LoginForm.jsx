import React, { useState } from "react";
import useAuthStore from "../../stores/authStore";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card } from "../ui/card";
import { LoadingSpinner } from "../ui/LoadingSpinner";

const LoginForm = ({ onSuccess, onSwitchToRegister }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const { login, isLoggingIn, error } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    if (!email || !password) {
      setLocalError("Please enter both email and password");
      return;
    }

    const result = await login(email, password);

    if (result.success) {
      onSuccess && onSuccess();
    }
  };

  const displayError = localError || error;

  return (
    <Card className="w-full max-w-md mx-auto p-6">
      <div className="space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Welcome Back</h1>
          <p className="text-muted">
            Sign in to your enterprise account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1 text-primary">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@company.com"
              disabled={isLoggingIn}
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1 text-primary"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoggingIn}
              required
            />
          </div>

          {displayError && (
            <div className="p-3 bg-muted border border-secondary rounded-md">
              <p className="text-primary text-sm">{displayError}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoggingIn}>
            {isLoggingIn ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <div className="text-center pt-4 border-t border-primary">
          <p className="text-sm text-muted">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="btn-base btn-ghost text-primary hover:text-primary font-medium"
              disabled={isLoggingIn}
            >
              Sign up
            </button>
          </p>
        </div>

        <div className="text-center">
          <p className="text-xs text-muted">
            Enterprise Video Conference Platform
          </p>
        </div>
      </div>
    </Card>
  );
};

export default LoginForm;
