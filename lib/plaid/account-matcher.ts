/**
 * Account Matcher
 * Detects potential matches between manual and Plaid accounts for migration
 */

import type { FinancialAccount } from '@/lib/types/database';

/**
 * Potential match between a manual and Plaid account
 */
export interface AccountMatch {
  manualAccount: FinancialAccount;
  plaidAccount: FinancialAccount;
  matchScore: number;
  matchReasons: string[];
}

/**
 * Normalizes institution name for comparison
 * Removes common words, punctuation, and converts to lowercase
 */
function normalizeInstitutionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\b(bank|credit union|cu|federal|savings|national|trust|fsb)\b/g, '') // Remove common words
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Checks if two institution names are similar
 */
function institutionNamesMatch(name1: string, name2: string): boolean {
  const normalized1 = normalizeInstitutionName(name1);
  const normalized2 = normalizeInstitutionName(name2);

  // Exact match after normalization
  if (normalized1 === normalized2) {
    return true;
  }

  // Check if one contains the other
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }

  // Check if they share significant words (at least 3 characters)
  const words1 = normalized1.split(' ').filter((w) => w.length >= 3);
  const words2 = normalized2.split(' ').filter((w) => w.length >= 3);

  const sharedWords = words1.filter((w) => words2.includes(w));
  return sharedWords.length > 0 && sharedWords.length >= Math.min(words1.length, words2.length) / 2;
}

/**
 * Finds potential matches between manual and Plaid accounts
 *
 * Matching criteria:
 * - Institution name similarity
 * - Account number last 4 digits match
 * - Account type similarity
 *
 * @param manualAccounts - Array of manual accounts
 * @param plaidAccounts - Array of Plaid-connected accounts
 * @returns Array of potential matches sorted by match score (highest first)
 */
export function findAccountMatches(
  manualAccounts: FinancialAccount[],
  plaidAccounts: FinancialAccount[]
): AccountMatch[] {
  const matches: AccountMatch[] = [];

  for (const manualAccount of manualAccounts) {
    // Skip if not a manual account
    if (!manualAccount.is_manual) {
      continue;
    }

    for (const plaidAccount of plaidAccounts) {
      // Skip if not a Plaid account
      if (plaidAccount.is_manual) {
        continue;
      }

      const matchReasons: string[] = [];
      let matchScore = 0;

      // Check institution name match (30 points)
      if (
        manualAccount.institution_name &&
        plaidAccount.institution_name &&
        institutionNamesMatch(manualAccount.institution_name, plaidAccount.institution_name)
      ) {
        matchReasons.push('Institution name matches');
        matchScore += 30;
      }

      // Check account number last 4 match (50 points - highest priority)
      if (
        manualAccount.account_number_last4 &&
        plaidAccount.account_number_last4 &&
        manualAccount.account_number_last4 === plaidAccount.account_number_last4
      ) {
        matchReasons.push('Account numbers match (****' + manualAccount.account_number_last4 + ')');
        matchScore += 50;
      }

      // Check account type match (20 points)
      if (manualAccount.account_type === plaidAccount.account_type) {
        matchReasons.push('Account type matches');
        matchScore += 20;
      }

      // Only consider it a match if score is at least 50 (e.g., last 4 digits match)
      // or if both institution and account type match
      const hasMinimumMatch = matchScore >= 50 || (matchReasons.length >= 2 && matchScore >= 50);

      if (hasMinimumMatch) {
        matches.push({
          manualAccount,
          plaidAccount,
          matchScore,
          matchReasons,
        });
      }
    }
  }

  // Sort by match score (highest first)
  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Gets the best match for a specific manual account
 *
 * @param manualAccountId - ID of the manual account
 * @param manualAccounts - Array of manual accounts
 * @param plaidAccounts - Array of Plaid-connected accounts
 * @returns The best match if found, null otherwise
 */
export function getBestMatchForAccount(
  manualAccountId: string,
  manualAccounts: FinancialAccount[],
  plaidAccounts: FinancialAccount[]
): AccountMatch | null {
  const manualAccount = manualAccounts.find((a) => a.id === manualAccountId);

  if (!manualAccount) {
    return null;
  }

  const matches = findAccountMatches([manualAccount], plaidAccounts);

  return matches.length > 0 ? matches[0] : null;
}

/**
 * Filters out accounts that have already been matched
 *
 * @param matches - Array of account matches
 * @param excludePlaidAccountIds - Plaid account IDs to exclude
 * @returns Filtered matches
 */
export function filterMatchedAccounts(
  matches: AccountMatch[],
  excludePlaidAccountIds: string[]
): AccountMatch[] {
  return matches.filter((match) => !excludePlaidAccountIds.includes(match.plaidAccount.id));
}
