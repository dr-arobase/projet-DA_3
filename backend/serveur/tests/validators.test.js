import {
  parsePositiveInt,
  validateCriminal,
  validateListQuery,
  validateLogin,
  validateStatusChange,
} from '../src/utils/validators.js';

describe('parsePositiveInt', () => {
  test.each([['1', 1], ['42', 42], [7, 7]])('%p → %p', (input, expected) => {
    expect(parsePositiveInt(input)).toBe(expected);
  });

  test.each(['0', '-1', '1.5', 'abc', '', undefined, null, '1; DROP TABLE criminal'])('%p est refusé', (input) => {
    expect(parsePositiveInt(input)).toBeNull();
  });
});

describe('validateLogin', () => {
  test('exige le matricule et le mot de passe', () => {
    expect(Object.keys(validateLogin({}).errors)).toEqual(['badge_number', 'password']);
  });

  test('retire les espaces autour du matricule', () => {
    const { value, errors } = validateLogin({ badge_number: '  PL-003 ', password: 'x' });
    expect(errors).toEqual({});
    expect(value.badge_number).toBe('PL-003');
  });
});

describe('validateCriminal', () => {
  const valid = { first_name: 'Jean', last_name: 'Roy', crimes: 'Vol' };

  test('accepte un dossier minimal et remplace les champs vides par null', () => {
    const { value, errors } = validateCriminal({ ...valid, nationality: '  ' });
    expect(errors).toEqual({});
    expect(value.nationality).toBeNull();
  });

  test.each(['first_name', 'last_name', 'crimes'])('%s est requis', (name) => {
    const { errors } = validateCriminal({ ...valid, [name]: '   ' });
    expect(errors).toHaveProperty(name);
  });

  test('refuse un prénom de plus de 100 caractères', () => {
    expect(validateCriminal({ ...valid, first_name: 'a'.repeat(101) }).errors).toHaveProperty('first_name');
  });

  test.each(['2020-02-30', '12/05/1990', 'hier'])('refuse la date invalide %p', (date) => {
    expect(validateCriminal({ ...valid, date_of_birth: date }).errors).toHaveProperty('date_of_birth');
  });

  test('refuse une date de naissance future', () => {
    expect(validateCriminal({ ...valid, date_of_birth: '2999-01-01' }).errors).toHaveProperty('date_of_birth');
  });

  test.each(['javascript:alert(1)', 'pas une adresse', 'ftp://x.org/a.jpg'])('refuse la photo %p', (url) => {
    expect(validateCriminal({ ...valid, photo_url: url }).errors).toHaveProperty('photo_url');
  });

  test('accepte une photo https', () => {
    expect(validateCriminal({ ...valid, photo_url: 'https://exemple.org/a.jpg' }).errors).toEqual({});
  });
});

describe('validateStatusChange', () => {
  test('accepte un statut connu et une version', () => {
    expect(validateStatusChange({ status: 'capture', version: 3 })).toEqual({
      value: { status: 'capture', version: 3 },
      errors: {},
    });
  });

  test('refuse un statut inconnu et une version absente', () => {
    expect(Object.keys(validateStatusChange({ status: 'WANTED' }).errors)).toEqual(['status', 'version']);
  });
});

describe('validateListQuery', () => {
  test('valeurs par défaut : page 1, 10 par page', () => {
    expect(validateListQuery({}).value).toEqual({ page: 1, limit: 10, search: '', status: '' });
  });

  test('plafonne la taille de page à 50', () => {
    expect(validateListQuery({ limit: '1000' }).value.limit).toBe(50);
  });

  test('refuse un statut inconnu', () => {
    expect(validateListQuery({ status: 'evade' }).errors).toHaveProperty('status');
  });
});
