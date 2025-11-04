/**
 * Category Mapper
 * Maps Plaid transaction categories to FineAnts transaction categories
 */

import { TransactionCategory } from '@/lib/types/database';

/**
 * Plaid category hierarchy is an array of strings, e.g., ['Food and Drink', 'Restaurants']
 * We check the primary category (index 0) and sometimes the subcategory (index 1) for more specific matching
 */

/**
 * Map Plaid transaction category to FineAnts TransactionCategory
 * @param plaidCategory Array of category strings from Plaid (e.g., ['Food and Drink', 'Restaurants'])
 * @returns FineAnts TransactionCategory
 */
export function mapPlaidCategoryToApp(
  plaidCategory: string[] | null | undefined
): TransactionCategory {
  // Handle null, undefined, or empty category arrays
  if (!plaidCategory || plaidCategory.length === 0) {
    return 'other';
  }

  const primaryCategory = plaidCategory[0]?.toLowerCase() || '';
  const subCategory = plaidCategory[1]?.toLowerCase() || '';
  const tertiaryCategory = plaidCategory[2]?.toLowerCase() || '';

  // Check for income first (more specific transfer patterns)
  if (
    primaryCategory.includes('income') ||
    primaryCategory.includes('payroll') ||
    primaryCategory.includes('transfer in') ||
    subCategory.includes('salary') ||
    subCategory.includes('wages') ||
    subCategory.includes('payroll')
  ) {
    return 'income';
  }

  // Debt payment categories (must check before generic 'payment' or 'transfer')
  if (
    primaryCategory.includes('credit card') ||
    primaryCategory.includes('loan') ||
    subCategory.includes('credit card') ||
    subCategory.includes('loan payment') ||
    subCategory.includes('student loan') ||
    (primaryCategory.includes('transfer') && subCategory.includes('credit')) ||
    (primaryCategory.includes('payment') && (
      subCategory.includes('credit') ||
      subCategory.includes('loan')
    ))
  ) {
    return 'debt_payment';
  }

  // Housing categories
  if (
    primaryCategory.includes('rent') ||
    primaryCategory.includes('mortgage') ||
    primaryCategory.includes('home improvement') ||
    subCategory.includes('rent') ||
    subCategory.includes('mortgage') ||
    subCategory.includes('property insurance') ||
    (primaryCategory.includes('service') && subCategory.includes('home insurance'))
  ) {
    return 'housing';
  }

  // Utilities categories (check subcategories specifically for 'Service' primary)
  if (
    primaryCategory.includes('utilities') ||
    subCategory.includes('utilities') ||
    tertiaryCategory.includes('electric') ||
    tertiaryCategory.includes('gas') ||
    tertiaryCategory.includes('water') ||
    (primaryCategory.includes('service') && (
      subCategory.includes('utilities') ||
      subCategory.includes('electric') ||
      subCategory.includes('gas utility') ||
      subCategory.includes('water') ||
      subCategory.includes('internet') ||
      subCategory.includes('phone') ||
      subCategory.includes('telephone') ||
      subCategory.includes('cable') ||
      subCategory.includes('sewage') ||
      subCategory.includes('telecommunication')
    ))
  ) {
    return 'utilities';
  }

  // Transportation categories
  if (
    primaryCategory.includes('transportation') ||
    primaryCategory.includes('automotive') ||
    primaryCategory.includes('public transit') ||
    subCategory.includes('gas') ||
    subCategory.includes('parking') ||
    subCategory.includes('tolls') ||
    subCategory.includes('auto insurance') ||
    subCategory.includes('car wash') ||
    subCategory.includes('taxi') ||
    subCategory.includes('bike')
  ) {
    return 'transportation';
  }

  // Food categories
  if (
    primaryCategory.includes('food') ||
    primaryCategory.includes('restaurants') ||
    primaryCategory.includes('groceries') ||
    subCategory.includes('restaurants') ||
    subCategory.includes('fast food') ||
    subCategory.includes('coffee') ||
    subCategory.includes('groceries') ||
    subCategory.includes('supermarkets') ||
    subCategory.includes('pizza')
  ) {
    return 'food';
  }

  // Healthcare categories
  if (
    primaryCategory.includes('healthcare') ||
    primaryCategory.includes('medical') ||
    subCategory.includes('doctors') ||
    subCategory.includes('dentist') ||
    subCategory.includes('pharmacy') ||
    subCategory.includes('hospital') ||
    subCategory.includes('health insurance') ||
    subCategory.includes('eyecare')
  ) {
    return 'healthcare';
  }

  // Entertainment categories
  if (
    primaryCategory.includes('entertainment') ||
    primaryCategory.includes('recreation') ||
    primaryCategory.includes('arts') ||
    subCategory.includes('movies') ||
    subCategory.includes('music') ||
    subCategory.includes('games') ||
    subCategory.includes('sports') ||
    subCategory.includes('concerts') ||
    subCategory.includes('streaming') ||
    subCategory.includes('gyms and fitness') ||
    subCategory.includes('entertainment')
  ) {
    return 'entertainment';
  }

  // Shopping categories
  if (
    primaryCategory.includes('shops') ||
    primaryCategory.includes('shopping') ||
    primaryCategory.includes('retail') ||
    subCategory.includes('clothing') ||
    subCategory.includes('electronics') ||
    subCategory.includes('bookstores') ||
    subCategory.includes('department stores') ||
    subCategory.includes('sporting goods')
  ) {
    return 'shopping';
  }

  // Payment categories (generic payments that aren't debt)
  if (
    primaryCategory.includes('payment') &&
    !subCategory.includes('credit') &&
    !subCategory.includes('loan')
  ) {
    return 'other';
  }

  // Savings/Investment categories (check last for transfers since it's broad)
  if (
    primaryCategory.includes('transfer') ||
    primaryCategory.includes('deposit') ||
    primaryCategory.includes('savings') ||
    subCategory.includes('investment') ||
    subCategory.includes('retirement') ||
    subCategory.includes('third party') ||
    subCategory.includes('savings') ||
    subCategory.includes('deposit')
  ) {
    return 'savings';
  }

  // Default to 'other' for unrecognized categories
  return 'other';
}

