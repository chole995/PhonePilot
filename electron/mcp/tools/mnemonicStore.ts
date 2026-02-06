/**
 * MCP Tool: mnemonic-store
 * Stores mnemonic words recognized from OCR for later verification.
 */

import { z } from 'zod';
import {
  storeMnemonicWords,
  getStoredMnemonicWords,
  getMnemonicMetadata,
  clearMnemonicWords,
  hasMnemonicWords,
} from '../state';

/** Input schema for mnemonic-store tool */
export const mnemonicStoreSchema = z.object({
  /** Action to perform */
  action: z.enum(['store', 'get', 'clear', 'status']).describe(
    'Action: store (save words), get (retrieve words), clear (remove words), status (check if stored)'
  ),
  /** Mnemonic words to store (required for store action) */
  words: z.array(z.string()).optional().describe('Array of mnemonic words to store (for store action)'),
});

export type MnemonicStoreInput = z.infer<typeof mnemonicStoreSchema>;

/** Output type for mnemonic-store tool */
export interface MnemonicStoreOutput {
  success: boolean;
  message: string;
  words?: string[];
  wordCount?: number;
  metadata?: {
    capturedAt?: string;
    wordCount?: number;
    source?: string;
  };
}

/**
 * Executes the mnemonic-store tool.
 * Manages storage of mnemonic words for verification workflows.
 */
export async function executeMnemonicStore(
  input: MnemonicStoreInput
): Promise<MnemonicStoreOutput> {
  const { action, words } = input;

  switch (action) {
    case 'store': {
      if (!words || words.length === 0) {
        return {
          success: false,
          message: 'No words provided for storage',
        };
      }

      // Validate words (basic BIP39-like validation)
      const validWords = words.filter(
        (w) => typeof w === 'string' && w.length >= 3 && /^[a-zA-Z]+$/.test(w)
      );

      if (validWords.length !== words.length) {
        return {
          success: false,
          message: `Some words are invalid. Expected ${words.length}, got ${validWords.length} valid words.`,
        };
      }

      // Store the words
      storeMnemonicWords(validWords.map((w) => w.toLowerCase()), 'manual');

      return {
        success: true,
        message: `Stored ${validWords.length} mnemonic words`,
        wordCount: validWords.length,
        words: validWords.map((w) => w.toLowerCase()),
      };
    }

    case 'get': {
      const storedWords = getStoredMnemonicWords();
      const metadata = getMnemonicMetadata();

      if (storedWords.length === 0) {
        return {
          success: false,
          message: 'No mnemonic words stored',
        };
      }

      return {
        success: true,
        message: `Retrieved ${storedWords.length} mnemonic words`,
        words: storedWords,
        wordCount: storedWords.length,
        metadata,
      };
    }

    case 'clear': {
      clearMnemonicWords();
      return {
        success: true,
        message: 'Mnemonic words cleared',
      };
    }

    case 'status': {
      const hasWords = hasMnemonicWords();
      const metadata = getMnemonicMetadata();

      return {
        success: true,
        message: hasWords
          ? `${metadata.wordCount} mnemonic words stored (from ${metadata.source})`
          : 'No mnemonic words stored',
        wordCount: metadata.wordCount || 0,
        metadata: hasWords ? metadata : undefined,
      };
    }

    default:
      return {
        success: false,
        message: `Unknown action: ${action}`,
      };
  }
}
