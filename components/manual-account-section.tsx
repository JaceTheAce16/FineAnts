/**
 * Manual Account Section Component
 * Manages the display and state of the manual account entry form
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ManualAccountForm } from '@/components/manual-account-form';

export function ManualAccountSection() {
  const [showForm, setShowForm] = useState(false);

  const handleSuccess = () => {
    setShowForm(false);
    // Reload the page to show the new account
    window.location.reload();
  };

  const handleCancel = () => {
    setShowForm(false);
  };

  if (showForm) {
    return <ManualAccountForm onSuccess={handleSuccess} onCancel={handleCancel} />;
  }

  return (
    <Button variant="outline" onClick={() => setShowForm(true)}>
      Add Manual Account
    </Button>
  );
}
