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
    ['espace de largeur nulle', '​'],
    ['plusieurs invisibles mélangés', '​‌‍⁠﻿'],
    ['marques de direction', '‎‏'],
    ['caractère braille vide', '⠀'],
    ['remplissage hangul', 'ㅤ'],
    ['espaces insécables', '  '],
  ])('invisible : %s', (_, valeur) => {
    expect(estVisible(valeur)).toBe(false);
  });

  test.each([
    ['du texte', 'Bonjour'],
    ['une emoji composée (famille, ZWJ)', '👨‍👩‍👧'],
    ['une emoji avec sélecteur de variante', '❤️'],
    ['un point', '.'],
  ])('visible : %s', (_, valeur) => {
    expect(estVisible(valeur)).toBe(true);
  });
});
