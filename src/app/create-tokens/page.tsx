"use client";

import { useState } from 'react';
import { message } from 'antd';
import { useAppKitAccount } from '@reown/appkit/react';

export default function CreateTokens() {
  const { isConnected, address } = useAppKitAccount();
  const [isCreating, setIsCreating] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // Form state
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenImage, setTokenImage] = useState('');
  const [isValidImageUrl, setIsValidImageUrl] = useState(false);

  const validateImageUrl = (url: string) => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setTokenImage(url);
    setIsValidImageUrl(validateImageUrl(url));
  };

  const handleCreateToken = async () => {
    if (!isConnected) {
      messageApi.error('Please connect your wallet first');
      return;
    }

    if (!tokenName || !tokenSymbol || !tokenImage) {
      messageApi.error('Please fill in all fields');
      return;
    }

    if (!isValidImageUrl) {
      messageApi.error('Please enter a valid image URL (must start with http:// or https://)');
      return;
    }

    setIsCreating(true);
    messageApi.info('Starting token creation process. This may take a few minutes...');

    // Simulate a delay (this will be replaced with actual token creation logic later)
    setTimeout(() => {
      setIsCreating(false);
      messageApi.success('Token created successfully! You can now add liquidity to make it tradeable.');
    }, 5000); // 5 seconds for demo, will be removed when actual functionality is added
  };

  return (
    <>
      {contextHolder}
      <div className="flex justify-center items-start py-6">
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex flex-col mb-5">
            <h4 className="text-2xl font-bold text-white mb-3">Create Token</h4>
            <p className="text-gray-400 text-sm mb-6">
              Deploy your own token on the testnet. Fill in the details below to get started.
            </p>
          </div>

          {/* Main Content */}
          <div className="bg-[#0e1420] rounded-lg p-6 border border-[#1b2131] w-[400px]">
            <div className="space-y-6">
              {/* Token Creation Form */}
              <div className="space-y-4">
                {/* Token Name */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Token Name
                  </label>
                  <input
                    type="text"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="e.g., My Awesome Token"
                    className="w-full bg-[#171f2e] text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Token Symbol */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Token Symbol
                  </label>
                  <input
                    type="text"
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g., MAT"
                    className="w-full bg-[#171f2e] text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Token Image */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Token Image URL
                  </label>
                  <div className="space-y-3">
                    <input
                      type="url"
                      value={tokenImage}
                      onChange={handleImageUrlChange}
                      placeholder="e.g., https://example.com/token-image.png"
                      className="w-full bg-[#171f2e] text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {tokenImage && isValidImageUrl && (
                      <div className="w-12 h-12 bg-[#171f2e] rounded-lg overflow-hidden">
                        <img
                          src={tokenImage}
                          alt="Token preview"
                          className="w-full h-full object-cover"
                          onError={() => {
                            messageApi.error('Failed to load image. Please check the URL.');
                            setIsValidImageUrl(false);
                          }}
                        />
                      </div>
                    )}
                    {tokenImage && !isValidImageUrl && (
                      <p className="text-red-500 text-sm">
                        Please enter a valid image URL (must start with http:// or https://)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Create Button */}
              <button
                onClick={handleCreateToken}
                disabled={!isConnected || isCreating || !tokenName || !tokenSymbol || !tokenImage || !isValidImageUrl}
                className={`w-full py-3 rounded-lg font-medium ${
                  !isConnected || isCreating || !tokenName || !tokenSymbol || !tokenImage || !isValidImageUrl
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                }`}
              >
                {!isConnected
                  ? 'Connect Wallet'
                  : isCreating
                    ? 'Creating Token...'
                    : 'Create Token'}
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
                    Fill in the token details (name, symbol, and image URL)
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">3.</span>
                    Click "Create Token" and confirm the transaction
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">4.</span>
                    Wait for the token creation process to complete
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">5.</span>
                    Once created, go to "Create Pool" to add liquidity and make your token tradeable
                  </li>
                </ul>
              </div>

              {/* Note */}
              <p className="text-gray-500 text-sm text-center">
                Note: Token creation requires a small amount of testnet ETH for gas fees.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 