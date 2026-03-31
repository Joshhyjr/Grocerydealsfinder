import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { ArrowLeft, Trash2, ShoppingCart, Calendar, Clock, Play, Moon, Sun, Plus, X, MapPin } from 'lucide-react';
import { useGrocery } from '../context/GroceryContext';
import { toast } from 'sonner';
import { useLocationInput } from '../hooks/useLocationInput';
import { buildLocationSearchParams } from '../data/location';

export function SavedListsPage() {
  const navigate = useNavigate();
  const {
    savedLists,
    deleteList,
    loadList,
    addItemToSavedList,
    removeItemFromSavedList,
    activeLocation,
    setActiveLocation,
    isDarkMode,
    toggleDarkMode,
  } = useGrocery();
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [budget, setBudget] = useState('');
  const [listDrafts, setListDrafts] = useState<Record<string, string>>({});
  const {
    locationInput,
    setLocationInput,
    isResolvingLocation,
    resolveLocation,
    useCurrentLocation,
  } = useLocationInput(activeLocation?.input ?? '');

  const handleRunList = (listId: string) => {
    setSelectedList(listId);
    setRunDialogOpen(true);
  };

  const handleProceed = async () => {
    if (selectedList && budget && locationInput) {
      const list = savedLists.find(l => l.id === selectedList);
      if (list) {
        try {
          const location = await resolveLocation();
          setActiveLocation(location);
          loadList(list);
          navigate(`/results?${buildLocationSearchParams(budget, location).toString()}`);
          toast.success(`Running "${list.name}" list`);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Unable to resolve that location right now.');
        }
      }
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      const location = await useCurrentLocation();
      setActiveLocation(location);
      toast.success('Using your current location.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to use your current location right now.');
    }
  };

  const handleDelete = (listId: string) => {
    const list = savedLists.find(l => l.id === listId);
    deleteList(listId);
    toast.success(`List "${list?.name}" deleted`);
  };

  const handleDraftChange = (listId: string, value: string) => {
    setListDrafts((prev) => ({ ...prev, [listId]: value }));
  };

  const handleAddSavedItem = (listId: string) => {
    const draftValue = listDrafts[listId] ?? '';
    const didAdd = addItemToSavedList(listId, draftValue);

    if (didAdd) {
      setListDrafts((prev) => ({ ...prev, [listId]: '' }));
      toast.success('Item added to saved list');
      return;
    }

    toast.error('Enter a new item that is not already on this list.');
  };

  const handleRemoveSavedItem = (listId: string, item: string) => {
    removeItemFromSavedList(listId, item);
    toast.success(`Removed "${item}" from saved list`);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="dark:text-gray-300 dark:hover:bg-gray-800">
                <ArrowLeft className="size-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-5 text-green-600" />
                <span className="text-lg dark:text-white">Grocery Deals Finder</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDarkMode}
              className="dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {isDarkMode ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl mb-3 dark:text-white">Saved Shopping Lists</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {savedLists.length} {savedLists.length === 1 ? 'list' : 'lists'} saved
          </p>
        </div>

        {savedLists.length === 0 ? (
          <Card className="max-w-2xl mx-auto dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="py-16 text-center">
              <ShoppingCart className="size-16 mx-auto mb-4 text-gray-400" />
              <h2 className="text-2xl mb-2 dark:text-white">No Saved Lists</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create a shopping list and save it to reuse later
              </p>
              <Button
                onClick={() => navigate('/')}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Create Your First List
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedLists.map(list => (
              <Card key={list.id} className="hover:shadow-lg transition-shadow dark:bg-gray-800 dark:border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl mb-1 dark:text-white">{list.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {list.items.length} {list.items.length === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950">
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete List</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{list.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(list.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4 max-h-32 overflow-y-auto">
                    {list.items.map((item) => (
                      <Badge
                        key={item.name}
                        variant="secondary"
                        className="text-xs dark:bg-gray-700 dark:text-gray-300 pr-1"
                      >
                        {item.name}
                        {item.quantity > 1 ? ` x${item.quantity}` : ''}
                        <button
                          type="button"
                          onClick={() => handleRemoveSavedItem(list.id, item.name)}
                          className="ml-2 rounded-full p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600"
                          aria-label={`Remove ${item.name} from ${list.name}`}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>

                  <div className="mb-4">
                    {/* Saved-list edits stay local to the template until the user
                        explicitly loads the list, which keeps active comparisons predictable. */}
                    <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">Add Item</label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="e.g., Milk"
                        value={listDrafts[list.id] ?? ''}
                        onChange={(e) => handleDraftChange(list.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSavedItem(list.id);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleAddSavedItem(list.id)}
                        className="shrink-0"
                      >
                        <Plus className="size-4 mr-2" />
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4" />
                      <span>Created {new Date(list.createdAt).toLocaleDateString()}</span>
                    </div>
                    {list.lastUsed && (
                      <div className="flex items-center gap-2">
                        <Clock className="size-4" />
                        <span>Last used {new Date(list.lastUsed).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleRunList(list.id)}
                  >
                    <Play className="size-4 mr-2" />
                    Run This List
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Run List Dialog */}
      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Shopping List</DialogTitle>
            <DialogDescription>
              Enter your budget and address or postal code to find deals for this list
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm">Budget</label>
              <Input
                type="number"
                placeholder="e.g., 100"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Address or Postal Code</label>
              <Input
                type="text"
                placeholder="e.g., 123 Main St Halifax or B3H 2Y7"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleUseCurrentLocation}
                disabled={isResolvingLocation}
                className="w-full"
              >
                <MapPin className="size-4 mr-2" />
                {isResolvingLocation ? 'Finding your location...' : 'Use My Location'}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleProceed} 
              disabled={!budget || !locationInput || isResolvingLocation}
              className="bg-green-600 hover:bg-green-700"
            >
              {isResolvingLocation ? 'Resolving location...' : 'Find Deals'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t dark:border-gray-700 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <ShoppingCart className="size-4 text-green-600" />
              <span>Grocery Deals Finder</span>
            </div>
            <p>© 2026 Grocery Deals Finder. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
