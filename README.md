<div>
    <img align="left" alt="InfiRouter Logo Placeholder" width="1080px" src="https://assets.hackquest.io/hackathons/projects/logo/jKqHLHwFANe7ruj04bQ91.png" /> 
</div>

# **Infi**

infi is the premier DEX aggregator on Pharos Network which is fully on-chain and modular in nature.

*   **Aggregator link : https://github.com/InfiFinance/infi-ag**
*   **Twitter (X): https://x.com/InfiExchange**

*   **App link: https://infiexchange.xyz/swap**

*   **Demo: https://youtu.be/eD7oxHQ4O5w**

*   **Pitch Deck: https://www.canva.com/design/DAGl29yqvtA/VSeI71RsS0OsjLDokhq8Ew/view**

*   **Pitch Video: https://youtu.be/PpJ_QpFg7kA**

*   **Docs: https://infi-1.gitbook.io/infi-litepaper**

## About

Its primary objective is to enable optimized token swapping experience on Pharos network by maximizing capital efficiency and simplifying user interaction. With its modular architecture, it identifies & executes swap paths that yield the optimal effective exchange rate across all DEXs on Pharos. The protocol features an advanced on-chain pathfinding algorithm capable of navigating multi-step routes involving trusted intermediary tokens

The protocol features a suite of smart contracts engineered to find the most efficient path for swapping one token asset (`tokenIn`) for another (`tokenOut`) across various Decentralized Exchanges (DEXs). The core objective is to maximize the net amount of `tokenOut` received by the user for a given `amountIn` of `tokenIn`. This optimization considers not only the exchange rates provided by different DEXs and potential multi-hop routes but also optionally factors in the estimated gas cost associated with executing the swap path.

Pathfinding is performed using on-chain view functions (`findBestPath`, `findBestPathWithGas`) which query registered DEX adapters. While these query methods can be called by anyone off-chain to determine the best route before executing a swap, users should **avoid** calling these computationally intensive view functions within a state-changing transaction due to the potentially large gas costs involved.

