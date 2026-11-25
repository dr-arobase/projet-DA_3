// Réseau des appels : savoir s'il y a un relais, et dire pourquoi un appel ne passe pas.
import { describe, expect, test } from 'vitest';
import {
  DEBITS, SERVEURS_ICE_SECOURS, aUnRelais, contraintesVideo, delaiConnexion, messageEchec, profilReseau, reglerDebits,
} from '../reseauAppel.js';

const STUN = { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] };

describe('réseau des appels', () => {
  test('les serveurs de secours sont deux STUN, sans relais', () => {
    expect(SERVEURS_ICE_SECOURS[0].urls).toHaveLength(2);
    expect(aUnRelais(SERVEURS_ICE_SECOURS)).toBe(false);
  });

  test('un relais TURN est reconnu, en liste ou seul, en turn: ou turns:', () => {
    expect(aUnRelais([STUN, { urls: ['turn:relais.exemple:3478'], username: 'a', credential: 'b' }])).toBe(true);
    expect(aUnRelais([{ urls: 'turns:relais.exemple:443?transport=tcp' }])).toBe(true);
    expect(aUnRelais(null)).toBe(false);
  });

  test('sans relais, le message dit que le serveur n\'a pas de relais et propose le même Wi-Fi', () => {
    expect(messageEchec([STUN])).toMatch(/relais des appels n'est pas encore en place/);
    expect(messageEchec([STUN])).toMatch(/même Wi-Fi/);
  });

  test('avec relais, le message renvoie à la connexion Internet des deux appareils', () => {
    expect(messageEchec([STUN, { urls: 'turn:x:3478' }])).toMatch(/même par le relais/);
  });
});

describe('n\'importe quel réseau : lent ou rapide', () => {
  test('3G, 2G, économie de données ou moins de 1,5 Mb/s : réseau lent', () => {
    expect(profilReseau({ effectiveType: '3g' })).toBe('lent');
    expect(profilReseau({ effectiveType: 'slow-2g' })).toBe('lent');
    expect(profilReseau({ effectiveType: '4g', saveData: true })).toBe('lent');
    expect(profilReseau({ effectiveType: '4g', downlink: 0.8 })).toBe('lent');
  });

  test('4G, 5G, bon Wi-Fi, ou navigateur qui ne dit rien (Safari) : réseau normal', () => {
    expect(profilReseau({ effectiveType: '4g', downlink: 10 })).toBe('normal');
    expect(profilReseau(undefined)).toBe('normal');
  });

  test('réseau lent : plus de temps pour se relier, vidéo plus petite et moins d\'images', () => {
    expect(delaiConnexion('lent')).toBeGreaterThan(delaiConnexion('normal'));
    expect(contraintesVideo('user', 'lent').width.ideal).toBeLessThan(contraintesVideo('user', 'normal').width.ideal);
    expect(contraintesVideo('environment', 'lent').facingMode).toBe('environment');
  });

  test('le son passe en priorité, la vidéo est plafonnée selon le réseau', async () => {
    const envoi = (kind) => {
      let params = { encodings: [{}] };
      return {
        track: { kind },
        getParameters: () => params,
        setParameters: async (p) => { params = p; },
        lire: () => params,
      };
    };
    const son = envoi('audio');
    const image = envoi('video');
    await reglerDebits({ getSenders: () => [son, image] }, 'lent');

    expect(son.lire().encodings[0]).toMatchObject({ maxBitrate: DEBITS.lent.audio, priority: 'high' });
    expect(image.lire().encodings[0]).toMatchObject({ maxBitrate: DEBITS.lent.video, maxFramerate: 15 });
    expect(image.lire().degradationPreference).toBe('balanced');
  });

  test('un navigateur qui refuse un réglage ne casse pas l\'appel', async () => {
    const refuse = { track: { kind: 'video' }, getParameters: () => ({}), setParameters: async () => { throw new Error('non'); } };
    await expect(reglerDebits({ getSenders: () => [refuse, { track: null }] })).resolves.toBeUndefined();
  });
});
