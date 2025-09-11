'use client';

import { useEffect, useState } from 'react';
import PasswordProtection from './PasswordProtection';

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const isAuthenticated = sessionStorage.getItem('dashboard_authenticated');
    if (isAuthenticated === 'true') {
      setAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleAuthenticate = () => {
    setAuthenticated(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!authenticated) {
    return <PasswordProtection onAuthenticate={handleAuthenticate} />;
  }

  return <>{children}</>;
}