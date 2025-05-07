"use client";

import { useState } from 'react';
import { message } from 'antd';
import { useAppKitAccount } from '@reown/appkit/react';

export default function TestnetTokens() {
  const { isConnected, address } = useAppKitAccount();
  const [isRequesting, setIsRequesting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleRequestTokens = async () => {
    if (!isConnected) {
      messageApi.error('Please connect your wallet first');
      return;
    }

    setIsRequesting(true);
    messageApi.info('Requesting testnet tokens. This may take a few minutes...');

    // Simulate a delay (this will be replaced with actual token request logic later)
    setTimeout(() => {
      setIsRequesting(false);
      messageApi.success('Testnet tokens have been sent to your wallet!');
    }, 5000); // 5 seconds for demo, will be removed when actual functionality is added
  };

  return (
    <>
      {contextHolder}
      <div className="flex justify-center items-start py-6">
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex flex-col mb-5">
            <h4 className="text-2xl font-bold text-white mb-3">Testnet Tokens</h4>
            <p className="text-gray-400 text-sm mb-6">
              Request testnet tokens to try out swaps and other features.
            </p>
          </div>

          {/* Main Content */}
          <div className="bg-[#0e1420] rounded-lg p-6 border border-[#1b2131] w-[400px]">
            <div className="space-y-6">
              {/* Request Button */}
              <button
                onClick={handleRequestTokens}
                disabled={!isConnected || isRequesting}
                className={`w-full py-3 rounded-lg font-medium ${
                  !isConnected || isRequesting
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                }`}
              >
                {!isConnected
                  ? 'Connect Wallet'
                  : isRequesting
                    ? 'Requesting Tokens...'
                    : 'Request Testnet Tokens'}
              </button>

              {/* Instructions */}
              <div className="space-y-3">
                <h5 className="text-white font-medium">Instructions</h5>
                <ul className="text-gray-400 text-sm space-y-2">
                  <li className="flex items-start">
                    <span className="mr-2">1.</span>
                    Connect your wallet if not already connected
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">2.</span>
                    Click "Request Testnet Tokens"
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">3.</span>
                    Wait for the tokens to be sent to your wallet
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">4.</span>
                    Once received, you can use these tokens to try out swaps
                  </li>
                </ul>
              </div>

              {/* Note */}
              <p className="text-gray-500 text-sm text-center">
                Note: Testnet tokens have no real value and are for testing purposes only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 