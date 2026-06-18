import { RouterProvider } from 'react-router';
import { router } from './routes';
import { GroceryProvider } from './context/GroceryContext';
import { Toaster } from './components/ui/sonner';
import { WorkInProgressNotice } from './components/WorkInProgressNotice';

export default function App() {
  return (
    <GroceryProvider>
      {/* The project-status notice sits outside the router so it appears on
          every page, including fallback routes. */}
      <WorkInProgressNotice />
      <RouterProvider router={router} />
      <Toaster />
    </GroceryProvider>
  );
}
