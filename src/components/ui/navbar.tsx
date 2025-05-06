"use client";
import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'

//@ts-ignore
import { ChevronDownIcon } from '@heroicons/react/24/solid'
import { useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react'

// const { open, close } = useAppKit()

// const { address, isConnected, caipAddress, status, embeddedWalletInfo } =
//   useAppKitAccount();

export function Navbar() {
  const { open, close } = useAppKit()
  const { address, isConnected, caipAddress, status, embeddedWalletInfo } =
    useAppKitAccount();

  const { disconnect } = useDisconnect();

  const [isEarnOpen, setIsEarnOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Save user effect
  useEffect(() => {
    const saveUser = async (walletAddress: string) => {
      try {
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ walletAddress }),
        });
        const data = await response.json();
        if (!response.ok) {
          console.error('Error saving user:', data.error || 'Unknown error');
        } else {
          console.log('User saved/verified:', data);
        }
      } catch (error) {
        console.error('Failed to fetch /api/users:', error);
      }
    };

    // Only run on the client-side after mount and when connected
    if (hasMounted && isConnected && address) {
      console.log('Wallet connected, attempting to save user:', address);
      saveUser(address);
    }
  }, [isConnected, address, hasMounted]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center py-3 px-4 border-b border-gray-800">
      <div className="flex items-center space-x-6">
        <Link href="/" className="text-white font-bold">
          <Image src="/logotpnt.png" alt="Infi Logo" width={200} height={50} className="h-8 w-auto" />
        </Link>
        
        <Link href="/swap" className="text-white font-medium hover:text-white">
          Swap
        </Link>
        
        {/* Earn Dropdown */}
        <div className="relative">
          <button 
            className="flex items-center text-gray-500 hover:text-white"
            onClick={() => setIsEarnOpen(!isEarnOpen)}
            onBlur={() => setTimeout(() => setIsEarnOpen(false), 100)}
          >
            <span>Earn</span>
            <svg 
              className="ml-1 w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          
          {isEarnOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#0e1420] bg-opacity-80 backdrop-blur-md rounded-lg border border-[#1b2131] py-1 z-10">
              <Link 
                href="/pools" 
                className="block px-4 py-2 text-white hover:bg-[#171f2e] hover:bg-opacity-70 transition-colors"
                onClick={() => setIsEarnOpen(false)}
              >
                Pools
              </Link>
              <Link 
                href="/create-pool" 
                className="block px-4 py-2 text-white hover:bg-[#171f2e] hover:bg-opacity-70 transition-colors"
                onClick={() => setIsEarnOpen(false)}
              >
                Create Pool
              </Link>
              <Link 
                href="/add-liquidity" 
                className="block px-4 py-2 text-white hover:bg-[#171f2e] hover:bg-opacity-70 transition-colors"
                onClick={() => setIsEarnOpen(false)}
              >
                Add Liquidity
              </Link>
            </div>
          )}
        </div>
        
        <Link href="https://x.com/infiexchange" target="_blank" className="text-gray-500 hover:text-white">
          Contact us
        </Link>
      </div>
      
      <div>
        {!hasMounted ? (
          // Render the default state (matching server) before hydration
          <button 
            className="bg-blue-900 text-blue-500 px-4 py-2 rounded-xl font-medium hover:bg-blue-800 transition-colors hover:cursor-pointer"
            onClick={() => open?.()}
          >
            Connect
          </button>
        ) : isConnected ? (
          // Render connected state after hydration
          <div className="relative group">
            <button 
              className="group-hover:hidden bg-blue-900 text-blue-500 px-4 py-2 rounded-xl font-medium hover:bg-blue-800 transition-colors hover:cursor-pointer"
              onClick={() => close?.()}
            >
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
            <button 
              className="hidden group-hover:block bg-blue-900 text-blue-500 px-4 py-2 rounded-xl font-medium hover:bg-blue-800 transition-colors hover:cursor-pointer"
              onClick={async () => await disconnect?.()}
            >
              Logout
            </button>
          </div>
        ) : (
          // Render disconnected state after hydration
          <button 
            className="bg-blue-900 text-blue-500 px-4 py-2 rounded-xl font-medium hover:bg-blue-800 transition-colors hover:cursor-pointer"
            onClick={() => open?.()}
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}
