// @vitest-environment jsdom

// tests/unit/useAiExtraction.test.ts — State-machine coverage for the
// client-side extraction hook.
//
// Covers the transitions documented in
// `.kiro/specs/create-report-with-ai/design.md` (Client State Machine):
//
//   idle → uploaded → extracting → previewing → applying → idle
//                          │
//                          └── error ◄── extraction failure / network / rate-limit
//                                 │
//                                 └── retry() → uploaded (or idle if file was cleared)
//
// Plus Requirement 11.2 / 12.4:
//   • `rate_limited` transitions to `error` with `retryable: false`.
//   • Every other error path is `retryable: true`.
//   • Network errors surface the exact copy from Requirement 12.4.
//
// _Requirements: 4.6, 4.7, 4.8, 4.9, 11.2, 12.1, 12.2, 12.3, 12.4_

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useAiExtraction } from '@/hooks/useAiExtraction';
import type { ExtractionResponse } from '@/types/ai';

// --- Test helpers -----------------------------------------------------------

function makeFile(name = 'shot.png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
}

/** Build a minimal ExtractionSuccess body for the happy path. */
function successBody(): ExtractionResponse {
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
    regions: [],
    full_screenshot: {
      id: 'full',
      data_url: 'data:image/webp;base64,AAA',
      mime_type: 'image/webp',
      width: 400,
      height: 300,
    },
    geocode: {
      address_text: '123 Đường Láng, Hà Nội',
      lat: 21.02,
      lng: 105.83,
      reason: 'matched',
    },
    quota: { remaining: 4, resets_at: '2025-06-02T00:00:00.000Z' },
  };
}

/** Build a Response-like object with a JSON body. */
function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as unknown as Response;
}

const originalFetch = global.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

// --- Transitions ------------------------------------------------------------