The protocol utilizes a modular adapter pattern, allowing for easy integration and maintenance of different DEX protocols.
## Architechture Overview
![enter image description here](https://cdn.discordapp.com/attachments/1169886272286892104/1366739491649224724/image.png?ex=681750d7&is=6815ff57&hm=28e1e540a0c0021dcdb6fb78d0617c9bc217805aa3281e3002a1b1417c2d15a1&=)
### Core Components:

1.  **Adapter Pattern**: Adapters are specialized, individual smart contracts that act as translators or intermediaries between the generic InfiRouter and the unique interfeaces and functionalities of specific underlying DEX protocols
    
2.  **InfiRouter**: This smart contract serves as the primary entry point and central coordinator for the entire protocol. It handles state management, interface exposure, pathfinding logic & functions, swap execution, internal logic & administration.
    
3.  **Pathfinding Algorithm**: The core intelligence of InfiRouter lies in its on-chain pathfinding algorithm, implemented primarily within the internal _findBestPath function. This recursive algorithm systematically explores potential swap routes to identify the one offering the maximum output amount, potentially adjusted for gas costs. It utilizes a **recursive depth-first search strategy**.
    

### Pathfinding Algorithm:

The algorithm operates recursively as follows:

1.  **Base Case** - Direct Path Evaluation: The function first considers all possible single-step path. It iterates through every registered adapter.
    
2.  **Recursive Step - Multi-Hop Exploration**:
    
    – The algorithm checks if further exploration is warranted based on the maxSteps constraint. If the current path being built has length ( l ) and ( l < - 1 ), it proceeds to explore two-step (or longer) paths originating from the current state. – It iterates through each potential intermediary token in the TRUSTED_TOKENS list.

## Usage

### Router (`InfiRouter.sol`)

The `InfiRouter` contract is the primary user-facing interface for discovering optimal swap paths and executing trades.

See an example of off-chain usage for pathfinding and swap execution in `[./src/example.js](./src/example.js)`.

#### Deployed Addresses


| Chain      | Router Address                                   |
| :--------- | :----------------------------------------------- |
| Pharos Devnet    | `0xE0F6Dd4c6DA9d832B34747A54f0b346B4936Cddf`            
| Pharos Testnet   | `[testnet router Address to be added here]`          

---

#### **`findBestPathWithGas`**

Finds the best path from `_tokenIn` to `_tokenOut`, considering both the final `amountOut` and the estimated `gasCost` of the swap path. Aims to maximize the net output value.

```solidity
function findBestPathWithGas(
    uint256 _amountIn,
    address _tokenIn,
    address _tokenOut,
    uint256 _maxSteps,
    uint256 _gasPrice // Typically in wei
) external view returns (FormattedOffer memory);
```

**Input Parameters:**

| Parameter    | Type      | Details                                                                 |
| :----------- | :-------- | :---------------------------------------------------------------------- |
| `_amountIn`  | `uint256` | The exact amount of `_tokenIn` being sold (in its smallest unit).       |
| `_tokenIn`   | `address` | The ERC20 contract address of the token being sold.                     |
| `_tokenOut`  | `address` | The ERC20 contract address of the token being bought.                   |
| `_maxSteps`  | `uint256` | Maximum number of intermediate swaps allowed (must be > 0 and < 5).     |
| `_gasPrice`  | `uint256` | Current network gas price (e.g., in wei) used to value gas cost estimates. |

**Return Value (`FormattedOffer` struct):**

```solidity
struct FormattedOffer {
    uint256[] amounts;
    address[] adapters;
    address[] path;
    uint256 gasEstimate;
}
```

| Field         | Type        | Details                                                                                                                                |
| :------------ | :---------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| `amounts`     | `uint256[]` | Array of token amounts for each step. `amounts[0]` is `_amountIn`, `amounts[amounts.length - 1]` is the final estimated `amountOut`.     |
| `adapters`    | `address[]` | Array of adapter contract addresses used for each swap step in the determined path.                                                    |
| `path`        | `address[]` | Array of token addresses representing the swap route. `path[0]` is `_tokenIn`, `path[path.length - 1]` is `_tokenOut`.                   |
| `gasEstimate` | `uint256`   | An estimate of the total gas units required to execute the swaps via the adapters in the path (excludes base transaction cost, etc.). |

---

#### **`findBestPath`**

Finds the best path from `_tokenIn` to `_tokenOut` based *solely* on maximizing the final `amountOut`, without considering the gas cost of the swaps.

```solidity
function findBestPath(
    uint256 _amountIn,
    address _tokenIn,
    address _tokenOut,
    uint256 _maxSteps
) external view returns (FormattedOffer memory);
```

**Input Parameters:**

| Parameter   | Type      | Details                                                                 |
| :---------- | :-------- | :---------------------------------------------------------------------- |
| `_amountIn` | `uint256` | The exact amount of `_tokenIn` being sold (in its smallest unit).       |
| `_tokenIn`  | `address` | The ERC20 contract address of the token being sold.                     |
| `_tokenOut` | `address` | The ERC20 contract address of the token being bought.                   |
| `_maxSteps` | `uint256` | Maximum number of intermediate swaps allowed (must be > 0 and < 5).     |

**Return Value:** Returns the same `FormattedOffer` struct as `findBestPathWithGas`, detailing the path that yields the highest gross `amountOut`.

---

#### **`swapNoSplit`**

Executes a swap along a specific path previously determined by `findBestPath` or `findBestPathWithGas`. Requires prior ERC20 approval for `_trade.amountIn` to the InfiRouter contract.

```solidity
function swapNoSplit(
    Trade calldata _trade,
    address _to,
    uint256 _fee // Optional fee in basis points (1 = 0.01%)
) external payable; // Payable if swapping native currency
```

**Input Parameters:**

| Parameter | Type      | Details                                                                                                                                   |
| :-------- | :-------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `_trade`  | `Trade`   | A struct containing the detailed arguments for the swap execution (see below).                                                            |
| `_to`     | `address` | The address that will receive the final `_tokenOut`.                                                                                       |
| `_fee`    | `uint256` | Optional protocol fee in basis points (e.g., 10 = 0.1%) deducted from `_trade.amountIn`. Must be >= protocol `MIN_FEE` if non-zero.       |

**`Trade` Struct:**

```solidity
struct Trade {
    uint256 amountIn;
    uint256 amountOut; // Minimum amountOut expected
    address[] path;
    address[] adapters;
}
```

| Field       | Type        | Details                                                                                       |
| :---------- | :---------- | :-------------------------------------------------------------------------------------------- |
| `amountIn`  | `uint256`   | The exact amount of `path[0]` tokens being sold. Must match amount used for path finding.     |
| `amountOut` | `uint256`   | The minimum acceptable amount of `path[path.length - 1]` tokens to receive (slippage control). |
| `path`      | `address[]` | The sequence of token addresses for the swap route.                                           |
| `adapters`  | `address[]` | The sequence of adapter addresses corresponding to each swap step in `path`.                  |

---

#### **`swapNoSplitWithPermit`**

Executes a swap similarly to `swapNoSplit` but utilizes EIP-2612 permit functionality. Allows the user to grant ERC20 approval for `_trade.amountIn` via a signature within the same transaction, saving gas compared to a separate `approve` call.

```solidity
function swapNoSplitWithPermit(
    Trade calldata _trade,
    address _to,
    uint256 _fee,
    uint256 _deadline,
    uint8 _v,
    bytes32 _r,
    bytes32 _s
) external payable; // Payable if swapping native currency
```

**Input Parameters:**

| Parameter   | Type      | Details                                                                                       |
| :---------- | :-------- | :-------------------------------------------------------------------------------------------- |
| `_trade`    | `Trade`   | Swap execution arguments (same `Trade` struct as above).                                      |
| `_to`       | `address` | The address that will receive the final `_tokenOut`.                                           |
| `_fee`      | `uint256` | Optional protocol fee in basis points.                                                        |
| `_deadline` | `uint256` | Deadline (Unix timestamp) after which the permit signature is no longer valid.                |
| `_v`        | `uint8`   | Recovery identifier component of the ECDSA signature for the permit.                            |
| `_r`        | `bytes32` | `r` component of the ECDSA signature for the permit.                                          |
| `_s`        | `bytes32` | `s` component of the ECDSA signature for the permit.                                          |

---

### Adapters (`IAdapter.sol`)

Adapters serve as standardized interfaces allowing the `InfiRouter` to communicate with various underlying DEX protocols without needing to understand their specific internal workings. Each adapter implements the `IAdapter` interface.

Key Interface Functions:

```solidity
// Returns the expected amount out for a swap on the specific DEX
function query(
    uint256 _amountIn,
    address _tokenIn,
    address _tokenOut
) external view returns (uint256 amountOut);

// Executes the swap on the specific DEX
function swap(
    uint256 _amountIn,
    uint256 _amountOut, // Typically minimum amount for this hop
    address _tokenIn,
    address _tokenOut,
    address _to // Target address for the output tokens (next adapter or final recipient)
) external;

// Returns an estimated gas cost for executing the swap function
function swapGasEstimate() external view returns (uint256 gasEstimate);

// Returns the name of the DEX protocol
function name() external view returns (string memory);

```

To get a list of currently integrated and deployed adapters for a specific network, check the deployment scripts or configuration files within the `src/deploy` or relevant directories for specific adapter addresses per network.

## Local Development and Testing

### Prerequisites

*   Node.js (v16 or later recommended)
*   Yarn (or npm)
*   Git

### Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/InfiFinance/Infi-Frontend
    cd Infi-Frontend
    ```
2.  **Install Dependencies:**
    ```bash
    yarn install
    # or: npm install
    ```
3.  **Set Environment Variables:**
    *   Copy the sample environment file:
        ```bash
        cp .env.sample .env
        ```
    *   Edit the `.env` file and add necessary values:
        *   RPC URLs for different networks (e.g., Alchemy, Infura)
        *   Private key(s) for deployment and testing (use test accounts/keys, **never commit real private keys**)
        *   Etherscan (or relevant block explorer) API keys for contract verification.

### Common Commands

*(Ensure these scripts are defined in your `package.json` or adjust commands as needed)*

*   **Compile Contracts:**
    ```bash
    npx hardhat compile
    ```
*   **Run Tests:**
    ```bash
    npx hardhat test
    # Optionally run tests for a specific network if configured:
    # yarn test:<network-id>
    ```
*   **Deploy Contracts:**
    *   Deployment scripts are typically located in the `deploy/` directory.
    *   Run deployment for a specific network:
        ```bash
        npx hardhat deploy --network <network-name>
        # e.g., npx hardhat deploy --network pharos
        ```
*   **Verify Contracts on Block Explorer:**
    *   Requires `hardhat-etherscan` plugin and API keys in `.env`.
    *   After deployment, run:
        ```bash
        npx hardhat verify --network <network-name> <DEPLOYED_CONTRACT_ADDRESS> [constructor arguments...]
        # Example: npx hardhat verify --network sepolia 0x123... "0xabc..." "0xdef..."
        ```
*   **Run Pathfinding Query (Example Task - May need implementation):**
    *   A Hardhat task could be created to easily query paths from the command line.
        ```bash
        # Example hypothetical command:
        npx hardhat find-path --amount <amount_in_ether_or_units> --tokenin <symbol_or_address> --tokenout <symbol_or_address> --network <network-name> [--usegas]
        # e.g.: npx hardhat find-path --amount 10 --tokenin WETH --tokenout USDC --network mainnet --usegas
        ```
    *   *(Note: Implement this Hardhat task based on `example.js` or project requirements if needed.)*



## Audits and Security

**Disclaimer: This project has NOT been professionally audited.**

While developed with security best practices in mind, using these smart contracts involves inherent risks. **Use at your own risk.**
