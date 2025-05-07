"use client";
import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

//@ts-ignore
import { ChevronDownIcon } from '@heroicons/react/24/solid'
import { useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react'

// const { open, close } = useAppKit()

// const { address, isConnected, caipAddress, status, embeddedWalletInfo } =
//   useAppKitAccount();

export function Navbar() {
  const pathname = usePathname();
  const { open, close } = useAppKit()
  const { address, isConnected, caipAddress, status, embeddedWalletInfo } =
    useAppKitAccount();

  const { disconnect } = useDisconnect();

  const [isEarnOpen, setIsEarnOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isMobileMenuOpen && !target.closest('.mobile-menu') && !target.closest('.hamburger-button')) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center py-3 px-4 border-b border-gray-800">
      {/* Left side - Logo and Desktop Navigation */}
      <div className="flex items-center">
        <Link href="/" className="text-white font-bold">
          <Image src="/logotpnt.png" alt="Infi Logo" width={200} height={50} className="h-8 w-auto" />
        </Link>
        
        {/* Desktop Navigation - hidden on mobile */}
        <div className="hidden md:flex items-center space-x-6 ml-6">
          <Link 
            href="/swap" 
            className={`font-medium transition-colors ${
              isActive('/swap') ? 'text-white' : 'text-gray-500 hover:text-white'
            }`}
          >
            Swap
          </Link>
          
          {/* Earn Dropdown */}
          <div className="relative">
            <button 
              className={`flex items-center transition-colors ${
                isActive('/pools') || isActive('/create-pool') || isActive('/add-liquidity')
                  ? 'text-white'
                  : 'text-gray-500 hover:text-white'
              }`}
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
                  className={`block px-4 py-2 transition-colors ${
                    isActive('/pools') ? 'text-white bg-[#171f2e] bg-opacity-70' : 'text-white hover:bg-[#171f2e] hover:bg-opacity-70'
                  }`}
                  onClick={() => setIsEarnOpen(false)}
                >
                  Pools
                </Link>
                <Link 
                  href="/create-pool" 
                  className={`block px-4 py-2 transition-colors ${
                    isActive('/create-pool') ? 'text-white bg-[#171f2e] bg-opacity-70' : 'text-white hover:bg-[#171f2e] hover:bg-opacity-70'
                  }`}
                  onClick={() => setIsEarnOpen(false)}
                >
                  Create Pool
                </Link>
                <Link 
                  href="/add-liquidity" 
                  className={`block px-4 py-2 transition-colors ${
                    isActive('/add-liquidity') ? 'text-white bg-[#171f2e] bg-opacity-70' : 'text-white hover:bg-[#171f2e] hover:bg-opacity-70'
                  }`}
                  onClick={() => setIsEarnOpen(false)}
                >
                  Add Liquidity
                </Link>
              </div>
            )}
          </div>
          
          <Link 
            href="/testnet-tokens" 
            className={`transition-colors ${
              isActive('/testnet-tokens') ? 'text-white' : 'text-gray-500 hover:text-white'
            }`}
          >
            Testnet Tokens
          </Link>
          
          <Link 
            href="/create-tokens" 
            className={`transition-colors ${
              isActive('/create-tokens') ? 'text-white' : 'text-gray-500 hover:text-white'
            }`}
          >
            Create Tokens
          </Link>
          
          <Link 
            href="https://x.com/infiexchange" 
            target="_blank" 
            className="text-gray-500 hover:text-white transition-colors"
          >
            Contact us
          </Link>
        </div>
      </div>
      
      {/* Right side - Wallet Connect and Mobile Menu */}
      <div className="flex items-center">
        {/* Hamburger Menu Button - visible only on mobile */}
        <button 
          className="md:hidden mr-4 text-gray-400 hover:text-white hamburger-button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        
        {/* Wallet Connect Button */}
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
      
      {/* Mobile Menu - visible only when hamburger is clicked */}
      {isMobileMenuOpen && (
        <div className="mobile-menu fixed top-[57px] left-0 right-0 bg-[#0e1420] bg-opacity-95 backdrop-blur-md border-b border-gray-800 md:hidden z-50">
          <div className="flex flex-col py-2">
            <Link 
              href="/swap" 
              className={`px-4 py-3 transition-colors ${
                isActive('/swap') ? 'text-white bg-[#171f2e]' : 'text-gray-300 hover:text-white hover:bg-[#171f2e]'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Swap
            </Link>
            
            <div className="px-4 py-3">
              <div className={`mb-2 ${
                isActive('/pools') || isActive('/create-pool') || isActive('/add-liquidity')
                  ? 'text-white'
                  : 'text-gray-300'
              }`}>Earn</div>
              <div className="pl-4 flex flex-col space-y-2">
                <Link 
                  href="/pools" 
                  className={`transition-colors ${
                    isActive('/pools') ? 'text-white' : 'text-gray-300 hover:text-white'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Pools
                </Link>
                <Link 
                  href="/create-pool" 
                  className={`transition-colors ${
                    isActive('/create-pool') ? 'text-white' : 'text-gray-300 hover:text-white'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Create Pool
                </Link>
                <Link 
                  href="/add-liquidity" 
                  className={`transition-colors ${
                    isActive('/add-liquidity') ? 'text-white' : 'text-gray-300 hover:text-white'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Add Liquidity
                </Link>
              </div>
            </div>
            
            <Link 
              href="/testnet-tokens" 
              className={`px-4 py-3 transition-colors ${
                isActive('/testnet-tokens') ? 'text-white bg-[#171f2e]' : 'text-gray-300 hover:text-white hover:bg-[#171f2e]'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Testnet Tokens
            </Link>
            
            <Link 
              href="/create-tokens" 
              className={`px-4 py-3 transition-colors ${
                isActive('/create-tokens') ? 'text-white bg-[#171f2e]' : 'text-gray-300 hover:text-white hover:bg-[#171f2e]'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Create Tokens
            </Link>
            
            <Link 
              href="https://x.com/infiexchange" 
              target="_blank" 
              className="px-4 py-3 text-gray-300 hover:text-white hover:bg-[#171f2e] transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Contact us
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
