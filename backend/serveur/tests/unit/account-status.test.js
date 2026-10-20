import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const query = jest.fn();
jest.unstable_mockModule('../../src/config/db.js', () => ({
  pool: { query },
}));

const { isAccountActive, loadInactiveAccounts } = await import('../../src/utils/account-status.js');

describe('statut des comptes en mémoire', () => {
  beforeEach(() => {
    query.mockReset();
  });

  test('charge les comptes désactivés depuis la base au démarrage', async () => {
    query.mockResolvedValue({ rows: [{ id: 7 }, { id: 12 }] });

    await loadInactiveAccounts();

    expect(query).toHaveBeenCalledWith('SELECT id FROM app_user WHERE is_active = FALSE');
    expect(isAccountActive(7)).toBe(false);
    expect(isAccountActive(12)).toBe(false);
    expect(isAccountActive(3)).toBe(true);
  });

  test('remplace l’ancien état en rechargeant la liste', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 7 }] });
    await loadInactiveAccounts();

    query.mockResolvedValueOnce({ rows: [] });
    await loadInactiveAccounts();

    expect(isAccountActive(7)).toBe(true);
  });
});
