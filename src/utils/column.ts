/**
 * Column utility functions for Google Sheets
 */

/**
 * Convert 1-based column index to Excel-style column letter(s)
 * Examples: 1 -> A, 26 -> Z, 27 -> AA, 52 -> AZ, 703 -> AAA
 */
export function columnIndexToLetter(columnIndex: number): string {
  let letter = '';
  let n = columnIndex;

  while (n > 0) {
    const remainder = (n - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    n = Math.floor((n - 1) / 26);
  }

  return letter;
}
