import { pool } from '../config/db.js';

const CHANNEL = 'account_deactivated';
const USE_POSTGRES = !process.env.DATABASE_URL?.startsWith('sqlite:');

export async function getAccountAuthInfo(id) {
  const result = await pool.query(
    'SELECT id, badge_number, role, grade, is_active FROM app_user WHERE id = $1',
    [id]
  );
  const account = result.rows[0];
  if (!account) return null;
  return {
    ...account,
    is_active: account.is_active === true || account.is_active === 1,
  };
}

export async function isAccountActive(id) {
  const result = await pool.query('SELECT is_active FROM app_user WHERE id = $1', [id]);
  const isActive = result.rows[0]?.is_active;
  return isActive === true || isActive === 1;
}

export async function publishAccountDeactivated(id) {
  if (!USE_POSTGRES) return;
  await pool.query('SELECT pg_notify($1, $2)', [CHANNEL, String(id)]);
}

export async function listenForAccountDeactivations(onDeactivated) {
  if (!USE_POSTGRES) return () => {};

  let stopped = false;
  let client;
  let retryTimer;
  let retryDelay = 1000;

  const onNotification = (message) => {
    if (message.channel !== CHANNEL) return;
    const id = Number(message.payload);
    if (!Number.isSafeInteger(id) || id < 1) {
      console.error('Notification PostgreSQL de désactivation invalide:', message.payload);
      return;
    }
    onDeactivated(id);
  };

  const scheduleReconnect = (error) => {
    if (stopped || retryTimer) return;
    console.error('Connexion LISTEN PostgreSQL perdue; nouvelle tentative:', error);
    retryTimer = setTimeout(async () => {
      retryTimer = undefined;
      try {
        await connect();
      } catch (reconnectError) {
        scheduleReconnect(reconnectError);
      }
    }, retryDelay);
    retryTimer.unref();
    retryDelay = Math.min(retryDelay * 2, 30000);
  };

  const connect = async () => {
    const nextClient = await pool.connect();
    nextClient.on('notification', onNotification);
    nextClient.on('error', (error) => {
      if (client !== nextClient) return;
      client = undefined;
      nextClient.release(true);
      scheduleReconnect(error);
    });

    try {
      await nextClient.query(`LISTEN ${CHANNEL}`);
      client = nextClient;
      retryDelay = 1000;

      const result = await pool.query('SELECT id FROM app_user WHERE is_active = FALSE');
      for (const { id } of result.rows) onDeactivated(Number(id));
    } catch (error) {
      nextClient.removeListener('notification', onNotification);
      nextClient.release(true);
      throw error;
    }
  };

  await connect();

  return async () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (!client) return;
    const currentClient = client;
    client = undefined;
    currentClient.removeListener('notification', onNotification);
    await currentClient.query(`UNLISTEN ${CHANNEL}`);
    currentClient.release();
  };
}
