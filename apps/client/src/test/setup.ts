import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount between tests so queries never match a previous test's DOM.
afterEach(cleanup);
