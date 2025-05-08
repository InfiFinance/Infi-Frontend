'use client';

import { useState, useEffect } from 'react';
import FullPageLoader from '@/components/ui/FullPageLoader';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {!isLoaded && <FullPageLoader />}
      {children}
    </>
  );
} 