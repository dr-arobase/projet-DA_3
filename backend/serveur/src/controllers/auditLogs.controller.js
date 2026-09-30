import * as auditLogModel from '../models/auditLog.model.js';

// GET /api/audit-logs
export const getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      auditLogModel.findAll({ limit, offset }),
      auditLogModel.countAll()
    ]);

    return res.json({ page, limit, total, totalPages: Math.ceil(total / limit), data: logs });
  } catch (error) {
    console.error('Erreur lors de la récupération du journal d\'audit:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};