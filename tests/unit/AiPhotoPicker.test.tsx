// @vitest-environment jsdom

// tests/unit/AiPhotoPicker.test.tsx — Tests the photo-picker selection rules.
//
// Covers task 22 subtasks for the picker:
//   • "Apply to form" is disabled at 0 or > 5 selected (via
//     `isPhotoSelectionValid` — the same helper the modal uses to gate the
//     apply button).
//   • When zero AI crops are returned, the full-screenshot tile is the only
//     selectable option (Requirement 6.4).
//
// The tests run in a jsdom environment so the component can render.
//
// _Requirements: 6.3, 6.4_

import * as React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import {
  AiPhotoPicker,
  isPhotoSelectionValid,
} from '@/components/reports/AiPhotoPicker';
import type { PetRegion } from '@/types/ai';

afterEach(() => {
  cleanup();
});

// --- Fixtures ---------------------------------------------------------------

const TINY_WEBP_DATA_URL =
  'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

function makeRegion(id: string): PetRegion {
  return {
    id,
    data_url: TINY_WEBP_DATA_URL,
    mime_type: 'image/webp',
    width: 100,
    height: 100,
  };
}

const FULL_SCREENSHOT: PetRegion = makeRegion('full');

// --- isPhotoSelectionValid helper -------------------------------------------

describe('isPhotoSelectionValid', () => {
  it('is false for zero selections (disables Apply to form)', () => {
    expect(isPhotoSelectionValid([])).toBe(false);
  });

  it('is true for a single selection', () => {
    expect(isPhotoSelectionValid(['a'])).toBe(true);
  });

  it('is true at the max of 5', () => {
    expect(isPhotoSelectionValid(['a', 'b', 'c', 'd', 'e'])).toBe(true);
  });

  it('is false above 5 (would disable Apply to form)', () => {
    expect(isPhotoSelectionValid(['a', 'b', 'c', 'd', 'e', 'f'])).toBe(false);
  });
});

// --- Component rendering ----------------------------------------------------

describe('AiPhotoPicker', () => {
  it('shows only the full-screenshot tile when zero AI crops are returned', () => {
    render(
      <AiPhotoPicker
        regions={[]}
        fullScreenshot={FULL_SCREENSHOT}
        selectedIds={[]}
        onChange={vi.fn()}
      />
    );

    const tiles = screen.getAllByRole('button');
    expect(tiles).toHaveLength(1);
    // The overlay label reads "Full screenshot" — verify it's present.
    expect(screen.getByText('Full screenshot')).toBeTruthy();
  });

  it('renders one tile per crop plus a Full screenshot tile', () => {
    const regions = [
      makeRegion('crop-1'),
      makeRegion('crop-2'),
      makeRegion('crop-3'),
    ];
    render(
      <AiPhotoPicker
        regions={regions}
        fullScreenshot={FULL_SCREENSHOT}
        selectedIds={[]}
        onChange={vi.fn()}
      />
    );

    const tiles = screen.getAllByRole('button');
    // 3 AI crops + 1 full screenshot
    expect(tiles).toHaveLength(4);
    expect(screen.getByText('AI crop 1')).toBeTruthy();
    expect(screen.getByText('AI crop 2')).toBeTruthy();
    expect(screen.getByText('AI crop 3')).toBeTruthy();
    expect(screen.getByText('Full screenshot')).toBeTruthy();
  });

  it('reports aria-pressed=false on unselected tiles and true on selected', () => {
    const regions = [makeRegion('crop-1'), makeRegion('crop-2')];
    render(
      <AiPhotoPicker
        regions={regions}
        fullScreenshot={FULL_SCREENSHOT}
        selectedIds={['crop-1']}
        onChange={vi.fn()}
      />
    );

    const tiles = screen.getAllByRole('button');
    // The tile whose label references crop-1 should be pressed.
    const pressedTiles = tiles.filter(
      (t) => t.getAttribute('aria-pressed') === 'true'
    );
    expect(pressedTiles).toHaveLength(1);
    expect(pressedTiles[0].getAttribute('aria-label')).toContain('AI crop 1');
  });

  it('does not add a 6th selection when already at the max of 5 (silently caps)', () => {
    // 5 AI crops all selected — clicking the "Full screenshot" tile must not
    // push the selection to 6. `AiPhotoPicker` enforces this in `toggle`.
    const regions = [
      makeRegion('c1'),
      makeRegion('c2'),
      makeRegion('c3'),
      makeRegion('c4'),
      makeRegion('c5'),
    ];
    const selected = ['c1', 'c2', 'c3', 'c4', 'c5'];
    const onChange = vi.fn();

    render(
      <AiPhotoPicker
        regions={regions}
        fullScreenshot={FULL_SCREENSHOT}
        selectedIds={selected}
        onChange={onChange}
      />
    );

    // Locate the full-screenshot tile by its aria-label.
    const fullTile = screen
      .getAllByRole('button')
      .find((t) =>
        (t.getAttribute('aria-label') ?? '').includes('Full screenshot')
      );
    expect(fullTile).toBeTruthy();

    fireEvent.click(fullTile!);

    // The picker must not have called onChange, because the 6th selection is
    // silently ignored. isPhotoSelectionValid([...6 items]) would be false.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('deselects an already-selected tile', () => {
    const regions = [makeRegion('crop-1'), makeRegion('crop-2')];
    const onChange = vi.fn();

    render(
      <AiPhotoPicker
        regions={regions}
        fullScreenshot={FULL_SCREENSHOT}
        selectedIds={['crop-1']}
        onChange={onChange}
      />
    );

    const pressed = screen
      .getAllByRole('button')
      .find((t) => t.getAttribute('aria-pressed') === 'true');
    expect(pressed).toBeTruthy();

    fireEvent.click(pressed!);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