/**
 * Get all possible Plaid categories that map to a specific FineAnts category
 * Useful for testing and documentation
 * @param appCategory FineAnts TransactionCategory
 * @returns Array of example Plaid category patterns
 */
export function getPlaidCategoryExamples(
  appCategory: TransactionCategory
): string[][] {
  const examples: Record<TransactionCategory, string[][]> = {
    income: [
      ['Income', 'Salary'],
      ['Transfer', 'Payroll'],
      ['Transfer In'],
    ],
    housing: [
      ['Payment', 'Rent'],
      ['Payment', 'Mortgage'],
      ['Home Improvement'],
      ['Service', 'Home Insurance'],
    ],
    transportation: [
      ['Transportation', 'Gas'],
      ['Transportation', 'Parking'],
      ['Transportation', 'Public Transportation'],
      ['Service', 'Auto Insurance'],
    ],
    food: [
      ['Food and Drink', 'Restaurants'],
      ['Food and Drink', 'Groceries'],
      ['Food and Drink', 'Fast Food'],
      ['Food and Drink', 'Coffee Shop'],
    ],
    utilities: [
      ['Service', 'Utilities', 'Electric'],
      ['Service', 'Utilities', 'Gas'],
      ['Service', 'Utilities', 'Water'],
      ['Service', 'Telephone'],
      ['Service', 'Internet'],
      ['Service', 'Cable'],
    ],
    healthcare: [
      ['Healthcare', 'Doctors'],
      ['Healthcare', 'Dentist'],
      ['Healthcare', 'Pharmacy'],
      ['Service', 'Health Insurance'],
    ],
    entertainment: [
      ['Recreation', 'Entertainment'],
      ['Recreation', 'Arts and Entertainment'],
      ['Recreation', 'Gyms and Fitness Centers'],
      ['Recreation', 'Sports'],
    ],
    shopping: [
      ['Shops', 'Clothing and Accessories'],
      ['Shops', 'Electronics'],
      ['Shops', 'Department Stores'],
      ['Shops', 'Bookstores'],
    ],
    debt_payment: [
      ['Payment', 'Credit Card'],
      ['Payment', 'Loan Payment'],
      ['Transfer', 'Credit'],
    ],
    savings: [
      ['Transfer', 'Deposit'],
      ['Transfer', 'Investment'],
      ['Transfer', 'Savings'],
    ],
    other: [
      ['Bank Fees'],
      ['Community'],
      ['Travel'],
      ['Service', 'Financial'],
    ],
  };

  return examples[appCategory] || [];
}
