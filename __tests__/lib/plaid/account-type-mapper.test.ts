/**
 * Unit Tests for Plaid Account Type Mapper
 * Tests comprehensive mapping of Plaid account types and subtypes to app AccountType enum
 */

import { describe, it, expect } from 'vitest';
import { mapPlaidAccountType } from '@/app/api/plaid/exchange-token/route';

describe('mapPlaidAccountType', () => {
  describe('Depository Accounts', () => {
    it('should map checking accounts correctly', () => {
      expect(mapPlaidAccountType('depository', 'checking')).toBe('checking');
      expect(mapPlaidAccountType('DEPOSITORY', 'CHECKING')).toBe('checking'); // Case insensitive
    });

    it('should map savings accounts correctly', () => {
      expect(mapPlaidAccountType('depository', 'savings')).toBe('savings');
      expect(mapPlaidAccountType('DEPOSITORY', 'SAVINGS')).toBe('savings');
    });

    it('should map HSA accounts to savings', () => {
      expect(mapPlaidAccountType('depository', 'hsa')).toBe('savings');
      expect(mapPlaidAccountType('depository', 'HSA')).toBe('savings');
    });

    it('should map CD accounts to savings', () => {
      expect(mapPlaidAccountType('depository', 'cd')).toBe('savings');
      expect(mapPlaidAccountType('depository', 'CD')).toBe('savings');
    });

    it('should map money market accounts to savings', () => {
      expect(mapPlaidAccountType('depository', 'money market')).toBe('savings');
      expect(mapPlaidAccountType('depository', 'Money Market')).toBe('savings');
    });

    it('should map PayPal depository accounts to checking', () => {
      expect(mapPlaidAccountType('depository', 'paypal')).toBe('checking');
    });

    it('should map prepaid accounts to checking', () => {
      expect(mapPlaidAccountType('depository', 'prepaid')).toBe('checking');
    });

    it('should map cash management accounts to checking', () => {
      expect(mapPlaidAccountType('depository', 'cash management')).toBe('checking');
    });

    it('should map EBT accounts to checking', () => {
      expect(mapPlaidAccountType('depository', 'ebt')).toBe('checking');
    });

    it('should default unknown depository subtypes to checking', () => {
      expect(mapPlaidAccountType('depository', 'unknown')).toBe('checking');
      expect(mapPlaidAccountType('depository', null)).toBe('checking');
      expect(mapPlaidAccountType('depository', '')).toBe('checking');
    });
  });

  describe('Credit Accounts', () => {
    it('should map credit card accounts correctly', () => {
      expect(mapPlaidAccountType('credit', 'credit card')).toBe('credit_card');
      expect(mapPlaidAccountType('CREDIT', 'CREDIT CARD')).toBe('credit_card');
    });

    it('should map PayPal credit accounts to credit_card', () => {
      expect(mapPlaidAccountType('credit', 'paypal')).toBe('credit_card');
    });

    it('should map line of credit to credit_card', () => {
      expect(mapPlaidAccountType('credit', 'line of credit')).toBe('credit_card');
    });

    it('should default unknown credit subtypes to credit_card', () => {
      expect(mapPlaidAccountType('credit', 'unknown')).toBe('credit_card');
      expect(mapPlaidAccountType('credit', null)).toBe('credit_card');
    });
  });

  describe('Investment - Retirement Accounts', () => {
    it('should map 401k accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', '401k')).toBe('retirement');
      expect(mapPlaidAccountType('investment', '401K')).toBe('retirement');
    });

    it('should map 403b accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', '403b')).toBe('retirement');
    });

    it('should map 401a accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', '401a')).toBe('retirement');
    });

    it('should map 457b accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', '457b')).toBe('retirement');
    });

    it('should map IRA accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'ira')).toBe('retirement');
      expect(mapPlaidAccountType('investment', 'IRA')).toBe('retirement');
    });

    it('should map Roth IRA accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'roth ira')).toBe('retirement');
      expect(mapPlaidAccountType('investment', 'roth')).toBe('retirement');
      expect(mapPlaidAccountType('investment', 'Roth IRA')).toBe('retirement');
    });

    it('should map Roth 401k accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'roth 401k')).toBe('retirement');
    });

    it('should map SEP IRA accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'sep ira')).toBe('retirement');
    });

    it('should map SIMPLE IRA accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'simple ira')).toBe('retirement');
    });

    it('should map SARSEP accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'sarsep')).toBe('retirement');
    });

    it('should map pension accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'pension')).toBe('retirement');
    });

    it('should map profit sharing plans to retirement', () => {
      expect(mapPlaidAccountType('investment', 'profit sharing plan')).toBe('retirement');
    });

    it('should map stock plans to retirement', () => {
      expect(mapPlaidAccountType('investment', 'stock plan')).toBe('retirement');
    });

    it('should map Keogh accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'keogh')).toBe('retirement');
    });

    it('should map generic retirement accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'retirement')).toBe('retirement');
    });
  });

  describe('Investment - Canadian Retirement Accounts', () => {
    it('should map RRSP accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'rrsp')).toBe('retirement');
    });

    it('should map RRIF accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'rrif')).toBe('retirement');
    });

    it('should map TFSA accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'tfsa')).toBe('retirement');
    });

    it('should map LIRA accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'lira')).toBe('retirement');
    });

    it('should map LIF accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'lif')).toBe('retirement');
    });

    it('should map LRSP accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'lrsp')).toBe('retirement');
    });

    it('should map LRIF accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'lrif')).toBe('retirement');
    });

    it('should map RLIF accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'rlif')).toBe('retirement');
    });

    it('should map PRIF accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'prif')).toBe('retirement');
    });

    it('should map RDSP accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'rdsp')).toBe('retirement');
    });

    it('should map RESP accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'resp')).toBe('retirement');
    });
  });

  describe('Investment - UK Retirement Accounts', () => {
    it('should map SIPP accounts to retirement', () => {
      expect(mapPlaidAccountType('investment', 'sipp')).toBe('retirement');
    });
  });

  describe('Investment - Non-Retirement Accounts', () => {
    it('should map brokerage accounts to investment', () => {
      expect(mapPlaidAccountType('investment', 'brokerage')).toBe('investment');
      expect(mapPlaidAccountType('investment', 'Brokerage')).toBe('investment');
    });

    it('should map 529 accounts to investment', () => {
      expect(mapPlaidAccountType('investment', '529')).toBe('investment');
    });

    it('should map education savings accounts to investment', () => {
      expect(mapPlaidAccountType('investment', 'education savings account')).toBe('investment');
    });

    it('should map mutual fund accounts to investment', () => {
      expect(mapPlaidAccountType('investment', 'mutual fund')).toBe('investment');
    });

    it('should map trust accounts to investment', () => {
      expect(mapPlaidAccountType('investment', 'trust')).toBe('investment');
    });

    it('should map UGMA accounts to investment', () => {
      expect(mapPlaidAccountType('investment', 'ugma')).toBe('investment');
    });

    it('should map UTMA accounts to investment', () => {
      expect(mapPlaidAccountType('investment', 'utma')).toBe('investment');
    });

    it('should map non-taxable brokerage accounts to investment', () => {
      expect(mapPlaidAccountType('investment', 'non-taxable brokerage account')).toBe('investment');
    });

    it('should map annuity accounts to investment', () => {
      expect(mapPlaidAccountType('investment', 'fixed annuity')).toBe('investment');
      expect(mapPlaidAccountType('investment', 'variable annuity')).toBe('investment');
    });

    it('should map ISA accounts to investment', () => {
      expect(mapPlaidAccountType('investment', 'cash isa')).toBe('investment');
      expect(mapPlaidAccountType('investment', 'isa')).toBe('investment');
    });

    it('should map GIC accounts to investment', () => {
      expect(mapPlaidAccountType('investment', 'gic')).toBe('investment');
    });

    it('should map health reimbursement arrangement accounts to investment', () => {
      expect(mapPlaidAccountType('investment', 'health reimbursement arrangement')).toBe('investment');
    });

    it('should map investment HSA accounts to investment', () => {
      expect(mapPlaidAccountType('investment', 'hsa')).toBe('investment');
    });

    it('should default unknown investment subtypes to investment', () => {
      expect(mapPlaidAccountType('investment', 'unknown')).toBe('investment');
      expect(mapPlaidAccountType('investment', null)).toBe('investment');
    });
  });

  describe('Loan Accounts', () => {
    it('should map mortgage accounts to mortgage', () => {
      expect(mapPlaidAccountType('loan', 'mortgage')).toBe('mortgage');
      expect(mapPlaidAccountType('LOAN', 'MORTGAGE')).toBe('mortgage');
    });

    it('should map home equity loans to mortgage', () => {
      expect(mapPlaidAccountType('loan', 'home equity')).toBe('mortgage');
    });

    it('should map student loans to loan', () => {
      expect(mapPlaidAccountType('loan', 'student')).toBe('loan');
    });

    it('should map auto loans to loan', () => {
      expect(mapPlaidAccountType('loan', 'auto')).toBe('loan');
    });

    it('should map personal loans to loan', () => {
      expect(mapPlaidAccountType('loan', 'personal')).toBe('loan');
    });

    it('should map commercial loans to loan', () => {
      expect(mapPlaidAccountType('loan', 'commercial')).toBe('loan');
    });

    it('should map construction loans to loan', () => {
      expect(mapPlaidAccountType('loan', 'construction')).toBe('loan');
    });

    it('should map business loans to loan', () => {
      expect(mapPlaidAccountType('loan', 'business')).toBe('loan');
    });

    it('should map consumer loans to loan', () => {
      expect(mapPlaidAccountType('loan', 'consumer')).toBe('loan');
    });

    it('should map line of credit to loan', () => {
      expect(mapPlaidAccountType('loan', 'line of credit')).toBe('loan');
    });

    it('should map generic loan to loan', () => {
      expect(mapPlaidAccountType('loan', 'loan')).toBe('loan');
    });

    it('should map overdraft to loan', () => {
      expect(mapPlaidAccountType('loan', 'overdraft')).toBe('loan');
    });

    it('should map other loan subtypes to loan', () => {
      expect(mapPlaidAccountType('loan', 'other')).toBe('loan');
    });

    it('should default unknown loan subtypes to loan', () => {
      expect(mapPlaidAccountType('loan', 'unknown')).toBe('loan');
      expect(mapPlaidAccountType('loan', null)).toBe('loan');
    });
  });

  describe('Legacy Brokerage Type', () => {
    it('should map legacy brokerage type to investment', () => {
      expect(mapPlaidAccountType('brokerage', null)).toBe('investment');
      expect(mapPlaidAccountType('brokerage', 'standard')).toBe('investment');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null type by returning other', () => {
      expect(mapPlaidAccountType(null as any, 'checking')).toBe('other');
    });

    it('should handle undefined type by returning other', () => {
      expect(mapPlaidAccountType(undefined as any, 'checking')).toBe('other');
    });

    it('should handle empty string type by returning other', () => {
      expect(mapPlaidAccountType('', 'checking')).toBe('other');
    });

    it('should handle null subtype gracefully', () => {
      expect(mapPlaidAccountType('depository', null)).toBe('checking');
      expect(mapPlaidAccountType('credit', null)).toBe('credit_card');
      expect(mapPlaidAccountType('investment', null)).toBe('investment');
      expect(mapPlaidAccountType('loan', null)).toBe('loan');
    });

    it('should handle empty string subtype gracefully', () => {
      expect(mapPlaidAccountType('depository', '')).toBe('checking');
      expect(mapPlaidAccountType('credit', '')).toBe('credit_card');
      expect(mapPlaidAccountType('investment', '')).toBe('investment');
      expect(mapPlaidAccountType('loan', '')).toBe('loan');
    });

    it('should handle unknown account types by returning other', () => {
      expect(mapPlaidAccountType('unknown', 'subtype')).toBe('other');
      expect(mapPlaidAccountType('insurance', 'life')).toBe('other');
      expect(mapPlaidAccountType('real_estate', 'property')).toBe('other');
    });

    it('should handle case insensitivity', () => {
      expect(mapPlaidAccountType('DEPOSITORY', 'CHECKING')).toBe('checking');
      expect(mapPlaidAccountType('DePOSiToRy', 'CHeCKing')).toBe('checking');
      expect(mapPlaidAccountType('credit', 'CREDIT CARD')).toBe('credit_card');
      expect(mapPlaidAccountType('INVESTMENT', '401K')).toBe('retirement');
      expect(mapPlaidAccountType('LOAN', 'MORTGAGE')).toBe('mortgage');
    });

    it('should handle mixed case with spaces', () => {
      expect(mapPlaidAccountType('Depository', 'Money Market')).toBe('savings');
      expect(mapPlaidAccountType('Credit', 'Line Of Credit')).toBe('credit_card');
      expect(mapPlaidAccountType('Investment', 'Roth IRA')).toBe('retirement');
      expect(mapPlaidAccountType('Loan', 'Home Equity')).toBe('mortgage');
    });
  });

  describe('Real-World Plaid Account Examples', () => {
    it('should correctly map Chase checking account', () => {
      expect(mapPlaidAccountType('depository', 'checking')).toBe('checking');
    });

    it('should correctly map Bank of America savings account', () => {
      expect(mapPlaidAccountType('depository', 'savings')).toBe('savings');
    });

    it('should correctly map Discover credit card', () => {
      expect(mapPlaidAccountType('credit', 'credit card')).toBe('credit_card');
    });

    it('should correctly map Vanguard 401k', () => {
      expect(mapPlaidAccountType('investment', '401k')).toBe('retirement');
    });

    it('should correctly map Fidelity Roth IRA', () => {
      expect(mapPlaidAccountType('investment', 'roth ira')).toBe('retirement');
    });

    it('should correctly map Charles Schwab brokerage', () => {
      expect(mapPlaidAccountType('investment', 'brokerage')).toBe('investment');
    });

    it('should correctly map Wells Fargo mortgage', () => {
      expect(mapPlaidAccountType('loan', 'mortgage')).toBe('mortgage');
    });

    it('should correctly map student loan', () => {
      expect(mapPlaidAccountType('loan', 'student')).toBe('loan');
    });

    it('should correctly map auto loan', () => {
      expect(mapPlaidAccountType('loan', 'auto')).toBe('loan');
    });
  });

  describe('All AccountType Enum Values Coverage', () => {
    it('should be able to return checking', () => {
      expect(mapPlaidAccountType('depository', 'checking')).toBe('checking');
    });

    it('should be able to return savings', () => {
      expect(mapPlaidAccountType('depository', 'savings')).toBe('savings');
    });

    it('should be able to return credit_card', () => {
      expect(mapPlaidAccountType('credit', 'credit card')).toBe('credit_card');
    });

    it('should be able to return investment', () => {
      expect(mapPlaidAccountType('investment', 'brokerage')).toBe('investment');
    });

    it('should be able to return retirement', () => {
      expect(mapPlaidAccountType('investment', '401k')).toBe('retirement');
    });

    it('should be able to return loan', () => {
      expect(mapPlaidAccountType('loan', 'student')).toBe('loan');
    });

    it('should be able to return mortgage', () => {
      expect(mapPlaidAccountType('loan', 'mortgage')).toBe('mortgage');
    });

    it('should be able to return other', () => {
      expect(mapPlaidAccountType('unknown', 'unknown')).toBe('other');
    });
  });
});
