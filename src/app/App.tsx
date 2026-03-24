import { RouterProvider } from 'react-router';
import { router } from './routes';
import { GroceryProvider } from './context/GroceryContext';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <GroceryProvider>
      <RouterProvider router={router} />
      <Toaster />
    </GroceryProvider>
  );
}