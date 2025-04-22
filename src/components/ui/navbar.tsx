"use client";
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

//@ts-ignore
import { ChevronDownIcon } from '@heroicons/react/24/solid'
import {  useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react'



// const { open, close } = useAppKit()

// const { address, isConnected, caipAddress, status, embeddedWalletInfo } =
//   useAppKitAccount();


export function Navbar() {
  const { open, close } = useAppKit()
  const { address, isConnected, caipAddress, status, embeddedWalletInfo } =
  useAppKitAccount();

  const { disconnect } = useDisconnect();

  const [isEarnOpen, setIsEarnOpen] = useState(false);
  return (
    <header>
      <div className='leftH'>
        <Image src={"vercel.svg"} alt='eth' className='logo' width={100} height={100}/>
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
            <div className='connectButton hidden group-hover:block' onClick={async ()=> await disconnect()}>
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
