/**
 * Codes à usage unique (TOTP, RFC 6238) de la double authentification :
 * valeurs de référence de la RFC, fenêtre de tolérance, anti-rejeu, chiffrement du secret.
 */
import { describe, test, expect, beforeAll } from '@jest/globals';
import {
  base32Encoder, base32Decoder, codePourPas, verifierCode, adresseOtpauth, genererSecret,
  genererCodesSecours, normaliserCodeSecours, chiffrer, dechiffrer, PERIODE,
} from '../../src/utils/totp.js';

beforeAll(() => { process.env.JWT_SECRET ??= 'test-secret'; });

// Secret de l'annexe B de la RFC 6238 : « 12345678901234567890 » en ASCII
const SECRET_RFC = base32Encoder(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  test.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('à %i s, le code est %s', (secondes, attendu) => {
    expect(codePourPas(SECRET_RFC, Math.floor(secondes / PERIODE))).toBe(attendu);
  });

  test('base32 : aller-retour sans perte', () => {
    const octets = Buffer.from([0, 1, 2, 250, 255, 128, 7]);
    expect(base32Decoder(base32Encoder(octets))).toEqual(octets);
  });

  test('un code du pas actuel, d\'avant ou d\'après est accepté; plus loin, refusé', () => {
    const maintenant = 1111111111 * 1000;
    const pas = Math.floor(1111111111 / PERIODE);
    expect(verifierCode(SECRET_RFC, codePourPas(SECRET_RFC, pas), { maintenant })).toBe(pas);
    expect(verifierCode(SECRET_RFC, codePourPas(SECRET_RFC, pas - 1), { maintenant })).toBe(pas - 1);
    expect(verifierCode(SECRET_RFC, codePourPas(SECRET_RFC, pas + 1), { maintenant })).toBe(pas + 1);
    expect(verifierCode(SECRET_RFC, codePourPas(SECRET_RFC, pas + 3), { maintenant })).toBeNull();
  });

  test('un code déjà utilisé (pas <= dernierPas) est refusé', () => {
    const maintenant = 1111111111 * 1000;
    const pas = Math.floor(1111111111 / PERIODE);
    expect(verifierCode(SECRET_RFC, codePourPas(SECRET_RFC, pas), { maintenant, dernierPas: pas })).toBeNull();
  });

  test('un code mal formé est refusé', () => {
    for (const code of ['', '12345', '1234567', 'abcdef', null, 123456]) {
      expect(verifierCode(SECRET_RFC, code)).toBeNull();
    }
  });

  test('l\'adresse du code QR contient le secret et l\'émetteur', () => {
    const secret = genererSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    const adresse = adresseOtpauth(secret, 'PO-001');
    expect(adresse).toMatch(/^otpauth:\/\/totp\/CrimeTracker%3APO-001\?/);
    expect(adresse).toContain(`secret=${secret}`);
    expect(adresse).toContain('issuer=CrimeTracker');
  });

  test('10 codes de secours distincts, au format ABCD-EFGH', () => {
    const codes = genererCodesSecours();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    codes.forEach((c) => expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/));
    expect(normaliserCodeSecours('abcd-efgh')).toBe('ABCDEFGH');
  });

  test('le secret chiffré ne contient pas le secret, et se déchiffre', () => {
    const secret = genererSecret();
    const chiffre = chiffrer(secret);
    expect(chiffre).not.toContain(secret);
    expect(dechiffrer(chiffre)).toBe(secret);
    expect(chiffrer(secret)).not.toBe(chiffre); // IV aléatoire
  });

  test('un secret chiffré modifié est refusé (GCM)', () => {
    const chiffre = chiffrer(genererSecret());
    const [iv, tag, contenu] = chiffre.split('.');
    const abime = Buffer.from(contenu, 'base64');
    abime[0] ^= 1;
    expect(() => dechiffrer([iv, tag, abime.toString('base64')].join('.'))).toThrow();
  });
});
