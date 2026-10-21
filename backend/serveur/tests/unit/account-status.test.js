import { EventEmitter } from 'node:events';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const query = jest.fn();
const client = new EventEmitter();
client.query = jest.fn(async () => ({ rows: [] }));
client.release = jest.fn();

jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: {
    query,
    connect: jest.fn(async () => client),
  },
}));

const {
  getAccountAuthInfo, isAccountActive, publishAccountDeactivated, listenForAccountDeactivations,
} = await import('../../src/utils/account-status.js');

describe('statut des comptes dans PostgreSQL', () => {
  beforeEach(() => {
    query.mockReset();
    client.query.mockClear();
    client.release.mockClear();
  });

  test('vérifie le statut courant dans la base', async () => {
    query.mockResolvedValueOnce({ rows: [{ is_active: true }] });
    query.mockResolvedValueOnce({ rows: [{ is_active: false }] });
    query.mockResolvedValueOnce({ rows: [] });

    await expect(isAccountActive(7)).resolves.toBe(true);
    await expect(isAccountActive(8)).resolves.toBe(false);
    await expect(isAccountActive(9)).resolves.toBe(false);
    expect(query).toHaveBeenCalledWith('SELECT is_active FROM app_user WHERE id = $1', [7]);
  });

  test('charge les informations d’autorisation actuelles du compte', async () => {
    const account = {
      id: 7,
      badge_number: 'SUP-007',
      role: 'policier',
      grade: 'sergent',
      is_active: true,
    };
    query.mockResolvedValueOnce({ rows: [account] });

    await expect(getAccountAuthInfo(7)).resolves.toEqual(account);
    expect(query).toHaveBeenCalledWith(
      'SELECT id, badge_number, role, grade, is_active FROM app_user WHERE id = $1',
      [7]
    );
  });

  test('retourne null si le compte n’existe plus', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(getAccountAuthInfo(404)).resolves.toBeNull();
  });

  test('publie la désactivation sur le canal PostgreSQL', async () => {
    query.mockResolvedValue({ rows: [] });

    await publishAccountDeactivated(12);

    expect(query).toHaveBeenCalledWith('SELECT pg_notify($1, $2)', ['account_deactivated', '12']);
  });

  test('écoute le canal et réconcilie les comptes désactivés au démarrage', async () => {
    query.mockResolvedValue({ rows: [{ id: 7 }, { id: 8 }] });
    const onDeactivated = jest.fn();
    const stop = await listenForAccountDeactivations(onDeactivated);

    expect(client.query).toHaveBeenCalledWith('LISTEN account_deactivated');
    expect(onDeactivated.mock.calls).toEqual([[7], [8]]);

    client.emit('notification', { channel: 'account_deactivated', payload: '12' });
    expect(onDeactivated).toHaveBeenLastCalledWith(12);

    await stop();
    expect(client.query).toHaveBeenLastCalledWith('UNLISTEN account_deactivated');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
