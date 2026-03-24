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
import { ArrowLeft, Trash2, ShoppingCart, Calendar, Clock, Play, Moon, Sun } from 'lucide-react';
import { useGrocery } from '../context/GroceryContext';
import { toast } from 'sonner';

export function SavedListsPage() {
  const navigate = useNavigate();
  const { savedLists, deleteList, loadList, isDarkMode, toggleDarkMode } = useGrocery();
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [budget, setBudget] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const handleRunList = (listId: string) => {
    setSelectedList(listId);
    setRunDialogOpen(true);
  };

  const handleProceed = () => {
    if (selectedList && budget && postalCode) {
      const list = savedLists.find(l => l.id === selectedList);
      if (list) {
        loadList(list);
        navigate(`/results?budget=${budget}&postalCode=${postalCode}`);
        toast.success(`Running "${list.name}" list`);
      }
    }
  };

  const handleDelete = (listId: string) => {
    const list = savedLists.find(l => l.id === listId);
    deleteList(listId);
    toast.success(`List "${list?.name}" deleted`);
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
                    {list.items.map((item, index) => (
                      <Badge key={index} variant="secondary" className="text-xs dark:bg-gray-700 dark:text-gray-300">
                        {item}
                      </Badge>
                    ))}
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
              Enter your budget and postal code to find deals for this list
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
              <label className="text-sm">Postal Code</label>
              <Input
                type="text"
                placeholder="e.g., 10001"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                maxLength={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleProceed} 
              disabled={!budget || !postalCode}
              className="bg-green-600 hover:bg-green-700"
            >
              Find Deals
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
