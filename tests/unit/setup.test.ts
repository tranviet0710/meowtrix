import { describe, it, expect } from 'vitest';

describe('Test framework setup', () => {
  it('should run a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should support TypeScript', () => {
    const greeting: string = 'MEOWTRIX';
    expect(greeting).toBe('MEOWTRIX');
  });
});
