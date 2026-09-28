/** Ajoute une action sensible au journal d'audit, dans la transaction de `client`. */
export async function insert(client, { actorId, action, targetType, targetId, details }) {
  await client.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId, action, targetType, targetId, JSON.stringify(details ?? {})]
  );
}
