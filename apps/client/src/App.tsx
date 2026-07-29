import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { PersistGate } from 'redux-persist/integration/react';

import { persistor, store } from '@/app/store';
import { router } from '@/router';

export default function App() {
  return (
    <Provider store={store}>
      {/* Holds rendering until the persisted cart is rehydrated, so the header
          badge never flashes 0 before showing the real count. */}
      <PersistGate loading={null} persistor={persistor}>
        <RouterProvider router={router} />
      </PersistGate>
    </Provider>
  );
}
