// Single create market function
const createMarketid = async (
      tokenAddress: string,
      tokenAmount: string,
      solAmount: string
    ) => {
       const wallet = useWallet();
      if (!wallet.publicKey) throw new Error('Wallet not connected');
    
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
        })
        const tx = new Transaction();
            tx.add(transactions[0]);
    
          tx.feePayer = wallet.publicKey;
          tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          const signed = await wallet.signTransaction(tx);
          const sig = await connection.sendRawTransaction(signed.serialize());
          await connection.confirmTransaction(sig, "confirmed");
          console.log("✅ Market creation tx sent:", sig);
      } catch (error) {
        console.error('Error adding liquidity on Raydium:', error);
        throw error;
      }
    };





// create market function with solana transfer added to it 
const createMarketid = async (
    tokenAddress: string,
    tokenAmount: string,
    solAmount: string
  ) => {
     const wallet = useWallet();
    if (!wallet.publicKey) throw new Error('Wallet not connected');
  
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
      })
      const tx = new Transaction();
          tx.add(transactions[0]);
  
       
            tx.add(
                  web3.SystemProgram.transfer({
                    fromPubkey: new web3.PublicKey(window.solana.publicKey.toString()),
                    toPubkey: new web3.PublicKey(SOLANA_CONFIG.FEE_WALLET_ADDRESS),
                    lamports: fee * web3.LAMPORTS_PER_SOL
                  })
                );

        tx.feePayer = wallet.publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        const signed = await wallet.signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(sig, "confirmed");
        console.log("✅ Market creation tx sent:", sig);
    } catch (error) {
      console.error('Error adding liquidity on Raydium:', error);
      throw error;
    }
  };
