// tests/unit/claimVerifyRaceCondition.test.ts
// Unit tests for concurrent claim verification race condition mitigation
//
// These tests verify that the atomic compare-and-swap pattern is correctly
// implemented to prevent the race condition where multiple concurrent requests
// could award points multiple times for a single claim.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Claim Verification Race Condition Mitigation', () => {
  const routeFilePath = join(process.cwd(), 'app/api/claims/[id]/verify/route.ts');
  const routeFileContent = readFileSync(routeFilePath, 'utf-8');

  it('uses atomic compare-and-swap with status guard in verified path', () => {
    // Verify that the update query includes .eq("status", "pending") guard
    // This is the critical security control that prevents race conditions
    
    // Look for the pattern in the verified branch
    const verifiedBranchPattern = /if\s*\(verified\)\s*\{[\s\S]*?\.update\([^)]+\)[\s\S]*?\.eq\("id",\s*claimId\)[\s\S]*?\.eq\("status",\s*"pending"\)/;
    
    expect(routeFileContent).toMatch(verifiedBranchPattern);
  });

  it('checks update result and returns 409 conflict when atomic update fails in verified path', () => {
    // Verify that after the atomic update, the code checks if rows were updated
    // and returns a 409 conflict if the update failed (race lost)
    
    const conflictCheckPattern = /if\s*\(updateError\s*\|\|\s*!updatedClaim\)\s*\{[\s\S]*?return\s+NextResponse\.json\([\s\S]*?"Cannot verify: Claim has already been processed"[\s\S]*?409/;
    
    expect(routeFileContent).toMatch(conflictCheckPattern);
  });

  it('uses atomic compare-and-swap with status guard in failed verification path', () => {
    // Verify that the failed verification path also uses atomic compare-and-swap
    // to prevent race conditions on failed attempts
    
    // Look for the pattern in the else branch (failed verification)
    const failedBranchPattern = /else\s*\{[\s\S]*?\.update\([^)]+\)[\s\S]*?\.eq\("id",\s*claimId\)[\s\S]*?\.eq\("status",\s*"pending"\)/;
    
    expect(routeFileContent).toMatch(failedBranchPattern);
  });

  it('checks update result and returns 409 conflict when atomic update fails in failed verification path', () => {
    // Verify that the failed verification path also checks the update result
    
    const failedConflictCheckPattern = /else\s*\{[\s\S]*?if\s*\(updateError\s*\|\|\s*!updatedClaim\)\s*\{[\s\S]*?return\s+NextResponse\.json\([\s\S]*?"Cannot verify: Claim has already been processed"[\s\S]*?409/;
    
    expect(routeFileContent).toMatch(failedConflictCheckPattern);
  });

  it('awards points only after successful atomic update', () => {
    // Verify that the point award code (increment_informant_points RPC)
    // is only executed after the atomic update succeeds
    
    // The RPC call should be after the conflict check in the verified branch
    const pointsAfterUpdatePattern = /if\s*\(updateError\s*\|\|\s*!updatedClaim\)\s*\{[\s\S]*?return[\s\S]*?\}[\s\S]*?increment_informant_points/;
    
    expect(routeFileContent).toMatch(pointsAfterUpdatePattern);
  });

  it('includes comment explaining atomic compare-and-swap for verified path', () => {
    // Verify that the code includes documentation about the race condition fix
    
    const commentPattern = /atomic compare-and-swap|Atomic guard|prevent race conditions/i;
    
    expect(routeFileContent).toMatch(commentPattern);
  });

  it('does not use unconditional update without status guard in critical paths', () => {
    // Verify that there are no update operations that only check ID without status
    // This would be vulnerable to race conditions
    
    // Look for patterns like .update(...).eq("id", claimId) without a following .eq("status", "pending")
    // We check that all updates in the verify handler have the status guard
    
    const lines = routeFileContent.split('\n');
    let inVerifiedBranch = false;
    let inFailedBranch = false;
    let foundUpdateWithoutGuard = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Track which branch we're in
      if (line.includes('if (verified)')) {
        inVerifiedBranch = true;
        inFailedBranch = false;
      } else if (line.includes('} else {') && inVerifiedBranch) {
        inVerifiedBranch = false;
        inFailedBranch = true;
      }
      
      // Check for update operations on claims table
      if ((inVerifiedBranch || inFailedBranch) && line.includes('.update(') && line.includes('claims')) {
        // Look ahead to see if there's a status guard
        let hasStatusGuard = false;
        for (let j = i; j < Math.min(i + 10, lines.length); j++) {
          if (lines[j].includes('.eq("status", "pending")') || lines[j].includes(".eq('status', 'pending')")) {
            hasStatusGuard = true;
            break;
          }
        }
        
        if (!hasStatusGuard) {
          foundUpdateWithoutGuard = true;
        }
      }
    }
    
    expect(foundUpdateWithoutGuard).toBe(false);
  });

  it('returns early with 409 when claim status is not pending', () => {
    // Verify that the handler checks claim status before processing
    // and returns 409 for non-pending claims
    
    const statusCheckPattern = /if\s*\(claim\.status\s*!==\s*"pending"\)\s*\{[\s\S]*?return\s+NextResponse\.json\([\s\S]*?409/;
    
    expect(routeFileContent).toMatch(statusCheckPattern);
  });
});
