/**
 * #94 : texte visible. trim() ne retire pas les caractères invisibles (U+200B…),
 * mais les emojis composées doivent rester acceptées.
 */
import { describe, test, expect } from '@jest/globals';
import { texte, estVisible } from '../../src/utils/texte.js';

describe('utils/texte', () => {
  test('texte() nettoie les bouts et refuse ce qui n\'est pas du texte', () => {
    expect(texte('  Montréal ')).toBe('Montréal');
    expect(texte({ rue: 'Berri' })).toBe('');
    expect(texte(['a'])).toBe('');
    expect(texte(undefined)).toBe('');
  });

  test.each([
    ['espace de largeur nulle', '\u200B'],
    ['plusieurs invisibles mélangés', '\u200B\u200C\u200D\u2060\uFEFF'],
    ['marques de direction', '\u200E\u200F'],
    ['caractère braille vide', '\u2800'],
    ['remplissage hangul', '\u3164'],
    ['espaces insécables', '\u00A0\u202F'],
  ])('invisible : %s', (_, valeur) => {
    expect(estVisible(valeur)).toBe(false);
  });

  test.each([
    ['du texte', 'Bonjour'],
    ['une emoji composée (famille, ZWJ)', '👨\u200D👩\u200D👧'],
    ['une emoji avec sélecteur de variante', '❤\uFE0F'],
    ['un point', '.'],
  ])('visible : %s', (_, valeur) => {
    expect(estVisible(valeur)).toBe(true);
  });
});
