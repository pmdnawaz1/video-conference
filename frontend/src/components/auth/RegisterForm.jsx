import React, { useState } from 'react';
import useAuthStore from '../../stores/authStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const RegisterForm = ({ onSuccess, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    organization: ''
  });
  const [localError, setLocalError] = useState('');
  
  const { register, isRegistering, error } = useAuthStore();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
      return 'Please fill in all required fields';
    }
    
    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address';
    }
    
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    
    const validationError = validateForm();
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    
    const userData = {
      email: formData.email,
      password: formData.password,
      first_name: formData.firstName,
      last_name: formData.lastName,
      organization: formData.organization || null
    };
    
    const result = await register(userData);
    
    if (result.success) {
      onSuccess && onSuccess(result.user);
    }
  };

  const displayError = localError || error;

  return (
    <Card className="w-full max-w-md mx-auto p-6">
      <div className="space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-gray-600">Join our enterprise platform</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium mb-1">
                First Name *
              </label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="John"
                disabled={isRegistering}
                required
              />
            </div>
            
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium mb-1">
                Last Name *
              </label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Doe"
                disabled={isRegistering}
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email Address *
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="john.doe@company.com"
              disabled={isRegistering}
              required
            />
          </div>
          
          <div>
            <label htmlFor="organization" className="block text-sm font-medium mb-1">
              Organization
            </label>
            <Input
              id="organization"
              name="organization"
              type="text"
              value={formData.organization}
              onChange={handleChange}
              placeholder="Your Company Name"
              disabled={isRegistering}
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password *
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              disabled={isRegistering}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be at least 8 characters long
            </p>
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
              Confirm Password *
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              disabled={isRegistering}
              required
            />
          </div>
          
          {displayError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm">{displayError}</p>
            </div>
          )}
          
          <Button
            type="submit"
            className="w-full"
            disabled={isRegistering}
          >
            {isRegistering ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>
        
        <div className="text-center pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-blue-600 hover:text-blue-500 font-medium"
              disabled={isRegistering}
            >
              Sign in
            </button>
          </p>
        </div>
        
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Enterprise Video Conference Platform
          </p>
        </div>
      </div>
    </Card>
  );
};

export default RegisterForm;