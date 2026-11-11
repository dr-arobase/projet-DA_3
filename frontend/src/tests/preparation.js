// Préparation des tests de l'interface : assertions du DOM (toBeInTheDocument…) et nettoyage entre les tests
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());
