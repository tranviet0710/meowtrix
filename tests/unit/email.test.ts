// tests/unit/email.test.ts — Unit tests for email HTML escaping

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { escapeHtml, sendClaimEmails, sendClaimReminderEmail } from '@/lib/email';

// Create a mock send function that we can spy on
const mockSend = vi.fn().mockResolvedValue({
  data: { id: 'mock-email-id' },
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

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    const input = '<script>alert("XSS")</script>';
    const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
    expect(escapeHtml(input)).toBe(expected);
  });

  it('escapes ampersands', () => {
    const input = 'Tom & Jerry';
    const expected = 'Tom &amp; Jerry';
    expect(escapeHtml(input)).toBe(expected);
  });

  it('escapes less-than and greater-than signs', () => {
    const input = '5 < 10 > 3';
    const expected = '5 &lt; 10 &gt; 3';
    expect(escapeHtml(input)).toBe(expected);
  });

  it('escapes double quotes', () => {
    const input = 'He said "Hello"';
    const expected = 'He said &quot;Hello&quot;';
    expect(escapeHtml(input)).toBe(expected);
  });

  it('escapes single quotes', () => {
    const input = "It's a test";
    const expected = 'It&#39;s a test';
    expect(escapeHtml(input)).toBe(expected);
  });

  it('handles multiple special characters', () => {
    const input = '<img src="x" onerror=\'alert("XSS")\' />';
    const expected = '&lt;img src=&quot;x&quot; onerror=&#39;alert(&quot;XSS&quot;)&#39; /&gt;';
    expect(escapeHtml(input)).toBe(expected);
  });

  it('handles normal text without special characters', () => {
    const input = 'Fluffy the Cat';
    const expected = 'Fluffy the Cat';
    expect(escapeHtml(input)).toBe(expected);
  });

  it('handles empty string', () => {
    const input = '';
    const expected = '';
    expect(escapeHtml(input)).toBe(expected);
  });

  it('escapes HTML injection in pet names', () => {
    const maliciousPetName = '<img src=x onerror=alert(1)>';
    const expected = '&lt;img src=x onerror=alert(1)&gt;';
    expect(escapeHtml(maliciousPetName)).toBe(expected);
  });

  it('escapes event handlers in pet names', () => {
    const maliciousPetName = '" onload="alert(document.cookie)';
    const expected = '&quot; onload=&quot;alert(document.cookie)';
    expect(escapeHtml(maliciousPetName)).toBe(expected);
  });

  it('escapes style injection attempts', () => {
    const maliciousPetName = '</style><script>alert(1)</script>';
    const expected = '&lt;/style&gt;&lt;script&gt;alert(1)&lt;/script&gt;';
    expect(escapeHtml(maliciousPetName)).toBe(expected);
  });

  it('preserves unicode characters', () => {
    const input = 'Котик 🐱 猫';
    const expected = 'Котик 🐱 猫';
    expect(escapeHtml(input)).toBe(expected);
  });

  it('escapes ampersands before other entities', () => {
    // This ensures proper order of replacement (& must be first)
    const input = '&lt;script&gt;';
    const expected = '&amp;lt;script&amp;gt;';
    expect(escapeHtml(input)).toBe(expected);
  });
});

