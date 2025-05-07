import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import dbConnect from '@/utils/dbConnect';
import User from '@/lib/models/User';

// Define the ERC20 ABI fragment needed for minting and getting decimals
const ERC20_ABI = [
  "function mint(address to, uint256 amount) public",
  "function decimals() view returns (uint8)"
];

const TOKENS_TO_MINT = [
    { address: "0x9C102a3953f7605bd59e02A9FEF515523058dE00", symbol: "GOCTO", decimals: 18, baseAmount: "10000000" },
    { address: "0x9A741857be48C5069c7294f7c4232Ed0DD46E6Ce", symbol: "OCTOPUS", decimals: 18, baseAmount: "10000000" },
    { address: "0xc4D6fC137A14CAEd1e51D9D83f9606c72a32dD30", symbol: "INFI", decimals: 18, baseAmount: "10000000" },
    { address: "0xF74903096433b0a948848d79E7c835402897e4e8", symbol: "SAILOR", decimals: 18, baseAmount: "10000000" },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recipientAddress = searchParams.get('walletAddress');

  if (!recipientAddress) {
    return NextResponse.json({ error: 'Wallet address is required in query parameters (walletAddress)' }, { status: 400 });
  }

  if (!ethers.isAddress(recipientAddress)) {
    return NextResponse.json({ error: 'Invalid wallet address provided' }, { status: 400 });
  }

  const privateKey = process.env.SENDER_PRIVATE_KEY;
  const rpcUrl = process.env.RPC_PROXY_TARGET_URL;

  if (!privateKey) {
    console.error('SENDER_PRIVATE_KEY environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error: Missing sender private key' }, { status: 500 });
  }
  if (!rpcUrl) {
    console.error('RPC_PROXY_TARGET_URL environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error: Missing RPC URL' }, { status: 500 });
  }

  try {
    await dbConnect();

    let user = await User.findOne({ walletAddress: recipientAddress });
    let userJustCreated = false;
    if (!user) {
      user = new User({ walletAddress: recipientAddress, mintedTokens: [] });
      userJustCreated = true;
      console.log(`User not found for ${recipientAddress}, will create if tokens are minted.`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`Using sender address: ${wallet.address}`);

    const results = [];
    let newTokensMintedForUserCount = 0;

    for (const tokenInfo of TOKENS_TO_MINT) {
      console.log(`\nProcessing token: ${tokenInfo.symbol} (${tokenInfo.address})`);

      if (!userJustCreated && user && user.mintedTokens && user.mintedTokens.includes(tokenInfo.symbol)) {
        console.log(`  - Token ${tokenInfo.symbol} already minted for user ${recipientAddress}. Skipping.`);
        results.push({
          token: tokenInfo.symbol,
          status: 'already_minted',
          message: 'Token already minted for this user'
        });
        continue;
      }

      const tokenContract = new ethers.Contract(tokenInfo.address, ERC20_ABI, wallet);

      let tokenDecimals = tokenInfo.decimals;
      try {
        const fetchedDecimals = await tokenContract.decimals();
        if (fetchedDecimals !== tokenInfo.decimals) {
            console.warn(`  - Warning: Fetched decimals (${fetchedDecimals}) for ${tokenInfo.symbol} differ from predefined (${tokenInfo.decimals}). Using fetched value.`);
            tokenDecimals = fetchedDecimals;
        } else {
            console.log(`  - Token decimals confirmed: ${tokenDecimals}`);
        }
      } catch (error: any) {
        console.warn(`  - Warning: Could not fetch decimals for token ${tokenInfo.symbol}. Using predefined ${tokenInfo.decimals}. Error: ${error.message}`);
      }

      const finalAmount = ethers.parseUnits(tokenInfo.baseAmount, tokenDecimals);
      console.log(`  - Calculated mint amount (with ${tokenDecimals} decimals): ${finalAmount.toString()} for ${tokenInfo.baseAmount} base units`);

      console.log(`  - Minting ${tokenInfo.baseAmount} ${tokenInfo.symbol} tokens to ${recipientAddress}...`);
      try {
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice;

        if (!gasPrice) {
          console.error(`  - Error: Could not retrieve gasPrice from provider. feeData: ${JSON.stringify(feeData)}`);
          throw new Error("Failed to retrieve gas price. The network might require EIP-1559 gas parameters.");
        }

        const estimatedGas = await tokenContract.mint.estimateGas(recipientAddress, finalAmount);
        
        const tx = await tokenContract.mint(recipientAddress, finalAmount, {
          gasPrice: gasPrice 
        });

        console.log(`    - Transaction sent for ${tokenInfo.symbol}: ${tx.hash}`);
        const receipt = await tx.wait();
        await new Promise(resolve => setTimeout(resolve, 1000)); 
        console.log(`    - Transaction for ${tokenInfo.symbol} confirmed in block: ${receipt.blockNumber}`);
        
        if (user) {
            if (!user.mintedTokens) { user.mintedTokens = []; }
            user.mintedTokens.push(tokenInfo.symbol);
            newTokensMintedForUserCount++;
        }

        results.push({ 
          token: tokenInfo.symbol, 
          status: 'success', 
          txHash: tx.hash, 
          recipient: recipientAddress, 
          amount: finalAmount.toString(),
          blockNumber: receipt.blockNumber
        });
      } catch (error: any) {
        console.error(`    - Error minting ${tokenInfo.symbol} to ${recipientAddress}: ${error.message}`);
        results.push({ 
          token: tokenInfo.symbol, 
          status: 'error', 
          recipient: recipientAddress, 
          error: error.message 
        });
      }
    }

    if (user && (newTokensMintedForUserCount > 0 || (userJustCreated && user.mintedTokens.length > 0))) {
        try {
            await user.save();
            console.log(`User ${recipientAddress} updated with new minted tokens: ${user.mintedTokens.join(', ')}`);
        } catch (dbError: any) {
            console.error(`Error saving user ${recipientAddress} after minting: ${dbError.message}`);
            results.push({ 
                token: '-', 
                status: 'system_error', 
                error: 'Failed to save user token minting status to database.',
                details: dbError.message
            });
        }
    }

    console.log("\nToken minting process finished.");

    const allTokensSuccessfullyMinted = results.every(result => result.status === 'success');

    return NextResponse.json({
        message: allTokensSuccessfullyMinted ? 'All tokens minted successfully.' : 'Token minting process completed, but some tokens may have failed.',
        allTokensSuccessfullyMinted,
        results 
    }, { status: 200 });

  } catch (error: any) {
    console.error('An unexpected error occurred during the minting process:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
} 