import { body, param, query, validationResult } from 'express-validator';

const roles = ['policier', 'superviseur', 'direction'];
const grades = [
	'sergent_autres_fonctions',
	'sergent_gestionnaire',
	'sergent_responsable_de_poste',
	'lieutenant',
	'capitaine',
	'inspecteur',
	'inspecteur_chef',
	'directeur_general_adjoint',
	'directeur_general'
];

const gradesByRole = {
	policier: ['sergent_autres_fonctions'],
	superviseur: grades.slice(1, 7),
	direction: grades.slice(7)
};

const roleGradeRule = (useDefaults = false) =>
	body().custom((_, { req }) => {
		const role = req.body.role ?? (useDefaults ? 'policier' : undefined);
		const grade = req.body.grade ?? (useDefaults ? 'sergent_autres_fonctions' : undefined);

		if (role === undefined || grade === undefined) return true;
		if (!gradesByRole[role]?.includes(grade)) {
			throw new Error('Le grade fourni ne correspond pas au rôle');
		}
		return true;
	});

export const validateCreateUser = [
	body('first_name')
		.isString().withMessage('Le prénom doit être une chaîne de caractères').bail()
		.trim().notEmpty().withMessage('Le prénom est obligatoire').bail()
		.isLength({ max: 100 }).withMessage('Le prénom ne doit pas dépasser 100 caractères'),
	body('last_name')
		.isString().withMessage('Le nom doit être une chaîne de caractères').bail()
		.trim().notEmpty().withMessage('Le nom est obligatoire').bail()
		.isLength({ max: 100 }).withMessage('Le nom ne doit pas dépasser 100 caractères'),
	body('badge_number')
		.isString().withMessage('Le matricule doit être une chaîne de caractères').bail()
		.trim().notEmpty().withMessage('Le matricule est obligatoire').bail()
		.isLength({ max: 20 }).withMessage('Le matricule ne doit pas dépasser 20 caractères'),
	body('email')
		.isString().withMessage('Le courriel doit être une chaîne de caractères').bail()
		.trim().notEmpty().withMessage('Le courriel est obligatoire').bail()
		.isEmail().withMessage('Le courriel doit être valide').bail()
		.isLength({ max: 255 }).withMessage('Le courriel ne doit pas dépasser 255 caractères')
		.normalizeEmail(),
	body('password')
		.isString().withMessage('Le mot de passe doit être une chaîne de caractères').bail()
		.isLength({ min: 8, max: 72 }).withMessage('Le mot de passe doit contenir entre 8 et 72 caractères'),
	body('role')
		.optional()
		.equals('policier').withMessage('La création de compte est réservée au rôle policier'),
	body('grade')
		.optional()
		.isIn(grades).withMessage('Le grade fourni n’est pas reconnu'),
	body('is_active')
		.optional()
		.isBoolean().withMessage('Le statut is_active doit être un booléen')
		.toBoolean(),
	roleGradeRule(true)
];

export const validateUpdateUser = [
	body('first_name').optional().isString().withMessage('Le prénom doit être une chaîne de caractères').bail()
		.trim().notEmpty().withMessage('Le prénom ne peut pas être vide').bail()
		.isLength({ max: 100 }).withMessage('Le prénom ne doit pas dépasser 100 caractères'),
	body('last_name').optional().isString().withMessage('Le nom doit être une chaîne de caractères').bail()
		.trim().notEmpty().withMessage('Le nom ne peut pas être vide').bail()
		.isLength({ max: 100 }).withMessage('Le nom ne doit pas dépasser 100 caractères'),
	body('badge_number').optional().isString().withMessage('Le matricule doit être une chaîne de caractères').bail()
		.trim().notEmpty().withMessage('Le matricule ne peut pas être vide').bail()
		.isLength({ max: 20 }).withMessage('Le matricule ne doit pas dépasser 20 caractères'),
	body('email').optional().isString().withMessage('Le courriel doit être une chaîne de caractères').bail()
		.trim().notEmpty().withMessage('Le courriel ne peut pas être vide').bail()
		.isEmail().withMessage('Le courriel doit être valide').bail()
		.isLength({ max: 255 }).withMessage('Le courriel ne doit pas dépasser 255 caractères')
		.normalizeEmail(),
	body('password').optional().isString().withMessage('Le mot de passe doit être une chaîne de caractères').bail()
		.isLength({ min: 8, max: 72 }).withMessage('Le mot de passe doit contenir entre 8 et 72 caractères'),
	body('role').optional().isIn(roles).withMessage('Le rôle fourni n’est pas reconnu'),
	body('grade').optional().isIn(grades).withMessage('Le grade fourni n’est pas reconnu'),
	body('is_active').optional().isBoolean().withMessage('Le statut is_active doit être un booléen').toBoolean(),
	roleGradeRule()
];

export const validateLogin = [
	body('badge_number')
		.isString().withMessage('Le matricule doit être une chaîne de caractères').bail()
		.trim().notEmpty().withMessage('Le matricule est obligatoire').bail()
		.isLength({ max: 20 }).withMessage('Le matricule ne doit pas dépasser 20 caractères'),
	body('password')
		.isString().withMessage('Le mot de passe doit être une chaîne de caractères').bail()
		.notEmpty().withMessage('Le mot de passe est obligatoire')
];

export const validateUserId = [
	param('id').isInt({ min: 1 }).withMessage('L’identifiant utilisateur doit être un entier positif').toInt()
];

export const validateUserStatus = [
	body('is_active')
		.exists().withMessage('Le statut is_active est obligatoire').bail()
		.isBoolean().withMessage('Le statut is_active doit être un booléen')
		.toBoolean()
];

export const validateUserPromotion = [
	body('grade').isIn(gradesByRole.superviseur)
		.withMessage('Le grade de promotion doit être un grade de superviseur'),
	body('role').optional().equals('superviseur')
		.withMessage('Le rôle après promotion doit être superviseur')
];

export const validateUserListQuery = [
	query('role').optional().isIn(roles).withMessage('Le rôle fourni n’est pas reconnu'),
	query('is_active').optional().isBoolean().withMessage('Le statut is_active doit être un booléen').toBoolean()
];

export const validateRequest = (req, res, next) => {
	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		return res.status(400).json({
			message: 'Les informations fournies sont invalides',
			errors: errors.array().map(({ location, path, msg }) => ({
				location,
				field: path,
				message: msg
			}))
		});
	}

	return next();
};