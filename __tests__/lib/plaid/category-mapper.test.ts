/**
 * Tests for Plaid Category Mapper
 */

import { describe, it, expect } from 'vitest';
import { mapPlaidCategoryToApp, getPlaidCategoryExamples } from '@/lib/plaid/category-mapper';
import { TransactionCategory } from '@/lib/types/database';

describe('Category Mapper', () => {
  describe('mapPlaidCategoryToApp', () => {
    describe('Income categories', () => {
      it('should map income categories correctly', () => {
        expect(mapPlaidCategoryToApp(['Income', 'Salary'])).toBe('income');
        expect(mapPlaidCategoryToApp(['Income', 'Wages'])).toBe('income');
        expect(mapPlaidCategoryToApp(['Transfer', 'Payroll'])).toBe('income');
        expect(mapPlaidCategoryToApp(['Transfer In'])).toBe('income');
      });
    });

    describe('Housing categories', () => {
      it('should map housing categories correctly', () => {
        expect(mapPlaidCategoryToApp(['Payment', 'Rent'])).toBe('housing');
        expect(mapPlaidCategoryToApp(['Payment', 'Mortgage'])).toBe('housing');
        expect(mapPlaidCategoryToApp(['Home Improvement'])).toBe('housing');
        expect(mapPlaidCategoryToApp(['Service', 'Home Insurance'])).toBe('housing');
        expect(mapPlaidCategoryToApp(['Service', 'Property Insurance'])).toBe('housing');
      });
    });

    describe('Transportation categories', () => {
      it('should map transportation categories correctly', () => {
        expect(mapPlaidCategoryToApp(['Transportation', 'Gas'])).toBe('transportation');
        expect(mapPlaidCategoryToApp(['Transportation', 'Parking'])).toBe('transportation');
        expect(mapPlaidCategoryToApp(['Transportation', 'Public Transit'])).toBe('transportation');
        expect(mapPlaidCategoryToApp(['Automotive', 'Service'])).toBe('transportation');
        expect(mapPlaidCategoryToApp(['Service', 'Auto Insurance'])).toBe('transportation');
        expect(mapPlaidCategoryToApp(['Service', 'Gas Stations'])).toBe('transportation');
        expect(mapPlaidCategoryToApp(['Service', 'Tolls'])).toBe('transportation');
        expect(mapPlaidCategoryToApp(['Service', 'Car Wash'])).toBe('transportation');
      });
    });

    describe('Food categories', () => {
      it('should map food categories correctly', () => {
        expect(mapPlaidCategoryToApp(['Food and Drink', 'Restaurants'])).toBe('food');
        expect(mapPlaidCategoryToApp(['Food and Drink', 'Fast Food'])).toBe('food');
        expect(mapPlaidCategoryToApp(['Food and Drink', 'Groceries'])).toBe('food');
        expect(mapPlaidCategoryToApp(['Food and Drink', 'Coffee Shop'])).toBe('food');
        expect(mapPlaidCategoryToApp(['Shops', 'Supermarkets and Groceries'])).toBe('food');
      });
    });

    describe('Utilities categories', () => {
      it('should map utilities categories correctly', () => {
        expect(mapPlaidCategoryToApp(['Service', 'Utilities', 'Electric'])).toBe('utilities');
        expect(mapPlaidCategoryToApp(['Service', 'Utilities', 'Gas'])).toBe('utilities');
        expect(mapPlaidCategoryToApp(['Service', 'Utilities', 'Water'])).toBe('utilities');
        expect(mapPlaidCategoryToApp(['Service', 'Telephone'])).toBe('utilities');
        expect(mapPlaidCategoryToApp(['Service', 'Internet'])).toBe('utilities');
        expect(mapPlaidCategoryToApp(['Service', 'Cable'])).toBe('utilities');
        expect(mapPlaidCategoryToApp(['Service', 'Sewage'])).toBe('utilities');
      });
    });

    describe('Healthcare categories', () => {
      it('should map healthcare categories correctly', () => {
        expect(mapPlaidCategoryToApp(['Healthcare', 'Doctors'])).toBe('healthcare');
        expect(mapPlaidCategoryToApp(['Healthcare', 'Dentist'])).toBe('healthcare');
        expect(mapPlaidCategoryToApp(['Healthcare', 'Pharmacy'])).toBe('healthcare');
        expect(mapPlaidCategoryToApp(['Healthcare', 'Hospital'])).toBe('healthcare');
        expect(mapPlaidCategoryToApp(['Service', 'Health Insurance'])).toBe('healthcare');
        expect(mapPlaidCategoryToApp(['Medical'])).toBe('healthcare');
        expect(mapPlaidCategoryToApp(['Healthcare', 'Eyecare'])).toBe('healthcare');
      });
    });

    describe('Entertainment categories', () => {
      it('should map entertainment categories correctly', () => {
        expect(mapPlaidCategoryToApp(['Recreation', 'Entertainment'])).toBe('entertainment');
        expect(mapPlaidCategoryToApp(['Recreation', 'Arts and Entertainment'])).toBe('entertainment');
        expect(mapPlaidCategoryToApp(['Recreation', 'Movies'])).toBe('entertainment');
        expect(mapPlaidCategoryToApp(['Recreation', 'Music'])).toBe('entertainment');
        expect(mapPlaidCategoryToApp(['Recreation', 'Sports'])).toBe('entertainment');
        expect(mapPlaidCategoryToApp(['Recreation', 'Gyms and Fitness Centers'])).toBe('entertainment');
        expect(mapPlaidCategoryToApp(['Recreation', 'Games'])).toBe('entertainment');
        expect(mapPlaidCategoryToApp(['Service', 'Streaming Subscription'])).toBe('entertainment');
        expect(mapPlaidCategoryToApp(['Arts', 'Music and Shows'])).toBe('entertainment');
      });
    });

    describe('Shopping categories', () => {
      it('should map shopping categories correctly', () => {
        expect(mapPlaidCategoryToApp(['Shops', 'Clothing and Accessories'])).toBe('shopping');
        expect(mapPlaidCategoryToApp(['Shops', 'Electronics'])).toBe('shopping');
        expect(mapPlaidCategoryToApp(['Shops', 'Department Stores'])).toBe('shopping');
        expect(mapPlaidCategoryToApp(['Shops', 'Bookstores'])).toBe('shopping');
        expect(mapPlaidCategoryToApp(['Shops', 'Sporting Goods'])).toBe('shopping');
        expect(mapPlaidCategoryToApp(['Shopping', 'Online'])).toBe('shopping');
        expect(mapPlaidCategoryToApp(['Retail'])).toBe('shopping');
      });
    });

    describe('Debt payment categories', () => {
      it('should map debt payment categories correctly', () => {
        expect(mapPlaidCategoryToApp(['Payment', 'Credit Card'])).toBe('debt_payment');
        expect(mapPlaidCategoryToApp(['Payment', 'Loan Payment'])).toBe('debt_payment');
        expect(mapPlaidCategoryToApp(['Transfer', 'Credit'])).toBe('debt_payment');
        expect(mapPlaidCategoryToApp(['Payment', 'Student Loan'])).toBe('debt_payment');
        expect(mapPlaidCategoryToApp(['Loan'])).toBe('debt_payment');
      });
    });

    describe('Savings categories', () => {
      it('should map savings and transfer categories correctly', () => {
        expect(mapPlaidCategoryToApp(['Transfer', 'Deposit'])).toBe('savings');
        expect(mapPlaidCategoryToApp(['Transfer', 'Investment'])).toBe('savings');
        expect(mapPlaidCategoryToApp(['Transfer', 'Savings'])).toBe('savings');
        expect(mapPlaidCategoryToApp(['Transfer', 'Retirement'])).toBe('savings');
        expect(mapPlaidCategoryToApp(['Transfer', 'Third Party'])).toBe('savings');
      });
    });

    describe('Other categories', () => {
      it('should map unrecognized categories to other', () => {
        expect(mapPlaidCategoryToApp(['Bank Fees'])).toBe('other');
        expect(mapPlaidCategoryToApp(['Travel', 'Airlines'])).toBe('other');
        expect(mapPlaidCategoryToApp(['Community'])).toBe('other');
        expect(mapPlaidCategoryToApp(['Service', 'Financial'])).toBe('other');
        expect(mapPlaidCategoryToApp(['Tax'])).toBe('other');
        expect(mapPlaidCategoryToApp(['Government'])).toBe('other');
      });
    });

    describe('Edge cases', () => {
      it('should handle null category', () => {
        expect(mapPlaidCategoryToApp(null)).toBe('other');
      });

      it('should handle undefined category', () => {
        expect(mapPlaidCategoryToApp(undefined)).toBe('other');
      });

      it('should handle empty array', () => {
        expect(mapPlaidCategoryToApp([])).toBe('other');
      });

      it('should handle array with empty strings', () => {
        expect(mapPlaidCategoryToApp(['', ''])).toBe('other');
      });

      it('should be case insensitive', () => {
        expect(mapPlaidCategoryToApp(['FOOD AND DRINK', 'RESTAURANTS'])).toBe('food');
        expect(mapPlaidCategoryToApp(['food and drink', 'restaurants'])).toBe('food');
        expect(mapPlaidCategoryToApp(['Food And Drink', 'Restaurants'])).toBe('food');
      });

      it('should handle single-element category arrays', () => {
        expect(mapPlaidCategoryToApp(['Income'])).toBe('income');
        expect(mapPlaidCategoryToApp(['Rent'])).toBe('housing');
        expect(mapPlaidCategoryToApp(['Healthcare'])).toBe('healthcare');
      });

      it('should handle multi-level category arrays', () => {
        expect(mapPlaidCategoryToApp(['Service', 'Utilities', 'Electric', 'Provider'])).toBe('utilities');
      });
    });

    describe('Ambiguous categories', () => {
      it('should prioritize more specific matches', () => {
        // Transfer could be income or savings, but with 'Payroll' subcategory should be income
        expect(mapPlaidCategoryToApp(['Transfer', 'Payroll'])).toBe('income');

        // Transfer with 'Investment' should be savings
        expect(mapPlaidCategoryToApp(['Transfer', 'Investment'])).toBe('savings');
      });

      it('should handle categories that could match multiple patterns', () => {
        // Gas could be utilities (gas utility) or transportation (gas station)
        // Transportation should take precedence
        expect(mapPlaidCategoryToApp(['Transportation', 'Gas'])).toBe('transportation');

        // But if it explicitly says gas utility, should be utilities
        expect(mapPlaidCategoryToApp(['Service', 'Gas Utility'])).toBe('utilities');
      });
    });
  });

  describe('getPlaidCategoryExamples', () => {
    it('should return examples for all FineAnts categories', () => {
      const categories: TransactionCategory[] = [
        'income',
        'housing',
        'transportation',
        'food',
        'utilities',
        'healthcare',
        'entertainment',
        'shopping',
        'debt_payment',
        'savings',
        'other',
      ];

      categories.forEach((category) => {
        const examples = getPlaidCategoryExamples(category);
        expect(examples).toBeDefined();
        expect(Array.isArray(examples)).toBe(true);
        expect(examples.length).toBeGreaterThan(0);
      });
    });

    it('should return valid example arrays', () => {
      const examples = getPlaidCategoryExamples('food');

      examples.forEach((example) => {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBeGreaterThan(0);

        // Each example should map back to the correct category
        expect(mapPlaidCategoryToApp(example)).toBe('food');
      });
    });

    it('should verify all examples map correctly', () => {
      const categories: TransactionCategory[] = [
        'income',
        'housing',
        'transportation',
        'food',
        'utilities',
        'healthcare',
        'entertainment',
        'shopping',
        'debt_payment',
        'savings',
      ];

      categories.forEach((category) => {
        const examples = getPlaidCategoryExamples(category);

        examples.forEach((example) => {
          const mapped = mapPlaidCategoryToApp(example);
          expect(mapped).toBe(category);
        });
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle real-world Plaid category examples', () => {
      // Real examples from Plaid documentation
      expect(mapPlaidCategoryToApp(['Food and Drink', 'Restaurants', 'Fast Food'])).toBe('food');
      expect(mapPlaidCategoryToApp(['Travel', 'Airlines and Aviation Services'])).toBe('other');
      expect(mapPlaidCategoryToApp(['Shops', 'Supermarkets and Groceries'])).toBe('food');
      expect(mapPlaidCategoryToApp(['Recreation', 'Gyms and Fitness Centers'])).toBe('entertainment');
      expect(mapPlaidCategoryToApp(['Service', 'Telecommunication Services'])).toBe('utilities');
    });

    it('should provide consistent mappings for similar categories', () => {
      // All restaurant variations should map to food
      expect(mapPlaidCategoryToApp(['Food and Drink', 'Restaurants'])).toBe('food');
      expect(mapPlaidCategoryToApp(['Food and Drink', 'Restaurants', 'Fast Food'])).toBe('food');
      expect(mapPlaidCategoryToApp(['Food and Drink', 'Restaurants', 'Pizza'])).toBe('food');

      // All transportation variations
      expect(mapPlaidCategoryToApp(['Transportation', 'Taxi'])).toBe('transportation');
      expect(mapPlaidCategoryToApp(['Transportation', 'Public Transportation'])).toBe('transportation');
      expect(mapPlaidCategoryToApp(['Transportation', 'Bike'])).toBe('transportation');
    });
  });
});
