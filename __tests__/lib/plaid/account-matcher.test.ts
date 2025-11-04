/**
 * Tests for Account Matcher
 */

import { describe, it, expect } from 'vitest';
import {
  findAccountMatches,
  getBestMatchForAccount,
  filterMatchedAccounts,
  type AccountMatch,
} from '@/lib/plaid/account-matcher';
import type { FinancialAccount } from '@/lib/types/database';

// Helper to create a test account
function createAccount(overrides: Partial<FinancialAccount> = {}): FinancialAccount {
  return {
    id: 'test-id',
    user_id: 'user-123',
    name: 'Test Account',
    account_type: 'checking',
    institution_name: 'Test Bank',
    account_number_last4: '1234',
    current_balance: 1000,
    available_balance: 1000,
    currency: 'USD',
    is_manual: true,
    plaid_account_id: null,
    plaid_item_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Account Matcher', () => {
  describe('findAccountMatches', () => {
    it('should find perfect match with same institution, last 4, and type', () => {
      const manualAccounts: FinancialAccount[] = [
        createAccount({
          id: 'manual-1',
          is_manual: true,
          institution_name: 'Chase Bank',
          account_number_last4: '1234',
          account_type: 'checking',
        }),
      ];

      const plaidAccounts: FinancialAccount[] = [
        createAccount({
          id: 'plaid-1',
          is_manual: false,
          institution_name: 'Chase Bank',
          account_number_last4: '1234',
          account_type: 'checking',
          plaid_account_id: 'plaid-acc-1',
          plaid_item_id: 'plaid-item-1',
        }),
      ];

      const matches = findAccountMatches(manualAccounts, plaidAccounts);

      expect(matches).toHaveLength(1);
      expect(matches[0].matchScore).toBe(100); // 30 + 50 + 20
      expect(matches[0].matchReasons).toContain('Institution name matches');
      expect(matches[0].matchReasons).toContain('Account numbers match (****1234)');
      expect(matches[0].matchReasons).toContain('Account type matches');
    });

    it('should match by last 4 digits even if institution names differ slightly', () => {
      const manualAccounts: FinancialAccount[] = [
        createAccount({
          id: 'manual-1',
          is_manual: true,
          institution_name: 'Chase',
          account_number_last4: '5678',
          account_type: 'savings',
        }),
      ];

      const plaidAccounts: FinancialAccount[] = [
        createAccount({
          id: 'plaid-1',
          is_manual: false,
          institution_name: 'JPMorgan Chase Bank',
          account_number_last4: '5678',
          account_type: 'savings',
          plaid_account_id: 'plaid-acc-1',
        }),
      ];

      const matches = findAccountMatches(manualAccounts, plaidAccounts);

      expect(matches).toHaveLength(1);
      expect(matches[0].matchScore).toBeGreaterThanOrEqual(70); // Last 4 + type at minimum
    });

    it('should not match if last 4 digits are different', () => {
      const manualAccounts: FinancialAccount[] = [
        createAccount({
          id: 'manual-1',
          is_manual: true,
          institution_name: 'Chase Bank',
          account_number_last4: '1234',
          account_type: 'checking',
        }),
      ];

      const plaidAccounts: FinancialAccount[] = [
        createAccount({
          id: 'plaid-1',
          is_manual: false,
          institution_name: 'Chase Bank',
          account_number_last4: '5678',
          account_type: 'savings', // Different type to ensure only institution matches
          plaid_account_id: 'plaid-acc-1',
        }),
      ];

      const matches = findAccountMatches(manualAccounts, plaidAccounts);

      // Match score would be only 30 (institution) which is below threshold
      expect(matches).toHaveLength(0);
    });

    it('should match multiple accounts and sort by score', () => {
      const manualAccounts: FinancialAccount[] = [
        createAccount({
          id: 'manual-1',
          is_manual: true,
          institution_name: 'Chase',
          account_number_last4: '1234',
          account_type: 'checking',
        }),
      ];

      const plaidAccounts: FinancialAccount[] = [
        // Perfect match
        createAccount({
          id: 'plaid-1',
          is_manual: false,
          institution_name: 'Chase',
          account_number_last4: '1234',
          account_type: 'checking',
          plaid_account_id: 'plaid-acc-1',
        }),
        // Partial match (last 4 only)
        createAccount({
          id: 'plaid-2',
          is_manual: false,
          institution_name: 'Bank of America',
          account_number_last4: '1234',
          account_type: 'savings',
          plaid_account_id: 'plaid-acc-2',
        }),
      ];

      const matches = findAccountMatches(manualAccounts, plaidAccounts);

      expect(matches).toHaveLength(2);
      // First match should have higher score
      expect(matches[0].plaidAccount.id).toBe('plaid-1');
      expect(matches[0].matchScore).toBeGreaterThan(matches[1].matchScore);
    });

    it('should skip non-manual accounts in manual list', () => {
      const manualAccounts: FinancialAccount[] = [
        createAccount({
          id: 'not-manual',
          is_manual: false, // Not manual!
          institution_name: 'Chase',
          account_number_last4: '1234',
        }),
      ];

      const plaidAccounts: FinancialAccount[] = [
        createAccount({
          id: 'plaid-1',
          is_manual: false,
          institution_name: 'Chase',
          account_number_last4: '1234',
          plaid_account_id: 'plaid-acc-1',
        }),
      ];

      const matches = findAccountMatches(manualAccounts, plaidAccounts);

      expect(matches).toHaveLength(0);
    });

    it('should skip manual accounts in Plaid list', () => {
      const manualAccounts: FinancialAccount[] = [
        createAccount({
          id: 'manual-1',
          is_manual: true,
          institution_name: 'Chase',
          account_number_last4: '1234',
        }),
      ];

      const plaidAccounts: FinancialAccount[] = [
        createAccount({
          id: 'not-plaid',
          is_manual: true, // Manual, not Plaid!
          institution_name: 'Chase',
          account_number_last4: '1234',
        }),
      ];

      const matches = findAccountMatches(manualAccounts, plaidAccounts);

      expect(matches).toHaveLength(0);
    });

    it('should handle empty input arrays', () => {
      expect(findAccountMatches([], [])).toEqual([]);
      expect(
        findAccountMatches([createAccount({ is_manual: true })], [])
      ).toEqual([]);
      expect(
        findAccountMatches([], [createAccount({ is_manual: false })])
      ).toEqual([]);
    });

    it('should normalize institution names for matching', () => {
      const manualAccounts: FinancialAccount[] = [
        createAccount({
          id: 'manual-1',
          is_manual: true,
          institution_name: 'Bank of America, N.A.',
          account_number_last4: '1234',
        }),
      ];

      const plaidAccounts: FinancialAccount[] = [
        createAccount({
          id: 'plaid-1',
          is_manual: false,
          institution_name: 'Bank of America',
          account_number_last4: '1234',
          plaid_account_id: 'plaid-acc-1',
        }),
      ];

      const matches = findAccountMatches(manualAccounts, plaidAccounts);

      expect(matches).toHaveLength(1);
      expect(matches[0].matchReasons).toContain('Institution name matches');
    });

    it('should match common institution name variations', () => {
      const testCases = [
        { manual: 'Chase Bank', plaid: 'JPMorgan Chase' },
        { manual: 'Wells Fargo Bank', plaid: 'Wells Fargo' },
        { manual: 'BofA', plaid: 'Bank of America' },
      ];

      testCases.forEach(({ manual, plaid }) => {
        const manualAccounts: FinancialAccount[] = [
          createAccount({
            id: 'manual-1',
            is_manual: true,
            institution_name: manual,
            account_number_last4: '1234',
          }),
        ];

        const plaidAccounts: FinancialAccount[] = [
          createAccount({
            id: 'plaid-1',
            is_manual: false,
            institution_name: plaid,
            account_number_last4: '1234',
            plaid_account_id: 'plaid-acc-1',
          }),
        ];

        const matches = findAccountMatches(manualAccounts, plaidAccounts);
        expect(matches.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getBestMatchForAccount', () => {
    it('should return the best match for a specific account', () => {
      const manualAccounts: FinancialAccount[] = [
        createAccount({
          id: 'manual-1',
          is_manual: true,
          institution_name: 'Chase',
          account_number_last4: '1234',
          account_type: 'checking',
        }),
        createAccount({
          id: 'manual-2',
          is_manual: true,
          institution_name: 'BofA',
          account_number_last4: '5678',
        }),
      ];

      const plaidAccounts: FinancialAccount[] = [
        createAccount({
          id: 'plaid-1',
          is_manual: false,
          institution_name: 'Chase',
          account_number_last4: '1234',
          account_type: 'checking',
          plaid_account_id: 'plaid-acc-1',
        }),
      ];

      const bestMatch = getBestMatchForAccount('manual-1', manualAccounts, plaidAccounts);

      expect(bestMatch).not.toBeNull();
      expect(bestMatch?.manualAccount.id).toBe('manual-1');
      expect(bestMatch?.plaidAccount.id).toBe('plaid-1');
    });

    it('should return null if account not found', () => {
      const bestMatch = getBestMatchForAccount('non-existent', [], []);

      expect(bestMatch).toBeNull();
    });

    it('should return null if no matches found', () => {
      const manualAccounts: FinancialAccount[] = [
        createAccount({
          id: 'manual-1',
          is_manual: true,
          institution_name: 'Chase',
          account_number_last4: '1234',
        }),
      ];

      const plaidAccounts: FinancialAccount[] = [
        createAccount({
          id: 'plaid-1',
          is_manual: false,
          institution_name: 'Different Bank',
          account_number_last4: '9999',
          plaid_account_id: 'plaid-acc-1',
        }),
      ];

      const bestMatch = getBestMatchForAccount('manual-1', manualAccounts, plaidAccounts);

      expect(bestMatch).toBeNull();
    });
  });

  describe('filterMatchedAccounts', () => {
    it('should filter out already matched Plaid accounts', () => {
      const matches: AccountMatch[] = [
        {
          manualAccount: createAccount({ id: 'manual-1', is_manual: true }),
          plaidAccount: createAccount({ id: 'plaid-1', is_manual: false }),
          matchScore: 100,
          matchReasons: ['Perfect match'],
        },
        {
          manualAccount: createAccount({ id: 'manual-2', is_manual: true }),
          plaidAccount: createAccount({ id: 'plaid-2', is_manual: false }),
          matchScore: 80,
          matchReasons: ['Good match'],
        },
        {
          manualAccount: createAccount({ id: 'manual-3', is_manual: true }),
          plaidAccount: createAccount({ id: 'plaid-3', is_manual: false }),
          matchScore: 60,
          matchReasons: ['Partial match'],
        },
      ];

      const filtered = filterMatchedAccounts(matches, ['plaid-1', 'plaid-3']);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].plaidAccount.id).toBe('plaid-2');
    });

    it('should return all matches if no exclusions', () => {
      const matches: AccountMatch[] = [
        {
          manualAccount: createAccount({ id: 'manual-1', is_manual: true }),
          plaidAccount: createAccount({ id: 'plaid-1', is_manual: false }),
          matchScore: 100,
          matchReasons: [],
        },
      ];

      const filtered = filterMatchedAccounts(matches, []);

      expect(filtered).toEqual(matches);
    });
  });
});
