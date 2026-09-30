import * as criminalModel from '../models/criminal.model.js';

export const getAllCriminals = async () => {
  return await criminalModel.findAll();
};

export const getCriminalById = async (id) => {
  const criminal = await criminalModel.findById(id);
  if (!criminal) {
    const error = new Error('Dossier non trouvé');
    error.statusCode = 404;
    throw error;
  }
  return criminal;
};

export const createCriminal = async (data, userId) => {
  return await criminalModel.create({
    ...data,
    added_by: userId
  });
};

export const updateCriminal = async (id, data) => {
  const updated = await criminalModel.update(id, data);
  if (!updated) {
    const error = new Error('Dossier non trouvé');
    error.statusCode = 404;
    throw error;
  }
  return updated;
};

export const updateCriminalStatus = async (id, status) => {
  const updated = await criminalModel.updateStatus(id, status);
  if (!updated) {
    const error = new Error('Dossier non trouvé');
    error.statusCode = 404;
    throw error;
  }
  return updated;
};