'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getActiveProfile } from '@/lib/storage';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const profile = getActiveProfile();
    if (profile) {
      router.push('/dashboard');
    } else {
      router.push('/welcome');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-lg text-gray-600">Loading...</div>
    </div>
  );
}