describe('Email HTML Injection Prevention', () => {
  beforeEach(() => {
    // Set required environment variables
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.meowtrix.io';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sendClaimEmails - Pentest Exploit Scenarios', () => {
    it('prevents HTML injection via malicious pet_name in claim emails', async () => {
      const maliciousPetName = '<img src=x onerror=alert(document.cookie)>';
      
      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: 'Owner Name',
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: 'Reporter Name',
        petName: maliciousPetName,
        matchId: 'test-match-123',
        matchScore: 95,
      });

      // Verify both emails were sent
      expect(mockSend).toHaveBeenCalledTimes(2);

      // Check that HTML is escaped in both email bodies
      const calls = mockSend.mock.calls;
      for (const call of calls) {
        const emailHtml = call[0].html;
        const emailSubject = call[0].subject;
        
        // Verify malicious HTML is escaped in body
        expect(emailHtml).not.toContain('<img src=x onerror=alert(document.cookie)>');
        expect(emailHtml).toContain('&lt;img src=x onerror=alert(document.cookie)&gt;');
        
        // Verify malicious HTML is escaped in subject
        expect(emailSubject).not.toContain('<img src=x onerror=alert(document.cookie)>');
        expect(emailSubject).toContain('&lt;img src=x onerror=alert(document.cookie)&gt;');
      }
    });

    it('prevents script injection via pet_name with closing tags', async () => {
      const maliciousPetName = '</strong></p><script>alert("XSS")</script><p><strong>';
      
      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: 'Owner Name',
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: 'Reporter Name',
        petName: maliciousPetName,
        matchId: 'test-match-123',
        matchScore: 95,
      });

      const calls = mockSend.mock.calls;
      for (const call of calls) {
        const emailHtml = call[0].html;
        
        // Verify script tags are escaped
        expect(emailHtml).not.toContain('<script>');
        expect(emailHtml).toContain('&lt;script&gt;');
        expect(emailHtml).not.toContain('</script>');
        expect(emailHtml).toContain('&lt;/script&gt;');
      }
    });

    it('prevents HTML injection via malicious user names', async () => {
      const maliciousName = '<img src=x onerror=alert(1)>';
      
      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: maliciousName,
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: maliciousName,
        petName: 'Fluffy',
        matchId: 'test-match-123',
        matchScore: 95,
      });

      const calls = mockSend.mock.calls;
      for (const call of calls) {
        const emailHtml = call[0].html;
        
        // Verify malicious HTML in names is escaped
        expect(emailHtml).not.toContain('<img src=x onerror=alert(1)>');
        expect(emailHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');
      }
    });

    it('prevents HTML injection via malicious email addresses in display', async () => {
      const maliciousEmail = 'test@example.com"><script>alert(1)</script><a href="x';
      
      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: 'Owner Name',
        agentReporterEmail: maliciousEmail,
        agentReporterName: 'Reporter Name',
        petName: 'Fluffy',
        matchId: 'test-match-123',
        matchScore: 95,
      });

      const calls = mockSend.mock.calls;
      const relevantCalls = calls.slice(-2); // Get last 2 calls for this test
      
      // The malicious email should appear in the first email (to overlord owner)
      // because it shows the agent reporter's contact info
      const overlordEmail = relevantCalls[0][0].html;
      
      // Verify script tags in email addresses are escaped when displayed in HTML
      expect(overlordEmail).not.toContain('"><script>alert(1)</script><a');
      expect(overlordEmail).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;a');
    });

    it('prevents attribute injection via quote escaping', async () => {
      const maliciousPetName = '" style="display:none" data-evil="true';
      
      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: 'Owner Name',
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: 'Reporter Name',
        petName: maliciousPetName,
        matchId: 'test-match-123',
        matchScore: 95,
      });

      const calls = mockSend.mock.calls;
      for (const call of calls) {
        const emailHtml = call[0].html;
        
        // Verify quotes are escaped to prevent attribute injection
        expect(emailHtml).not.toContain('" style="display:none"');
        expect(emailHtml).toContain('&quot; style=&quot;display:none&quot;');
      }
    });
  });

  describe('sendClaimReminderEmail - Temporal Workflow Path', () => {
    it('prevents HTML injection via pet_name in reminder emails', async () => {
      const maliciousPetName = '<script>alert("Reminder XSS")</script>';
      
      await sendClaimReminderEmail({
        email: 'user@test.com',
        displayName: 'Test User',
        petName: maliciousPetName,
        matchId: 'test-match-123',
      });

      expect(mockSend).toHaveBeenCalled();
      
      const lastCall = mockSend.mock.calls[mockSend.mock.calls.length - 1];
      const emailHtml = lastCall[0].html;
      const emailSubject = lastCall[0].subject;
      
      // Verify malicious HTML is escaped in body
      expect(emailHtml).not.toContain('<script>alert("Reminder XSS")</script>');
      expect(emailHtml).toContain('&lt;script&gt;alert(&quot;Reminder XSS&quot;)&lt;/script&gt;');
      
      // Verify malicious HTML is escaped in subject
      expect(emailSubject).not.toContain('<script>');
      expect(emailSubject).toContain('&lt;script&gt;');
    });

    it('prevents HTML injection via displayName in reminder emails', async () => {
      const maliciousDisplayName = '<img src=x onerror=alert("Name XSS")>';
      
      await sendClaimReminderEmail({
        email: 'user@test.com',
        displayName: maliciousDisplayName,
        petName: 'Fluffy',
        matchId: 'test-match-123',
      });

      const lastCall = mockSend.mock.calls[mockSend.mock.calls.length - 1];
      const emailHtml = lastCall[0].html;
      
      // Verify malicious HTML in display name is escaped
      expect(emailHtml).not.toContain('<img src=x onerror=alert("Name XSS")>');
      expect(emailHtml).toContain('&lt;img src=x onerror=alert(&quot;Name XSS&quot;)&gt;');
    });

    it('prevents combined injection attacks in reminder emails', async () => {
      await sendClaimReminderEmail({
        email: 'user@test.com',
        displayName: '</strong><script>alert(1)</script><strong>',
        petName: '<img src=x onerror=alert(2)>',
        matchId: 'test-match-123',
      });

      const lastCall = mockSend.mock.calls[mockSend.mock.calls.length - 1];
      const emailHtml = lastCall[0].html;
      
      // Verify no unescaped HTML tags exist
      const unescapedTagPattern = /<(script|img|iframe|object|embed|svg)[^>]*>/i;
      const matches = emailHtml.match(unescapedTagPattern);
      
      // Filter out legitimate HTML structure tags (div, p, strong, a, etc.)
      const dangerousTags = matches?.filter((tag: string) => 
        /<(script|img|iframe|object|embed|svg)/i.test(tag)
      );
      
      expect(dangerousTags).toBeUndefined();
    });
  });

  describe('Security Properties - Defense in Depth', () => {
    it('ensures all user-controlled fields are escaped before email rendering', async () => {
      // Test with all fields containing potential injection vectors
      await sendClaimEmails({
        overlordOwnerEmail: 'owner"><script>1</script>@test.com',
        overlordOwnerName: '<b>Owner</b>',
        agentReporterEmail: 'reporter"><script>2</script>@test.com',
        agentReporterName: '<i>Reporter</i>',
        petName: '<u>Pet</u>',
        matchId: 'test-match-123',
        matchScore: 95,
      });

      const calls = mockSend.mock.calls;
      const relevantCalls = calls.slice(-2); // Get last 2 calls for this test
      
      for (const call of relevantCalls) {
        const emailHtml = call[0].html;
        
        // Verify all angle brackets from user input are escaped
        const userContentPattern = /&lt;[biu]&gt;|&lt;script&gt;/g;
        const matches = emailHtml.match(userContentPattern);
        
        // Should find escaped versions of our injected tags
        expect(matches).toBeTruthy();
        expect(matches!.length).toBeGreaterThan(0);
        
        // Should NOT find unescaped versions
        expect(emailHtml).not.toContain('<b>Owner</b>');
        expect(emailHtml).not.toContain('<i>Reporter</i>');
        expect(emailHtml).not.toContain('<u>Pet</u>');
        expect(emailHtml).not.toContain('"><script>1</script>');
        expect(emailHtml).not.toContain('"><script>2</script>');
      }
    });

    it('validates that escapeHtml is idempotent', () => {
      const input = '<script>alert("test")</script>';
      const escaped1 = escapeHtml(input);
      const escaped2 = escapeHtml(escaped1);
      
      // Escaping twice should produce different results (double-escaping)
      // This confirms the function doesn't skip already-escaped content
      expect(escaped1).toBe('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;');
      expect(escaped2).toBe('&amp;lt;script&amp;gt;alert(&amp;quot;test&amp;quot;)&amp;lt;/script&amp;gt;');
      expect(escaped1).not.toBe(escaped2);
    });

    it('ensures no raw interpolation of user content in email templates', async () => {
      // Use a unique marker that should only appear escaped
      const marker = '<UNIQUE_TEST_MARKER_12345>';
      
      await sendClaimEmails({
        overlordOwnerEmail: 'owner@test.com',
        overlordOwnerName: marker,
        agentReporterEmail: 'reporter@test.com',
        agentReporterName: 'Reporter',
        petName: marker,
        matchId: 'test-match-123',
        matchScore: 95,
      });

      const calls = mockSend.mock.calls;
      const relevantCalls = calls.slice(-2); // Get last 2 calls for this test
      
      for (const call of relevantCalls) {
        const emailHtml = call[0].html;
        const emailSubject = call[0].subject;
        
        // The marker should NEVER appear unescaped
        expect(emailHtml).not.toContain(marker);
        expect(emailSubject).not.toContain(marker);
        
        // It should appear escaped
        expect(emailHtml).toContain('&lt;UNIQUE_TEST_MARKER_12345&gt;');
      }
    });
  });
});
