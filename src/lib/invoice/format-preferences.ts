// src/lib/invoice/format-preferences.ts

import { InvoiceFormat } from '@/types/invoice';

/**
 * Local storage key for invoice format preferences
 */
const INVOICE_FORMAT_PREFERENCE_KEY = 'invoice_format_preference';

/**
 * Default invoice format when no preference is saved
 */
const DEFAULT_FORMAT = InvoiceFormat.FULL_PAGE;

/**
 * Save the selected invoice format to localStorage
 * 
 * @param format - The invoice format to save
 * @returns True if save was successful, false otherwise
 */
export function saveFormatPreference(format: InvoiceFormat): boolean {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      // Server-side rendering - cannot access localStorage
      return false;
    }
    
    localStorage.setItem(INVOICE_FORMAT_PREFERENCE_KEY, format);
    return true;
  } catch (error) {
    console.error('Failed to save invoice format preference:', error);
    return false;
  }
}

/**
 * Load the saved invoice format preference from localStorage
 * 
 * @returns The saved format, or FULL_PAGE as default if no preference exists
 */
export function loadFormatPreference(): InvoiceFormat {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      // Server-side rendering - return default
      return DEFAULT_FORMAT;
    }
    
    const savedFormat = localStorage.getItem(INVOICE_FORMAT_PREFERENCE_KEY);
    
    if (!savedFormat) {
      // No preference saved, return default
      return DEFAULT_FORMAT;
    }
    
    // Validate that the saved value is a valid format
    if (Object.values(InvoiceFormat).includes(savedFormat as InvoiceFormat)) {
      return savedFormat as InvoiceFormat;
    }
    
    // Invalid format saved, return default
    console.warn('Invalid invoice format in localStorage:', savedFormat);
    return DEFAULT_FORMAT;
  } catch (error) {
    console.error('Failed to load invoice format preference:', error);
    return DEFAULT_FORMAT;
  }
}

/**
 * Clear the saved invoice format preference
 * 
 * @returns True if clear was successful, false otherwise
 */
export function clearFormatPreference(): boolean {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }
    
    localStorage.removeItem(INVOICE_FORMAT_PREFERENCE_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear invoice format preference:', error);
    return false;
  }
}

/**
 * Get the default invoice format
 * 
 * @returns The default invoice format (FULL_PAGE)
 */
export function getDefaultFormat(): InvoiceFormat {
  return DEFAULT_FORMAT;
}
