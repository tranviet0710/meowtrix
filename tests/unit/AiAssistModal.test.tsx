// @vitest-environment jsdom

// tests/unit/AiAssistModal.test.tsx — Behavior of the AI-assist modal.
//
// Covers task 22 subtasks for the modal:
//   • opens with focus on the privacy checkbox                    (Req 3.1, 13.4)
//   • ESC closes and restores focus to the opener button          (Req 13.4)
//   • "Analyze screenshot" is disabled without file + consent     (Req 3.2, 3.3)
//   • wrong MIME shows Requirement 2.4 copy verbatim              (Req 2.4)
//   • oversize shows Requirement 2.5 copy verbatim                (Req 2.5)
//   • `aria-live` announces "Reading your screenshot" on start    (Req 13.5)
//   • closing without confirm does NOT invoke the form ref        (Req 1.4, 1.6)
//   • "Apply to form" invokes onApply exactly once, with no
//     verification-shaped keys in the payload                     (Req 7.4, 8.3)
//
// _Requirements: 1.4, 1.6, 2.4, 2.5, 3.1, 3.2, 3.3, 7.4, 8.3, 11.2,
//                12.1, 13.4, 13.5_

import * as React from 'react';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';

import { AiAssistModal, type AiAssistApplyValues } from '@/components/reports/AiAssistModal';
import type { ExtractionResponse, PetRegion } from '@/types/ai';
import { MAX_IMAGE_SIZE_BYTES } from '@/lib/validators';

// --- Shims for jsdom --------------------------------------------------------
//
// jsdom does not implement `URL.createObjectURL` or `URL.revokeObjectURL`
// natively. `AiAssistUploadZone` calls both when a file is staged, so we
// stub them once for the whole test file.

beforeAll(() => {
  if (typeof URL.createObjectURL !== 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).createObjectURL = () => 'blob:mock';
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).revokeObjectURL = () => {};
  }
});

// --- Fixtures ---------------------------------------------------------------

const TINY_WEBP =
  'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

function makePng(name = 'shot.png', size = 1024): File {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type: 'image/png' });
}

function makeUnsupported(): File {
  return new File([new Uint8Array(64)], 'doc.pdf', { type: 'application/pdf' });
}

function makeOversizedPng(): File {
  // A File whose reported size exceeds the 5 MB guard. We don't allocate the
  // real bytes — the guard reads `file.size` which is set from the blob.
  const oversize = new File(
    [new Uint8Array(MAX_IMAGE_SIZE_BYTES + 1)],
    'huge.png',
    { type: 'image/png' }
  );
  return oversize;
}

function makeRegion(id: string): PetRegion {
  return {
    id,
    data_url: TINY_WEBP,
    mime_type: 'image/webp',
    width: 100,
    height: 100,
  };
}

function successBody(): Extract<ExtractionResponse, { status: 'ok' }> {
  return {
    status: 'ok',
    fields: {
      pet_name: 'Milo',
      pet_type: 'cat',
      description: 'Orange tabby, wearing a red collar.',
      last_seen_address_text: '123 Đường Láng, Hà Nội',
      last_seen_at: '2025-06-01',
      contact_phone: null,
      contact_name: null,
    },
    confidences: {
      pet_name: 'high',
      pet_type: 'high',
      description: 'medium',
      last_seen_address_text: 'medium',
      last_seen_at: 'low',
      contact_phone: null,
      contact_name: null,
    },
    regions: [makeRegion('crop-1')],
    full_screenshot: makeRegion('full'),
    geocode: {
      address_text: '123 Đường Láng, Hà Nội',
      lat: 21.02,
      lng: 105.83,
      reason: 'matched',
    },
    quota: { remaining: 4, resets_at: '2025-06-02T00:00:00.000Z' },
  };
}

// --- Fetch harness ----------------------------------------------------------
//
// The modal calls two endpoints:
//   • POST /api/ai/extract-report — returns the extraction result
//   • POST /api/upload            — returns `{ url }` for each attached crop
//
// Individual tests can override either behavior via the mock.

interface FetchState {
  extractResponse?: () => Response;
  uploadResponse?: () => Response;
  extractCalls: number;
  uploadCalls: number;
}

let fetchState: FetchState;

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function setupFetch(overrides: Partial<FetchState> = {}): void {
  fetchState = {
    extractResponse: () => jsonResponse(successBody()),
    uploadResponse: () => jsonResponse({ url: 'https://cdn.example/ai-crop.webp' }),
    extractCalls: 0,
    uploadCalls: 0,
    ...overrides,
  };

  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/ai/extract-report')) {
      fetchState.extractCalls++;
      return fetchState.extractResponse!();
    }
    if (url.includes('/api/upload')) {
      fetchState.uploadCalls++;
      return fetchState.uploadResponse!();
    }
    throw new Error(`Unexpected fetch to ${url}`);
  }) as unknown as typeof fetch;
}

const originalFetch = global.fetch;

