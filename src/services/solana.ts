import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getMint,
} from '@solana/spl-token';
import dotenv from 'dotenv';
dotenv.config();

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const USDC_MINT = process.env.USDC_MINT || 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';

export function getConnection() {
  return new Connection(RPC_URL, 'confirmed');
}

export function getPayerKeypair(): Keypair {
  const raw = process.env.PAYER_SECRET_KEY;
  if (!raw) throw new Error('PAYER_SECRET_KEY not set');
  const parsed = JSON.parse(raw) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(parsed));
}

export interface BatchPayment {
  wallet: string;
  amount: number;
}

export interface BatchResult {
  wallet: string;
  amount: number;
  txHash?: string;
  error?: string;
}

export async function batchUSDCPay(payments: BatchPayment[]): Promise<BatchResult[]> {
  const connection = getConnection();
  const payer = getPayerKeypair();
  const mintPubkey = new PublicKey(USDC_MINT);
  const mintInfo = await getMint(connection, mintPubkey);
  const decimals = mintInfo.decimals;

  const payerATA = await getOrCreateAssociatedTokenAccount(connection, payer, mintPubkey, payer.publicKey);

  const results: BatchResult[] = [];
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i];
    try {
      const destPubkey = new PublicKey(payment.wallet);
      const destATA = await getOrCreateAssociatedTokenAccount(connection, payer, mintPubkey, destPubkey);

      const lamports = Math.round(payment.amount * Math.pow(10, decimals));
      const ix = createTransferInstruction(payerATA.address, destATA.address, payer.publicKey, lamports);

      const tx = new Transaction().add(ix);
      const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
      results.push({ wallet: payment.wallet, amount: payment.amount, txHash: sig });
    } catch (err) {
      results.push({ wallet: payment.wallet, amount: payment.amount, error: String(err) });
    }
    if (i < payments.length - 1) await delay(1500);
  }

  return results;
}

export async function generateDevnetWallet(): Promise<{ publicKey: string; secretKey: number[] }> {
  const kp = Keypair.generate();
  return {
    publicKey: kp.publicKey.toBase58(),
    secretKey: Array.from(kp.secretKey),
  };
}
