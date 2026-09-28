/** Journalisation serveur horodatée (sortie standard du conteneur). */
export const logger = {
  info: (...args) => console.log(new Date().toISOString(), 'INFO', ...args),
  error: (...args) => console.error(new Date().toISOString(), 'ERROR', ...args),
};
