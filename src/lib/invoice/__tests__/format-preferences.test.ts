// src/lib/invoice/__tests__/format-preferences.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InvoiceFormat } from '@/types/invoice';
import {
  saveFormatPreference,
  loadFormatPreference,
  clearFormatPreference,
  getDefaultFormat,
} from '../format-preferences';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Set up global localStorage and window mocks
global.localStorage = localStorageMock as any;
global.window = { localStorage: localStorageMock } as any;

describe('Format Preferences', () => {
  // Clear localStorage before and after each test
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('saveFormatPreference', () => {
    it('should save format to localStorage', () => {
      const result = saveFormatPreference(InvoiceFormat.HALF_PAGE);
      
      expect(result).toBe(true);
      expect(localStorage.getItem('invoice_format_preference')).toBe(InvoiceFormat.HALF_PAGE);
    });

    it('should save FULL_PAGE format', () => {
      const result = saveFormatPreference(InvoiceFormat.FULL_PAGE);
      
      expect(result).toBe(true);
      expect(localStorage.getItem('invoice_format_preference')).toBe(InvoiceFormat.FULL_PAGE);
    });

    it('should save QUARTER_PAGE format', () => {
      const result = saveFormatPreference(InvoiceFormat.QUARTER_PAGE);
      
      expect(result).toBe(true);
      expect(localStorage.getItem('invoice_format_preference')).toBe(InvoiceFormat.QUARTER_PAGE);
    });

    it('should overwrite existing preference', () => {
      saveFormatPreference(InvoiceFormat.FULL_PAGE);
      saveFormatPreference(InvoiceFormat.HALF_PAGE);
      
      expect(localStorage.getItem('invoice_format_preference')).toBe(InvoiceFormat.HALF_PAGE);
    });
  });

  describe('loadFormatPreference', () => {
    it('should return FULL_PAGE as default when no preference exists', () => {
      const format = loadFormatPreference();
      
      expect(format).toBe(InvoiceFormat.FULL_PAGE);
    });

    it('should load saved HALF_PAGE preference', () => {
      localStorage.setItem('invoice_format_preference', InvoiceFormat.HALF_PAGE);
      
      const format = loadFormatPreference();
      
      expect(format).toBe(InvoiceFormat.HALF_PAGE);
    });

    it('should load saved QUARTER_PAGE preference', () => {
      localStorage.setItem('invoice_format_preference', InvoiceFormat.QUARTER_PAGE);
      
      const format = loadFormatPreference();
      
      expect(format).toBe(InvoiceFormat.QUARTER_PAGE);
    });

    it('should load saved FULL_PAGE preference', () => {
      localStorage.setItem('invoice_format_preference', InvoiceFormat.FULL_PAGE);
      
      const format = loadFormatPreference();
      
      expect(format).toBe(InvoiceFormat.FULL_PAGE);
    });

    it('should return default for invalid saved format', () => {
      localStorage.setItem('invoice_format_preference', 'INVALID_FORMAT');
      
      const format = loadFormatPreference();
      
      expect(format).toBe(InvoiceFormat.FULL_PAGE);
    });

    it('should return default when localStorage throws error', () => {
      // Mock localStorage to throw error
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = () => {
        throw new Error('localStorage error');
      };
      
      const format = loadFormatPreference();
      
      expect(format).toBe(InvoiceFormat.FULL_PAGE);
      
      // Restore original
      localStorage.getItem = originalGetItem;
    });
  });

  describe('clearFormatPreference', () => {
    it('should remove preference from localStorage', () => {
      localStorage.setItem('invoice_format_preference', InvoiceFormat.HALF_PAGE);
      
      const result = clearFormatPreference();
      
      expect(result).toBe(true);
      expect(localStorage.getItem('invoice_format_preference')).toBeNull();
    });

    it('should return true even when no preference exists', () => {
      const result = clearFormatPreference();
      
      expect(result).toBe(true);
    });
  });

  describe('getDefaultFormat', () => {
    it('should return FULL_PAGE as default', () => {
      const format = getDefaultFormat();
      
      expect(format).toBe(InvoiceFormat.FULL_PAGE);
    });
  });

  describe('round-trip persistence', () => {
    it('should persist and retrieve FULL_PAGE format', () => {
      saveFormatPreference(InvoiceFormat.FULL_PAGE);
      const loaded = loadFormatPreference();
      
      expect(loaded).toBe(InvoiceFormat.FULL_PAGE);
    });

    it('should persist and retrieve HALF_PAGE format', () => {
      saveFormatPreference(InvoiceFormat.HALF_PAGE);
      const loaded = loadFormatPreference();
      
      expect(loaded).toBe(InvoiceFormat.HALF_PAGE);
    });

    it('should persist and retrieve QUARTER_PAGE format', () => {
      saveFormatPreference(InvoiceFormat.QUARTER_PAGE);
      const loaded = loadFormatPreference();
      
      expect(loaded).toBe(InvoiceFormat.QUARTER_PAGE);
    });
  });
});