describe('useAiExtraction — state machine transitions', () => {
  it('starts in the idle state with no file, result, or error', () => {
    const { result } = renderHook(() => useAiExtraction({ variant: 'lost' }));

    expect(result.current.state).toBe('idle');
    expect(result.current.file).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('idle → uploaded when a file is staged', () => {
    const { result } = renderHook(() => useAiExtraction({ variant: 'lost' }));
    const file = makeFile();

    act(() => {
      result.current.actions.setFile(file);
    });

    expect(result.current.state).toBe('uploaded');
    expect(result.current.file).toBe(file);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('uploaded → idle when the file is cleared (setFile(null))', () => {
    const { result } = renderHook(() => useAiExtraction({ variant: 'lost' }));

    act(() => {
      result.current.actions.setFile(makeFile());
    });
    expect(result.current.state).toBe('uploaded');

    act(() => {
      result.current.actions.setFile(null);
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.file).toBeNull();
  });

  it('uploaded → extracting → previewing on a successful analyze()', async () => {
    const body = successBody();
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(body));

    const { result } = renderHook(() => useAiExtraction({ variant: 'spotted' }));

    act(() => {
      result.current.actions.setFile(makeFile());
    });

    await act(async () => {
      await result.current.actions.analyze();
    });

    expect(result.current.state).toBe('previewing');
    expect(result.current.result).toEqual(body);
    expect(result.current.error).toBeNull();

    // The fetch was posted to the correct endpoint with the right variant.
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai/extract-report');
    expect((init as RequestInit).method).toBe('POST');
    // The FormData should carry the variant we asked for.
    const form = (init as RequestInit).body as FormData;
    expect(form.get('variant')).toBe('spotted');
  });

  it('previewing → applying when apply() is called', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(successBody()));

    const { result } = renderHook(() => useAiExtraction({ variant: 'lost' }));

    act(() => {
      result.current.actions.setFile(makeFile());
    });
    await act(async () => {
      await result.current.actions.analyze();
    });

    act(() => {
      result.current.actions.apply();
    });

    expect(result.current.state).toBe('applying');
  });

  it('apply() is a no-op unless the state is previewing', () => {
    const { result } = renderHook(() => useAiExtraction({ variant: 'lost' }));

    // From `idle`, apply must not transition anywhere.
    act(() => {
      result.current.actions.apply();
    });
    expect(result.current.state).toBe('idle');

    // From `uploaded`, still a no-op.
    act(() => {
      result.current.actions.setFile(makeFile());
    });
    act(() => {
      result.current.actions.apply();
    });
    expect(result.current.state).toBe('uploaded');
  });

  it('analyze() is a no-op when no file is staged', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successBody()));
    global.fetch = fetchMock;

    const { result } = renderHook(() => useAiExtraction({ variant: 'lost' }));
    await act(async () => {
      await result.current.actions.analyze();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.state).toBe('idle');
  });

  it('reset() returns the machine to idle with no file/result/error', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(successBody()));
    const { result } = renderHook(() => useAiExtraction({ variant: 'lost' }));

    act(() => {
      result.current.actions.setFile(makeFile());
    });
    await act(async () => {
      await result.current.actions.analyze();
    });
    expect(result.current.state).toBe('previewing');

    act(() => {
      result.current.actions.reset();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.file).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

// --- Error transitions ------------------------------------------------------

describe('useAiExtraction — error handling', () => {
  it('rate_limited transitions to error with retryable: false (Requirement 11.2)', async () => {
    const rateLimited: ExtractionResponse = {
      status: 'rate_limited',
      message:
        "You've reached today's AI limit. Please try again tomorrow or fill the form manually.",
    };
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(rateLimited, false));

    const { result } = renderHook(() => useAiExtraction({ variant: 'lost' }));
    act(() => {
      result.current.actions.setFile(makeFile());
    });
    await act(async () => {
      await result.current.actions.analyze();
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.retryable).toBe(false);
    expect(result.current.error?.message).toContain("today's AI limit");
  });

  it('extraction_error transitions to error with retryable: true', async () => {
    const body: ExtractionResponse = {
      status: 'extraction_error',
      message:
        "We couldn't read this screenshot. You can still fill the form manually.",
    };
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(body, false));

    const { result } = renderHook(() => useAiExtraction({ variant: 'lost' }));
    act(() => {
      result.current.actions.setFile(makeFile());
    });
    await act(async () => {
      await result.current.actions.analyze();
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error?.retryable).toBe(true);
  });

  it('invalid_input transitions to error with retryable: true', async () => {
    const body: ExtractionResponse = {
      status: 'invalid_input',
      message: 'Only JPEG, PNG, or WebP images are supported',
    };
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(body, false));

    const { result } = renderHook(() => useAiExtraction({ variant: 'lost' }));
    act(() => {
      result.current.actions.setFile(makeFile());
    });
    await act(async () => {
      await result.current.actions.analyze();
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error?.retryable).toBe(true);
  });

  it('network error transitions to error with retryable: true and Req 12.4 copy', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('offline'));

    const { result } = renderHook(() => useAiExtraction({ variant: 'lost' }));
    act(() => {
      result.current.actions.setFile(makeFile());
    });
    await act(async () => {
      await result.current.actions.analyze();
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error?.retryable).toBe(true);
    expect(result.current.error?.message).toBe(
      'Network error. Try again in a moment.'
    );
  });

  it('retry() clears the error and returns to uploaded when a file is still staged', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('offline'));

    const { result } = renderHook(() => useAiExtraction({ variant: 'lost' }));
    act(() => {
      result.current.actions.setFile(makeFile());
    });
    await act(async () => {
      await result.current.actions.analyze();
    });
    expect(result.current.state).toBe('error');

    act(() => {
      result.current.actions.retry();
    });

    expect(result.current.state).toBe('uploaded');
    expect(result.current.error).toBeNull();
  });

  it('retry() falls back to idle when there is no file staged', () => {
    const { result } = renderHook(() => useAiExtraction({ variant: 'lost' }));

    act(() => {
      result.current.actions.retry();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('shows the extracting state while the request is in flight (Req 12.1)', async () => {
    let resolveFetch: ((v: Response) => void) | null = null;
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const { result } = renderHook(() => useAiExtraction({ variant: 'lost' }));
    act(() => {
      result.current.actions.setFile(makeFile());
    });

    // Kick off analyze but do not await — we want to observe the intermediate
    // extracting state.
    let analyzePromise: Promise<void>;
    act(() => {
      analyzePromise = result.current.actions.analyze();
    });

    // The hook should have transitioned to extracting synchronously.
    await waitFor(() => {
      expect(result.current.state).toBe('extracting');
    });

    // Resolve the fetch to the success body and confirm we land in previewing.
    await act(async () => {
      resolveFetch!(jsonResponse(successBody()));
      await analyzePromise!;
    });

    expect(result.current.state).toBe('previewing');
  });
});
