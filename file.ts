import { FEE_CONFIG } from "@/config/contracts";
import { SOLANA_CONFIG, PINATA_CONFIG } from "@/config/solana-config";
import * as splToken from "@solana/spl-token";
import { getSolanaRpcUrl } from "@/config/solana-config";
import { getNetworkMode } from "@/config/chain-config";
import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  Keypair,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Raydium,
  TxVersion,
  RAYMint,
  USDCMint,
  OPEN_BOOK_PROGRAM,
  DEVNET_PROGRAM_ID,
  WSOLMint,
  AMM_V4,
  FEE_DESTINATION_ID,
} from "@raydium-io/raydium-sdk-v2";
import { BN } from "@project-serum/anchor";

const mode = await getNetworkMode();
const getconnection = async () => {
  let connection = null;
  if (mode.toString() === "devnet") {
    connection = new Connection("https://api.devnet.solana.com");
  } else {
    connection = new Connection("https://api.mainnet-beta.solana.com");
  }
  return connection;
};
const dapp_connection = await getconnection();
const raydium = await Raydium.load({
  owner: window.solana.publicKey,
  connection: dapp_connection,
  cluster: "devnet",
});

// Single create market function using v0
const createMarketid = async (
  tokenAddress: string,
  tokenAmount: string,
  solAmount: string
) => {
  const wallet = useWallet();
  if (!wallet.publicKey) throw new Error("Wallet not connected");

  const connection = new Connection(getSolanaRpcUrl());
  const tokenMint = new PublicKey(tokenAddress);
  const tokenDecimal = 9;

  try {
    // 1. Create Market
    const { execute, extInfo, transactions } = await raydium.marketV2.create({
      baseInfo: {
        // create market doesn't support token 2022
        mint: tokenMint,
        decimals: tokenDecimal,
      },
      quoteInfo: {
        // create market doesn't support token 2022
        mint: WSOLMint,
        decimals: 9,
      },
      lotSize: 1,
      tickSize: 0.01,
      dexProgramId: OPEN_BOOK_PROGRAM,
    });
    const tx = new Transaction();
    tx.add(transactions[0]);

    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const signed = await wallet.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    console.log("✅ Market creation tx sent:", sig);
  } catch (error) {
    console.error("Error adding liquidity on Raydium:", error);
    throw error;
  }
};

// create market function with solana transfer added to it using v0
const createMarketidv2 = async (
  tokenAddress: string,
  tokenAmount: string,
  solAmount: string
) => {
  const wallet = useWallet();
  if (!wallet.publicKey) throw new Error("Wallet not connected");

  const connection = new Connection(getSolanaRpcUrl());
  const tokenMint = new PublicKey(tokenAddress);
  const tokenDecimal = 9;

  try {
    // 1. Create Market
    const { execute, extInfo, transactions } = await raydium.marketV2.create({
      baseInfo: {
        // create market doesn't support token 2022
        mint: tokenMint,
        decimals: tokenDecimal,
      },
      quoteInfo: {
        // create market doesn't support token 2022
        mint: WSOLMint,
        decimals: 9,
      },
      lotSize: 1,
      tickSize: 0.01,
      dexProgramId: OPEN_BOOK_PROGRAM,
    });
    const tx = new Transaction();
    tx.add(transactions[0]);

    tx.add(
      web3.SystemProgram.transfer({
        fromPubkey: new web3.PublicKey(window.solana.publicKey.toString()),
        toPubkey: new web3.PublicKey(SOLANA_CONFIG.FEE_WALLET_ADDRESS),
        lamports: fee * web3.LAMPORTS_PER_SOL,
      })
    );

    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const signed = await wallet.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    console.log("✅ Market creation tx sent:", sig);
  } catch (error) {
    console.error("Error adding liquidity on Raydium:", error);
    throw error;
  }
};

// single function to add liquidity using v0
export const addLiquidityOnRaydium = async (
  tokenAddress: string,
  tokenAmount: string,
  solAmount: string,
  marketId: string
) => {
  const wallet = useWallet();
  if (!wallet.publicKey || !wallet.signTransaction)
    throw new Error("Wallet not connected");

  const connection = new Connection(getSolanaRpcUrl(), "confirmed");
  const tokenDecimal = 9;

  const tokenMint = new PublicKey(tokenAddress);
  const marketPubkey = new PublicKey(marketId);
  const feeLamports = Math.floor(
    parseFloat(FEE_CONFIG.SOLANA.LIQUIDITY_ADD_FEE) *
      SOLANA_CONFIG.LAMPORTS_PER_SOL
  );

  // 1. Get Raydium liquidity instructions
  const { execute, extInfo } = await raydium.liquidity.createPoolV4({
    programId: AMM_V4,
    marketInfo: {
      marketId: marketPubkey,
      programId: OPEN_BOOK_PROGRAM,
    },
    baseMintInfo: {
      mint: tokenMint,
      decimals: tokenDecimal,
    },
    quoteMintInfo: {
      mint: WSOLMint,
      decimals: tokenDecimal,
    },
    baseAmount: new BN(tokenAmount),
    quoteAmount: new BN(solAmount),
    startTime: new BN(0),
    ownerInfo: {
      useSOLBalance: true,
    },
    associatedOnly: false,
    txVersion,
    feeDestinationId: FEE_DESTINATION_ID,
  });

  // 2. Combine fee transfer + Raydium instructions into one transaction
  const transaction = new Transaction();

  // Add fee payment instruction
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: FEE_DESTINATION_ID,
      lamports: feeLamports,
    })
  );
  transaction.add(execute);

  transaction.feePayer = wallet.publicKey;
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;

  const signedTx = await wallet.signTransaction(transaction);
  const sig = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(sig, "confirmed");

  console.log("✅ Combined transaction sent:", sig);
};