beforeEach(() => {
  setupFetch();
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

// --- Helpers ---------------------------------------------------------------

/** The privacy-notice input. */
function privacyCheckbox(): HTMLInputElement {
  return screen.getByLabelText(/I understand and want to continue/i) as HTMLInputElement;
}

/** The hidden `<input type="file">` inside the upload zone. */
function fileInput(): HTMLInputElement {
  // Only one file input is rendered by AiAssistUploadZone.
  const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
  if (!input) throw new Error('file input not found');
  return input;
}

/** Simulate the user picking a file through the file picker. */
function pickFile(file: File): void {
  fireEvent.change(fileInput(), { target: { files: [file] } });
}

/** Simulate the user checking the privacy notice. */
function acceptPrivacy(): void {
  fireEvent.click(privacyCheckbox());
}

/** Find a button by its accessible name (label text). */
function button(name: RegExp | string): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

/**
 * Render the modal inside a host that mounts an opener button and preserves
 * `onApply`. Returns handles for the opener + spy so tests can assert on
 * focus restoration and payload contents.
 */
function renderWithOpener(initialOpen = true, onApply?: (v: AiAssistApplyValues) => void) {
  const applySpy = vi.fn(onApply);

  function Host() {
    const [open, setOpen] = React.useState(initialOpen);
    return (
      <>
        <button
          type="button"
          data-testid="opener"
          onClick={() => setOpen(true)}
        >
          Open modal
        </button>
        <AiAssistModal
          open={open}
          onClose={() => setOpen(false)}
          variant="lost"
          onApply={applySpy}
        />
      </>
    );
  }

  const utils = render(<Host />);
  const opener = utils.getByTestId('opener') as HTMLButtonElement;
  if (!initialOpen) {
    // Focus the opener so we can verify focus restoration later.
    opener.focus();
    fireEvent.click(opener);
  }
  return { ...utils, opener, applySpy };
}

// --- Tests ------------------------------------------------------------------

describe('AiAssistModal — focus behavior', () => {
  it('opens with focus on the privacy checkbox (Req 3.1, 13.4)', async () => {
    render(
      <AiAssistModal
        open
        onClose={() => {}}
        variant="lost"
        onApply={() => {}}
      />
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(privacyCheckbox());
    });
  });

  it('ESC closes the modal and restores focus to the opener button (Req 13.4)', async () => {
    const { opener } = renderWithOpener(false);

    // Modal should be open and focus should have moved into it.
    await waitFor(() => {
      expect(document.activeElement).toBe(privacyCheckbox());
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    // Modal is unmounted (open === false).
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    // Focus was returned to the opener.
    await waitFor(() => {
      expect(document.activeElement).toBe(opener);
    });
  });
});

describe('AiAssistModal — Analyze screenshot gating (Req 3.2, 3.3)', () => {
  it('is disabled with neither a file nor consent', () => {
    render(
      <AiAssistModal open onClose={() => {}} variant="lost" onApply={() => {}} />
    );

    expect(button(/Analyze screenshot/i).disabled).toBe(true);
  });

  it('is still disabled with a file but no privacy consent', () => {
    render(
      <AiAssistModal open onClose={() => {}} variant="lost" onApply={() => {}} />
    );

    pickFile(makePng());
    expect(button(/Analyze screenshot/i).disabled).toBe(true);
  });

  it('is still disabled with consent but no file', () => {
    render(
      <AiAssistModal open onClose={() => {}} variant="lost" onApply={() => {}} />
    );

    acceptPrivacy();
    expect(button(/Analyze screenshot/i).disabled).toBe(true);
  });

  it('becomes enabled once BOTH a file is staged and consent is checked', () => {
    render(
      <AiAssistModal open onClose={() => {}} variant="lost" onApply={() => {}} />
    );

    pickFile(makePng());
    acceptPrivacy();

    expect(button(/Analyze screenshot/i).disabled).toBe(false);
  });
});

describe('AiAssistModal — client-side upload guards (Req 2.4, 2.5)', () => {
  it('rejects unsupported MIME types with the Requirement 2.4 copy', () => {
    render(
      <AiAssistModal open onClose={() => {}} variant="lost" onApply={() => {}} />
    );

    pickFile(makeUnsupported());

    expect(
      screen.getByText('Only JPEG, PNG, or WebP images are supported')
    ).toBeTruthy();
    // File was NOT accepted — Analyze remains disabled even if consent is on.
    acceptPrivacy();
    expect(button(/Analyze screenshot/i).disabled).toBe(true);
  });

  it('rejects oversized files with the Requirement 2.5 copy', () => {
    render(
      <AiAssistModal open onClose={() => {}} variant="lost" onApply={() => {}} />
    );

    pickFile(makeOversizedPng());

    expect(screen.getByText('Screenshot must be 5MB or smaller')).toBeTruthy();
    acceptPrivacy();
    expect(button(/Analyze screenshot/i).disabled).toBe(true);
  });
});

describe('AiAssistModal — aria-live announcements (Req 13.5)', () => {
  it('announces "Reading your screenshot" once analyze() fires', async () => {
    // Hold the extract response open so we can observe the intermediate state.
    let resolveExtract: ((res: Response) => void) | null = null;
    setupFetch({
      extractResponse: () => {
        // Return a pending Response — vitest can await our custom promise.
        // We build a real Promise-like via a wrapper so the fetch mock resolves
        // only after we release it below.
        throw new Error('unused');
      },
    });

    // Replace fetch entirely with a controllable version.
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/ai/extract-report')) {
        return new Promise<Response>((resolve) => {
          resolveExtract = resolve;
        });
      }
      throw new Error(`Unexpected fetch to ${url}`);
    }) as unknown as typeof fetch;

    render(
      <AiAssistModal open onClose={() => {}} variant="lost" onApply={() => {}} />
    );

    pickFile(makePng());
    acceptPrivacy();
    fireEvent.click(button(/Analyze screenshot/i));

    // The polite live region reads "Reading your screenshot" while extracting.
    await waitFor(() => {
      const live = document.querySelector('[aria-live="polite"]');
      expect(live?.textContent).toMatch(/Reading your screenshot/i);
    });

    // Release the fetch so the test can clean up cleanly.
    await act(async () => {
      resolveExtract!(jsonResponse(successBody()));
    });
  });
});

