import { useDispatch, useSelector } from 'react-redux';

import type { AppDispatch, RootState } from '@/app/store';

/**
 * Pre-typed hooks. Components use these instead of the bare react-redux ones so
 * state and dispatch are typed without a generic at every call site.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
