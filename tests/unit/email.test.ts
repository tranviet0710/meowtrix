// tests/unit/email.test.ts — Unit tests for email HTML injection mitigation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create a mock send function that we can spy on
const mockSend = vi.fn().mockResolvedValue({
  data: { id: 'mock-email-id-123' },
  error: null,
});

// Mock the Resend client
vi.mock('resend', () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: {
        send: mockSend,
      },
    })),
  };
});

// Import after mocking
import { sendClaimEmails, sendClaimReminderEmail, sendConfirmationEmail } from '@/lib/email';

describe('Email HTML Injection Mitigation', () => {
  beforeEach(() => {
    // Set required environment variables
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.RESEND_FROM_EMAIL = 'test@meowtrix.io';
    process.env.NEXT_PUBLIC_APP_URL = 'https://meowtrix.io';
    mockSend.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sendClaimEmails - HTML injection prevention', () => {
    it('should escape HTML tags in display_name fields', async () => {
      const maliciousOwnerName = '<script>alert("XSS")</script>';
      const maliciousReporterName = '<img src=x onerror=alert(1)>';
      const maliciousPetName = '<b>Bold Pet</b>';

      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: maliciousOwnerName,
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: maliciousReporterName,
        petName: maliciousPetName,
        matchId: 'match-123',
        matchScore: 95,
      });

      // Verify both emails were sent
      expect(mockSend).toHaveBeenCalledTimes(2);

      // Check the overlord owner email (first call)
      const overlordEmailCall = mockSend.mock.calls[0][0];
      expect(overlordEmailCall.html).not.toContain('<script>');
      expect(overlordEmailCall.html).not.toContain('<img src=x');
      expect(overlordEmailCall.html).toContain('&lt;script&gt;');
      expect(overlordEmailCall.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(overlordEmailCall.html).toContain('&lt;b&gt;Bold Pet&lt;/b&gt;');

      // Check the agent reporter email (second call)
      const agentEmailCall = mockSend.mock.calls[1][0];
      expect(agentEmailCall.html).not.toContain('<script>');
      expect(agentEmailCall.html).not.toContain('<img src=x');
      expect(agentEmailCall.html).toContain('&lt;script&gt;');
      expect(agentEmailCall.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(agentEmailCall.html).toContain('&lt;b&gt;Bold Pet&lt;/b&gt;');
    });

    it('should escape HTML entities in email addresses', async () => {
      // Email addresses with special characters (though unlikely in practice)
      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: 'Owner Name',
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: 'Reporter Name',
        petName: 'Fluffy',
        matchId: 'match-123',
        matchScore: 85,
      });

      expect(mockSend).toHaveBeenCalledTimes(2);

      // Verify emails are escaped in HTML content
      const overlordEmailCall = mockSend.mock.calls[0][0];
      const agentEmailCall = mockSend.mock.calls[1][0];

      // Both emails should contain escaped email addresses in the HTML
      expect(overlordEmailCall.html).toContain('reporter@test.com');
      expect(agentEmailCall.html).toContain('owner@test.com');
    });

    it('should escape special characters: ampersand, quotes, angle brackets', async () => {
      const nameWithSpecialChars = 'John & Jane "The Best" <Owners>';
      const petWithSpecialChars = 'Mr. Whiskers & Co. "The Cat"';

      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: nameWithSpecialChars,
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: 'Normal Name',
        petName: petWithSpecialChars,
        matchId: 'match-123',
        matchScore: 90,
      });

      expect(mockSend).toHaveBeenCalledTimes(2);

      const overlordEmailCall = mockSend.mock.calls[0][0];
      const agentEmailCall = mockSend.mock.calls[1][0];

      // Verify ampersands are escaped
      expect(overlordEmailCall.html).toContain('&amp;');
      expect(agentEmailCall.html).toContain('&amp;');

      // Verify quotes are escaped
      expect(overlordEmailCall.html).toContain('&quot;');
      expect(agentEmailCall.html).toContain('&quot;');

      // Verify angle brackets are escaped
      expect(overlordEmailCall.html).toContain('&lt;Owners&gt;');
      expect(agentEmailCall.html).toContain('&lt;Owners&gt;');
    });

    it('should prevent phishing via fake HTML links in display names', async () => {
      const phishingName = '<a href="http://evil.com">Click Here</a>';

      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: phishingName,
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: 'Normal Name',
        petName: 'Fluffy',
        matchId: 'match-123',
        matchScore: 88,
      });

      expect(mockSend).toHaveBeenCalledTimes(2);

      const overlordEmailCall = mockSend.mock.calls[0][0];
      const agentEmailCall = mockSend.mock.calls[1][0];

      // Verify the anchor tag is escaped and not rendered as a link
      expect(overlordEmailCall.html).not.toContain('<a href="http://evil.com">');
      expect(overlordEmailCall.html).toContain('&lt;a href=');
      expect(agentEmailCall.html).not.toContain('<a href="http://evil.com">');
      expect(agentEmailCall.html).toContain('&lt;a href=');
    });

    it('should escape HTML in subject lines', async () => {
      const maliciousPetName = '<script>alert("subject")</script>';

      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: 'Owner',
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: 'Reporter',
        petName: maliciousPetName,
        matchId: 'match-123',
        matchScore: 92,
      });

      expect(mockSend).toHaveBeenCalledTimes(2);

      const overlordEmailCall = mockSend.mock.calls[0][0];
      const agentEmailCall = mockSend.mock.calls[1][0];

      // Verify subject lines have escaped HTML
      expect(overlordEmailCall.subject).not.toContain('<script>');
      expect(overlordEmailCall.subject).toContain('&lt;script&gt;');
      expect(agentEmailCall.subject).not.toContain('<script>');
      expect(agentEmailCall.subject).toContain('&lt;script&gt;');
    });

    it('should handle empty strings safely', async () => {
      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: '',
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: '',
        petName: '',
        matchId: 'match-123',
        matchScore: 75,
      });

      expect(mockSend).toHaveBeenCalledTimes(2);

      // Should not throw and should send emails
      const overlordEmailCall = mockSend.mock.calls[0][0];
      expect(overlordEmailCall.html).toBeDefined();
    });

    it('should escape multiple injection attempts in the same field', async () => {
      const multipleInjections = '<script>alert(1)</script><img src=x onerror=alert(2)><iframe src="evil.com"></iframe>';

      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: multipleInjections,
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: 'Normal Name',
        petName: 'Fluffy',
        matchId: 'match-123',
        matchScore: 80,
      });

      expect(mockSend).toHaveBeenCalledTimes(2);

      const overlordEmailCall = mockSend.mock.calls[0][0];
      const agentEmailCall = mockSend.mock.calls[1][0];

      // Verify all injection attempts are escaped
      expect(overlordEmailCall.html).not.toContain('<script>');
      expect(overlordEmailCall.html).not.toContain('<img src=x');
      expect(overlordEmailCall.html).not.toContain('<iframe');
      expect(overlordEmailCall.html).toContain('&lt;script&gt;');
      expect(overlordEmailCall.html).toContain('&lt;img src=x');
      expect(overlordEmailCall.html).toContain('&lt;iframe');

      expect(agentEmailCall.html).not.toContain('<script>');
      expect(agentEmailCall.html).not.toContain('<img src=x');
      expect(agentEmailCall.html).not.toContain('<iframe');
    });
  });

  describe('sendClaimReminderEmail - HTML injection prevention', () => {
    it('should escape HTML in display name and pet name', async () => {
      const maliciousDisplayName = '<script>alert("reminder")</script>';
      const maliciousPetName = '<img src=x onerror=alert(1)>';

      await sendClaimReminderEmail({
        email: 'user@test.com',
        displayName: maliciousDisplayName,
        petName: maliciousPetName,
        matchId: 'match-456',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);

      const emailCall = mockSend.mock.calls[0][0];
      expect(emailCall.html).not.toContain('<script>');
      expect(emailCall.html).not.toContain('<img src=x');
      expect(emailCall.html).toContain('&lt;script&gt;');
      expect(emailCall.html).toContain('&lt;img src=x onerror=alert(1)&gt;');

      // Check subject line too
      expect(emailCall.subject).not.toContain('<img src=x');
      expect(emailCall.subject).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('should escape special characters in reminder emails', async () => {
      await sendClaimReminderEmail({
        email: 'user@test.com',
        displayName: 'John & Jane "Owners"',
        petName: 'Mr. <Whiskers>',
        matchId: 'match-789',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);

      const emailCall = mockSend.mock.calls[0][0];
      expect(emailCall.html).toContain('&amp;');
      expect(emailCall.html).toContain('&quot;');
      expect(emailCall.html).toContain('&lt;Whiskers&gt;');
    });
  });

  describe('sendConfirmationEmail - HTML injection prevention', () => {
    it('should escape HTML in display name', async () => {
      const maliciousDisplayName = '<script>alert("confirm")</script>';

      await sendConfirmationEmail({
        to: 'newuser@test.com',
        displayName: maliciousDisplayName,
        actionLink: 'https://meowtrix.io/confirm?token=abc123',
        variant: 'signup',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);

      const emailCall = mockSend.mock.calls[0][0];
      expect(emailCall.html).not.toContain('<script>');
      expect(emailCall.html).toContain('&lt;script&gt;');
    });

    it('should escape HTML in action link', async () => {
      // Malicious link with HTML injection attempt
      const maliciousLink = 'https://meowtrix.io/confirm?token=abc"><script>alert(1)</script>';

      await sendConfirmationEmail({
        to: 'newuser@test.com',
        displayName: 'Normal User',
        actionLink: maliciousLink,
        variant: 'signup',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);

      const emailCall = mockSend.mock.calls[0][0];
      // The link should be escaped
      expect(emailCall.html).not.toContain('"><script>');
      expect(emailCall.html).toContain('&quot;&gt;&lt;script&gt;');
    });

    it('should handle empty display name with fallback', async () => {
      await sendConfirmationEmail({
        to: 'newuser@test.com',
        displayName: '',
        actionLink: 'https://meowtrix.io/confirm?token=abc123',
        variant: 'signup',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);

      const emailCall = mockSend.mock.calls[0][0];
      // Should use "Informant" as fallback
      expect(emailCall.html).toContain('Informant');
    });
  });

  describe('Cross-user HTML injection scenarios', () => {
    it('should prevent attacker display_name from rendering as HTML in victim email', async () => {
      // Attacker registers with malicious display_name
      const attackerDisplayName = '<h1 style="color:red">URGENT: Send money to attacker@evil.com</h1>';

      // Attacker's name appears in victim's email
      await sendClaimEmails({
        overlordOwnerEmail: 'victim@test.com',
        overlordOwnerName: 'Victim User',
        agentReporterEmail: 'attacker@test.com',
        agentReporterName: attackerDisplayName,
        petName: 'Fluffy',
        matchId: 'match-999',
        matchScore: 95,
      });

      expect(mockSend).toHaveBeenCalledTimes(2);

      // Check the victim's email (overlord owner)
      const victimEmailCall = mockSend.mock.calls[0][0];
      
      // The malicious HTML should be escaped, not rendered
      expect(victimEmailCall.html).not.toContain('<h1 style="color:red">');
      expect(victimEmailCall.html).toContain('&lt;h1 style=');
      expect(victimEmailCall.html).toContain('&quot;color:red&quot;');
      
      // Verify the attacker's email is still present but escaped
      expect(victimEmailCall.html).toContain('attacker@test.com');
    });

    it('should prevent style injection via display_name', async () => {
      const styleInjection = '</strong><style>body{display:none}</style><strong>';

      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: styleInjection,
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: 'Normal Name',
        petName: 'Fluffy',
        matchId: 'match-111',
        matchScore: 87,
      });

      expect(mockSend).toHaveBeenCalledTimes(2);

      const overlordEmailCall = mockSend.mock.calls[0][0];
      const agentEmailCall = mockSend.mock.calls[1][0];

      // Style tags should be escaped
      expect(overlordEmailCall.html).not.toContain('<style>');
      expect(overlordEmailCall.html).toContain('&lt;style&gt;');
      expect(agentEmailCall.html).not.toContain('<style>');
      expect(agentEmailCall.html).toContain('&lt;style&gt;');
    });

    it('should prevent event handler injection', async () => {
      const eventHandlerInjection = '" onload="alert(document.cookie)" data-x="';

      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: eventHandlerInjection,
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: 'Normal Name',
        petName: 'Fluffy',
        matchId: 'match-222',
        matchScore: 91,
      });

      expect(mockSend).toHaveBeenCalledTimes(2);

      const overlordEmailCall = mockSend.mock.calls[0][0];
      const agentEmailCall = mockSend.mock.calls[1][0];

      // Event handlers should be escaped
      expect(overlordEmailCall.html).not.toContain('onload="alert');
      expect(overlordEmailCall.html).toContain('&quot; onload=&quot;');
      expect(agentEmailCall.html).not.toContain('onload="alert');
    });
  });

  describe('Legitimate content preservation', () => {
    it('should preserve legitimate special characters in names', async () => {
      // Legitimate names with apostrophes, hyphens, etc.
      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: "O'Brien-Smith",
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: 'María José',
        petName: "Mr. Whiskers III",
        matchId: 'match-333',
        matchScore: 93,
      });

      expect(mockSend).toHaveBeenCalledTimes(2);

      const overlordEmailCall = mockSend.mock.calls[0][0];
      
      // Apostrophes should be escaped but content should be readable
      expect(overlordEmailCall.html).toContain('O&#39;Brien-Smith');
      expect(overlordEmailCall.html).toContain('María José');
      expect(overlordEmailCall.html).toContain('Mr. Whiskers III');
    });

    it('should not double-escape already safe content', async () => {
      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: 'Normal Name',
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: 'Another Normal Name',
        petName: 'Fluffy',
        matchId: 'match-444',
        matchScore: 89,
      });

      expect(mockSend).toHaveBeenCalledTimes(2);

      const overlordEmailCall = mockSend.mock.calls[0][0];
      
      // Normal content should appear as-is (not double-escaped)
      expect(overlordEmailCall.html).toContain('Normal Name');
      expect(overlordEmailCall.html).toContain('Another Normal Name');
      expect(overlordEmailCall.html).toContain('Fluffy');
    });
  });
});
