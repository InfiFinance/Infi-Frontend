"use client";

import { useState } from 'react';
import { message } from 'antd';
import { useAppKitAccount } from '@reown/appkit/react';

export default function TestnetTokens() {
  const { isConnected, address } = useAppKitAccount();
  const [isRequesting, setIsRequesting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleRequestTokens = async () => {
    if (!isConnected || !address) {
      messageApi.error('Please connect your wallet first and ensure address is available');
      return;
    }

    setIsRequesting(true);
    messageApi.loading({ content: 'Requesting testnet tokens... This may take a moment.', key: 'tokenRequest' });

    try {
      const response = await fetch(`/api/send-erc20?walletAddress=${address}`);
      const data = await response.json();

      if (!response.ok) {
        console.error('API request failed:', data);
        messageApi.error({ 
          content: `Error: ${data.error || 'Failed to request tokens. Please try again.'} (HTTP ${response.status})`, 
          key: 'tokenRequest' 
        });
        setIsRequesting(false);
        return;
      }

      // Process results for each token
      let allSuccessfulOrAlreadyMinted = true; // Tracks if all tokens are either success or already_minted
      let actualErrors = false; // Tracks if any token had a hard error

      if (data.results && Array.isArray(data.results)) {
        data.results.forEach((result: any) => {
          if (result.status === 'success') {
            messageApi.success({ 
              content: `${result.token} minted successfully! Tx: ${result.txHash.substring(0, 10)}...`, 
              duration: 5 
            });
          } else if (result.status === 'already_minted') {
            messageApi.info({ 
              content: `${result.token}: ${result.message || 'Already claimed by your wallet.'}`, 
              duration: 5 
            });
            // This case is not considered a failure for the overall message
          } else if (result.status === 'system_error') {
            messageApi.error({
              content: `System error processing ${result.token || 'request'}: ${result.error || 'Failed to update records.'}`, 
              duration: 7
            });
            allSuccessfulOrAlreadyMinted = false; // A system error during save is a problem
            actualErrors = true;
          } else { // Covers 'error' status
            allSuccessfulOrAlreadyMinted = false;
            actualErrors = true;
            messageApi.error({ 
              content: `Error minting ${result.token}: ${result.error || 'Unknown error'}`,
              duration: 5 
            });
          }
        });
      }

      if (actualErrors) {
        messageApi.error({ content: 'Errors occurred during token request. Please check messages above and console.', key: 'tokenRequest', duration: 7 });
      } else if (allSuccessfulOrAlreadyMinted) { // Corrected variable name here
        messageApi.success({ content: 'Token request processed! Check messages above for details.', key: 'tokenRequest', duration: 5 });
      } else {
        // This case implies not all were successful/already_minted, but no actualErrors flagged - e.g. if only system_error without other errors.
        // Or if allSuccessfulOrAlreadyMinted was set to false by a system_error, but actualErrors remained false (if that path was possible).
        messageApi.warning({ content: 'Token request processed with mixed results. Check messages and console.', key: 'tokenRequest', duration: 5 });
      }

    } catch (error) {
      console.error('Failed to request tokens:', error);
      messageApi.error({ 
        content: 'An unexpected error occurred while requesting tokens. Please check the console.', 
        key: 'tokenRequest' 
      });
    }

    setIsRequesting(false);
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