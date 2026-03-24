import { createBrowserRouter } from 'react-router';
import { HomePage } from './pages/HomePage';
import { ResultsPage } from './pages/ResultsPage';
import { MapViewPage } from './pages/MapViewPage';
import { SavedListsPage } from './pages/SavedListsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: HomePage,
  },
  {
    path: '/results',
    Component: ResultsPage,
  },
  {
    path: '/map',
    Component: MapViewPage,
  },
  {
    path: '/saved-lists',
    Component: SavedListsPage,
  },
  {
    path: '*',
    Component: () => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4">404 - Page Not Found</h1>
          <a href="/" className="text-blue-600 hover:underline">
            Go back home
          </a>
        </div>
      </div>
    ),
  },
]);