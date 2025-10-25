/**
 * API Route Protection Middleware
 * Higher-order function to protect API routes with feature access control
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureAccess, getRequiredTierForFeature, type FeatureName } from '@/lib/subscription/access-control';

/**
 * Wraps an API route handler with feature access protection
 *
 * @example
 * export const POST = withFeatureAccess('export_data', async (request) => {
 *   // Handler only executes if user has access to export_data feature
 *   return NextResponse.json({ success: true });
 * });
 */
export function withFeatureAccess(
  featureName: FeatureName,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Check feature access
      await requireFeatureAccess(featureName);

      // Access granted - execute the handler
      return handler(request);
    } catch (error) {
      // Access denied
      const requiredTier = getRequiredTierForFeature(featureName);

      return NextResponse.json(
        {
          error: 'Access denied',
          message: error instanceof Error ? error.message : 'Upgrade required',
          feature: featureName,
          requiredTier,
          upgradeUrl: '/dashboard/subscription',
        },
        { status: 403 }
      );
    }
  };
}

/**
 * Middleware for checking multiple feature requirements
 * User must have access to ALL specified features
 *
 * @example
 * export const POST = withFeatureAccesses(['export_data', 'advanced_budgeting'], async (request) => {
 *   // Handler only executes if user has access to both features
 *   return NextResponse.json({ success: true });
 * });
 */
export function withFeatureAccesses(
  featureNames: FeatureName[],
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Check all feature access requirements
      for (const featureName of featureNames) {
        await requireFeatureAccess(featureName);
      }

      // All access granted - execute the handler
      return handler(request);
    } catch (error) {
      // Extract which feature caused denial
      const errorMessage = error instanceof Error ? error.message : 'Upgrade required';
      const deniedFeature = featureNames.find(f => errorMessage.includes(f)) || featureNames[0];
      const requiredTier = getRequiredTierForFeature(deniedFeature);

      return NextResponse.json(
        {
          error: 'Access denied',
          message: errorMessage,
          features: featureNames,
          deniedFeature,
          requiredTier,
          upgradeUrl: '/dashboard/subscription',
        },
        { status: 403 }
      );
    }
  };
}

/**
 * Middleware for optional feature access
 * Returns information about access but doesn't block the request
 * Handler receives access information as second parameter
 *
 * @example
 * export const POST = withOptionalFeature('export_data', async (request, hasAccess) => {
 *   if (hasAccess) {
 *     // Provide full export
 *   } else {
 *     // Provide limited export
 *   }
 *   return NextResponse.json({ success: true });
 * });
 */
export function withOptionalFeature(
  featureName: FeatureName,
  handler: (request: NextRequest, hasAccess: boolean) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      await requireFeatureAccess(featureName);
      // Access granted
      return handler(request, true);
    } catch (error) {
      // No access but continue anyway
      return handler(request, false);
    }
  };
}
