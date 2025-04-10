"use client";

import { useState } from "react";
import TokenSelectionModal from '@/components/TokenSelectionModal';
import { Token } from '@/types/token';
import { ChevronDownIcon } from "lucide-react";
import Logo from "../../../public/vercel.svg";

const tokenList: Token[] = [
  {
    ticker: "ETH",
    img: "/vercel.svg",
    name: "Ethereum",
    address: "0x1234...",
    decimals: 18
  },
  {
    ticker: "SUI",
    img: "/vercel.svg",
    name: "SUI Token",
    address: "0x5678...",
    decimals: 18
  }
];

const AddLiquidity = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedBaseToken, setSelectedBaseToken] = useState("ETH");
  const [selectedQuoteToken, setSelectedQuoteToken] = useState("SUI");
  const [selectedFeeTier, setSelectedFeeTier] = useState("");
  const [initialPrice, setInitialPrice] = useState("12.0000000000000000048");
  const [rangeType, setRangeType] = useState("full");
  const [minPrice, setMinPrice] = useState("11.883798");
  const [maxPrice, setMaxPrice] = useState("12.123855");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [changeToken, setChangeToken] = useState<number>(1);

  const handleContinue = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    }
  };

  const handleBaseTokenSelect = (token: string) => {
    setSelectedBaseToken(token);
  };

  const openModal = (token: number) => {
    setChangeToken(token);
    setIsOpen(true);
  };

  const modifyToken = (i: number) => {
    if (changeToken === 1) {
      setSelectedBaseToken(tokenList[i].ticker);
    } else {
      setSelectedQuoteToken(tokenList[i].ticker);
    }
    setIsOpen(false);
  };

  return (
    <div className="flex w-full max-w-6xl mx-auto p-4 gap-8">
      {/* Left side - Steps */}
      <div className="w-1/4 bg-[#1f2639] rounded-lg p-4 h-fit border border-[#21273a]">
        <div className="space-y-6">
          <div className={`flex items-start space-x-4 ${currentStep === 1 ? '' : 'opacity-50'}}}`}>
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">1</div>
            <div>
              <h3 className="font-medium text-white">Select token & fee tier</h3>
              <p className="text-sm text-gray-400">Select the token you want to provide liquidity for.</p>
            </div>
          </div>

          <div className={`flex items-start space-x-4 ${currentStep === 2 ? '' : 'opacity-50'}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full ${currentStep === 2 ? 'bg-blue-500' : 'bg-[#2c3552]'} flex items-center justify-center text-white font-medium`}>2</div>
            <div>
              <h3 className="font-medium text-white">Deposit & Set Price Range</h3>
              <p className="text-sm text-gray-400">Enter deposit amounts and set price range.</p>
            </div>
          </div>
        </div>
        {currentStep > 1 && (
          <button
            onClick={() => setCurrentStep(currentStep - 1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mt-4 px-2 py-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back
          </button>
        )}
      </div>

      {/* Right side - Content */}
      <div className="flex-1 bg-[#1f2639] rounded-lg p-6 border border-[#21273a]">
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-medium text-white">Select pair</h2>
            <p className="text-gray-400">Select the token you want to create a liquidity pool for.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Base token</label>
                <div className="bg-[#2c3552] rounded-lg p-3 cursor-pointer hover:bg-[#374264] transition-colors" onClick={() => openModal(1)}>
                  <div className="flex items-center justify-between text-gray-400">
                    {selectedBaseToken ? (
                      <div className="flex items-center gap-2">
                        <img src={"/vercel.svg"} alt={selectedBaseToken} className="w-6 h-6 rounded-full" />
                        <span className="text-white">{selectedBaseToken}</span>
                      </div>
                    ) : (
                      <>
                        <span>Select token</span>
                        <ChevronDownIcon className="w-5 h-5" />
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Quote token</label>
                <div className="bg-[#2c3552] rounded-lg p-3 cursor-pointer hover:bg-[#374264] transition-colors" onClick={() => openModal(2)}>
                  <div className="flex items-center justify-between text-gray-400">
                    {selectedQuoteToken ? (
                      <div className="flex items-center gap-2">
                        <img src={"/vercel.svg"} alt={selectedQuoteToken} className="w-6 h-6 rounded-full" />
                        <span className="text-white">{selectedQuoteToken}</span>
                      </div>
                    ) : (
                      <>
                        <span>Select token</span>
                        <ChevronDownIcon className="w-5 h-5" />
                      </>
                    )}
                  </div>
                </div>
                <TokenSelectionModal
                  isOpen={isOpen}
                  onClose={() => setIsOpen(false)}
                  onSelect={modifyToken}
                  tokens={tokenList}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Fee tier</label>
                <p className="text-sm text-gray-400 mb-2">The % you will earn in fees.</p>
                <div className="relative">
                  <select
                    className="w-full bg-[#2c3552] text-white rounded-lg p-3 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-[#374264] transition-colors"
                    value={selectedFeeTier}
                    onChange={(e) => setSelectedFeeTier(e.target.value)}
                  >
                    <option value="" disabled>Select fee tier</option>
                    <option value="0.01">0.01% - Best for stable pairs</option>
                    <option value="0.05">0.05% - Best for stable pairs</option>
                    <option value="0.3">0.3% - Best for most pairs</option>
                    <option value="1">1% - Best for exotic pairs</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-medium text-white">Deposit amounts</h2>
              <p className="text-gray-400">Enter the amounts you want to deposit.</p>

              <div className="space-y-4 mt-4">
                <div>
                  <div className="bg-[#2c3552] rounded-lg p-3 hover:bg-[#374264] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src={"/vercel.svg"} alt="ETH" className="w-6 h-6 rounded-full" />
                        <div className="flex flex-col">
                          <span className="font-medium">ETH</span>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="0.0"
                        className="bg-transparent text-right outline-none w-1/2 text-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bg-[#2c3552] rounded-lg p-3 hover:bg-[#374264] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src={"/vercel.svg"} alt="SUI" className="w-6 h-6 rounded-full" />
                        <div className="flex flex-col">
                          <span className="font-medium">SUI</span>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="0.0"
                        className="bg-transparent text-right outline-none w-1/2 text-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm text-gray-400 mb-2">Total Amount</div>
                  <div className="text-xl font-medium text-white">--</div>
                </div>

                <div className="mt-2">
                  <div className="text-sm text-gray-400 mb-2">Deposit Ratio</div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center">
                      <img src={"/vercel.svg"} alt="ETH" className="w-4 h-4 rounded-full mr-1" />
                      <span>ETH 50%</span>
                    </div>
                    <div className="flex items-center">
                      <img src={"/vercel.svg"} alt="SUI" className="w-4 h-4 rounded-full mr-1" />
                      <span>SUI 50%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[#21273a] pt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-medium text-white">Set Price Range</h2>
                <div className="flex items-center gap-2">
                  <button
                    className="`flex items-center gap-2 rounded-lg px-3 py-1 cursor-pointer ${selectedBaseToken === 'ETH' ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors`"
                    onClick={() => handleBaseTokenSelect('ETH')}
                  >
                    <img src={"/vercel.svg"} alt={selectedBaseToken} className="w-5 h-5" />
                    <span>{selectedBaseToken}</span>
                  </button>
                  <button
                    className="`flex items-center gap-2 rounded-lg px-3 py-1 cursor-pointer ${selectedBaseToken === 'SUI' ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors`"
                    onClick={() => handleBaseTokenSelect('SUI')}
                  >
                    <img src={"/vercel.svg"} alt={selectedQuoteToken} className="w-5 h-5" />
                    <span>{selectedQuoteToken}</span>
                  </button>
                </div>
              </div>
              <p className="text-gray-400">Please specify a price range that you want to provide your liquidity within.</p>

             

              <div className="flex gap-4 mt-4">
                <button
                  className="`flex-1 py-3 rounded-lg ${rangeType === 'full' ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors`"
                  onClick={() => {
                    setRangeType('full');
                    setMinPrice('0');
                    setMaxPrice('∞');
                  }}
                >
                  Full Range
                </button>
                <button
                  className="`flex-1 py-3 rounded-lg ${rangeType === 'custom' ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors`"
                  onClick={() => setRangeType('custom')}
                //   onClick={() => setRangeType('custom')}
                >
                  Custom Range
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Min Price</label>
                  <div className="relative">
                    <button 
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      disabled={rangeType === 'full'}
                    >-</button>
                    <input
                      type="text"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      disabled={rangeType === 'full'}
                      className="w-full bg-[#2c3552] text-white rounded-lg p-3 pl-8 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#374264] transition-colors"
                    />
                    <button 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      disabled={rangeType === 'full'}
                    >+</button>
                    <div className="text-xs text-gray-400 text-center mt-1">{selectedQuoteToken || 'SUI'} per {selectedBaseToken || 'ETH'}</div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Max Price</label>
                  <div className="relative">
                    <button 
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      disabled={rangeType === 'full'}
                    >-</button>
                    <input
                      type="text"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      disabled={rangeType === 'full'}
                      className="w-full bg-[#2c3552] text-white rounded-lg p-3 pl-8 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#374264] transition-colors"
                    />
                    <button 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      disabled={rangeType === 'full'}
                    >+</button>
                    <div className="text-xs text-gray-400 text-center mt-1">{selectedQuoteToken || 'SUI'} per {selectedBaseToken || 'ETH'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8">
          <button 
            className="w-full bg-blue-900 text-blue-500 py-3 rounded-xl font-medium hover:bg-blue-800 transition-colors"
            onClick={handleContinue}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddLiquidity;