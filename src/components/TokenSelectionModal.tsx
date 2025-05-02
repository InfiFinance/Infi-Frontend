import { Modal, Input, Spin, Empty } from 'antd';
import { useState, useEffect } from 'react';
import { ethers, Provider } from 'ethers'; // Import Provider type
import { searchTokens, TokenInfo, DEFAULT_TOKEN_LIST } from '../services/tokenService'; // Using Ethers-based service now
import { useDebounce } from 'use-debounce';
// import { customNetwork } from '../config'; // No longer needed for manual client

interface TokenSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: TokenInfo) => void;
  readOnlyProvider?: Provider | null; // Add optional read-only provider prop
}

export default function TokenSelectionModal({
  isOpen,
  onClose,
  onSelect,
  readOnlyProvider, // Destructure the new prop
}: TokenSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);

  // Remove reliance on connected account/provider for search
  // const { chain, isConnected } = useAccount();
  // const publicClient = usePublicClient({ chainId: chain?.id });
  // const provider = useMemo(() => publicClientToProvider(publicClient), [publicClient]);
  const DEFAULT_CHAIN_ID = 50002; // Define default chain ID

  useEffect(() => {
    // Clear search if modal is closed or query is empty
    if (!isOpen || debouncedSearchQuery === '') {
      if (debouncedSearchQuery === '') setSearchResults([]); // Clear results only if query is cleared
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    // Always try to use the readOnlyProvider passed via props
    if (!readOnlyProvider) {
      console.log("[Search Effect] No suitable provider available.");
      setIsLoading(false);
      setSearchResults([]); // Clear results if no provider
      return; // Exit if no provider is available
    }

    // --- If all checks pass, proceed with search --- 
    const performSearch = async () => {
      setIsLoading(true);
      try {
        // Always use readOnlyProvider and default chain ID
        // The searchTokens function needs to handle this possibility.
        console.log(`[Search Effect] Performing search with query: '${debouncedSearchQuery}', chainId: ${DEFAULT_CHAIN_ID}`);
        // Use default chainId 50002 if activeChainId is undefined
        const results = await searchTokens(debouncedSearchQuery, DEFAULT_CHAIN_ID, readOnlyProvider);
        setSearchResults(results);
      } catch (error) {
        console.error("Error searching tokens:", error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Only perform search if query exists
    performSearch();

    // Dependencies include everything needed for the checks and the search call
  }, [debouncedSearchQuery, isOpen, readOnlyProvider]);

  // Determine which list to display: Search results or the default list
  const displayList: TokenInfo[] = debouncedSearchQuery ? searchResults : DEFAULT_TOKEN_LIST.tokens;

  const handleSelect = (token: TokenInfo) => {
    onSelect(token);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      footer={null}
      onCancel={onClose}
      title="Select a token"
      className="font-sans"
      maskClosable={true}
      closeIcon={true}
      afterClose={() => {
        setSearchQuery('');
        setSearchResults([]);
        setIsLoading(false);
      }}
    >
      <div className="px-4">
        <input 
          type="text" 
          placeholder="Search name or paste address"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#2c3552] text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-[#374264] transition-colors placeholder-gray-400 mb-1 mt-1"
        />
      </div>
      <div className="border-t border-gray-700 mt-4 space-y-2 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <Spin />
          </div>
        ) : displayList && displayList.length > 0 ? (
          displayList.map((token) => (
            <div
              key={token.address}
              className="flex items-center p-3 hover:bg-gray-800 cursor-pointer rounded-lg"
              onClick={() => handleSelect(token)}
            >
              <img
                 src={token.logoURI || '/token.png'}
                 alt={token.symbol}
                 className="w-10 h-10 rounded-full"
               />
              <div className="ml-3">
                <div className="text-base font-medium">{token.name}</div>
                <div className="text-sm text-gray-400">{token.symbol}</div>
              </div>
            </div>
          ))
        ) : (
           <div className="flex justify-center items-center h-32">
             <Empty description={debouncedSearchQuery ? "No tokens found" : "No default tokens"} />
           </div>
        )}
      </div>
    </Modal>
  );
}