describe('AiAssistModal — onApply is only invoked on explicit confirmation', () => {
  it('closing the modal via Cancel does NOT invoke onApply (Req 1.4)', async () => {
    const applySpy = vi.fn();
    function Host() {
      const [open, setOpen] = React.useState(true);
      return (
        <AiAssistModal
          open={open}
          onClose={() => setOpen(false)}
          variant="lost"
          onApply={applySpy}
        />
      );
    }
    render(<Host />);

    // Even after extraction succeeds — if the user cancels, no apply.
    pickFile(makePng());
    acceptPrivacy();
    fireEvent.click(button(/Analyze screenshot/i));

    // Wait for extraction to complete and the preview to render.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Apply to form/i })).toBeTruthy();
    });

    // Cancel out — this closes the modal without confirming.
    fireEvent.click(button(/Cancel/i));

    // Modal is dismissed; the form ref (onApply) must not have been called.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(applySpy).not.toHaveBeenCalled();
  });

  it('closing via ESC does NOT invoke onApply (Req 1.4)', async () => {
    const applySpy = vi.fn();
    function Host() {
      const [open, setOpen] = React.useState(true);
      return (
        <AiAssistModal
          open={open}
          onClose={() => setOpen(false)}
          variant="lost"
          onApply={applySpy}
        />
      );
    }
    render(<Host />);

    // Wait for focus to move to the checkbox so ESC is captured by the modal.
    await waitFor(() => {
      expect(document.activeElement).toBe(privacyCheckbox());
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(applySpy).not.toHaveBeenCalled();
  });
});

describe('AiAssistModal — Apply to form (Req 7.4, 8.3)', () => {
  it('invokes onApply exactly once and never with verification-shaped keys', async () => {
    const applySpy = vi.fn<(v: AiAssistApplyValues) => void>();

    function Host() {
      const [open, setOpen] = React.useState(true);
      return (
        <AiAssistModal
          open={open}
          onClose={() => setOpen(false)}
          variant="lost"
          onApply={applySpy}
        />
      );
    }
    render(<Host />);

    pickFile(makePng());
    acceptPrivacy();
    fireEvent.click(button(/Analyze screenshot/i));

    // Preview appears after extraction succeeds and the default crop
    // selection is applied.
    const applyButton = (await screen.findByRole('button', {
      name: /Apply to form/i,
    })) as HTMLButtonElement;

    // Apply should be enabled (1 crop selected by default, ≥1 field non-null).
    await waitFor(() => {
      expect(applyButton.disabled).toBe(false);
    });

    fireEvent.click(applyButton);

    // Wait for the modal to close after Apply finishes.
    await waitFor(() => {
      expect(applySpy).toHaveBeenCalledTimes(1);
    });

    // Exactly ONE call, no verification-shaped keys anywhere in the payload.
    const payload = applySpy.mock.calls[0][0];
    const keys = Object.keys(payload);
    for (const key of keys) {
      expect(key.toLowerCase()).not.toContain('verification');
    }
    // Explicit spot-check on the three forbidden keys from Requirement 8.
    expect('verification_name' in payload).toBe(false);
    expect('verification_marking' in payload).toBe(false);
    expect('verification_trait' in payload).toBe(false);

    // Sanity: the AI-derived values landed in the expected slots.
    expect(payload.pet_name).toBe('Milo');
    expect(payload.pet_type).toBe('cat');
    expect(payload.location).toEqual({ lat: 21.02, lng: 105.83 });
    expect(Array.isArray(payload.photos)).toBe(true);
    expect(payload.photos!.length).toBeGreaterThan(0);

    // The modal orchestrated one /api/upload call per selected crop.
    expect(fetchState.uploadCalls).toBeGreaterThan(0);
  });
});
