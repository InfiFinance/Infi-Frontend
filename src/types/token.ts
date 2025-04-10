export interface Token {
  ticker: string;
  img: string;
  name: string;
  address: string;
  decimals: number;
}

export interface TokenPrice {
  ratio: number;
}

export interface TxDetails {
  to: string | null;
  data: string | null;
  value: string | null;
}