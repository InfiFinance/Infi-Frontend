"use client";
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/solid'
import Eth from '../../../public/vercel.svg'
import Logo from '../../../public/vercel.svg'
import { createAppKit, useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { projectId, metadata, networks, wagmiAdapter } from '../../config/reown'


const generalConfig = {
  projectId,
  networks,
  metadata,
  themeMode: 'dark' as const,
}

// Create modal
createAppKit({
  adapters: [wagmiAdapter],
  ...generalConfig,
  features: {
    analytics: false
  }
})
// const { open, close } = useAppKit()

// const { address, isConnected, caipAddress, status, embeddedWalletInfo } =
//   useAppKitAccount();


export function Navbar() {
  const { open, close } = useAppKit()
  const { address, isConnected, caipAddress, status, embeddedWalletInfo } =
  useAppKitAccount();

  const [isEarnOpen, setIsEarnOpen] = useState(false);
  return (
    <header>
      <div className='leftH'>
        <Image src={Logo} alt='eth' className='logo' />
        <Link href='/' className='link'>
          <div className='headerItem'>Swap</div>  
        </Link>
        {/* <Link href='/tokens' className='link'>
          <div className='headerItem'>Tokens</div>
        </Link> */}
        <div className='relative group'
          onMouseEnter={() => setIsEarnOpen(true)}
          onMouseLeave={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const isInDropdown = 
              e.clientY >= rect.top &&
              e.clientY <= rect.bottom + 150 && // Add extra height for dropdown
              e.clientX >= rect.left &&
              e.clientX <= rect.left + 192; // Dropdown width (w-48 = 12rem = 192px)
            if (!isInDropdown) {
              setIsEarnOpen(false);
            }
          }}
        >
          <div 
            className='headerItem flex items-center gap-1 cursor-pointer'
          >
            Earn
            <ChevronDownIcon className='w-4 h-4' />
          </div>
          {isEarnOpen && (
            <div className='absolute top-full left-0 mt-1 w-48 bg-[#1f2639] rounded-lg shadow-lg border border-[#21273a] py-2'>
              <Link href='/pools' className='link' onClick={() => setIsEarnOpen(false)}>
                <div className='px-4 py-2 hover:bg-[#2c364f] cursor-pointer'>Pools</div>
              </Link>
              <Link href='/add-liquidity' className='link' onClick={() => setIsEarnOpen(false)}>
                <div className='px-4 py-2 hover:bg-[#2c364f] cursor-pointer'>Add liquidity</div>
              </Link>
              <Link href='/create-liquidity' className='link' onClick={() => setIsEarnOpen(false)}>
                <div className='px-4 py-2 hover:bg-[#2c364f] cursor-pointer'>Create liquidity</div>
              </Link>
            </div>
          )}
        </div>
        <Link href='https://x.com/infiexchange' className='link'>
          <div className='headerItem'>Contact us</div>
        </Link>
      </div>
      <div className='rightH'>
        <div className='headerItem'>
       {/* onClick close tbd */}
        </div>
        {isConnected ? (
          <div className='relative group'>
            <div className='connectButton group-hover:hidden' onClick={() => close()}>
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
            <div className='connectButton hidden group-hover:block' onClick={() => close()}>
              Logout
            </div>
          </div>
        ) : (
          <div className='connectButton' onClick={() => open()}>
            Connect
          </div>
        )}
      </div>
    </header>
  )
}
