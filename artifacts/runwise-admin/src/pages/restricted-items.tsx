import { useRestrictedItems, useAddRestrictedItem, useDeleteRestrictedItem } from '@/hooks/use-queries';
import { Loader2, ShieldAlert, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { cn } from '@/components/layout';

export default function RestrictedItems() {
  const { data: items, isLoading } = useRestrictedItems();
  const add = useAddRestrictedItem();
  const del = useDeleteRestrictedItem();
  
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'weapons',
    description: '',
    is_absolute: true,
    notes: ''
  });

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    
    add.mutate(formData, {
      onSuccess: () => {
        setIsOpen(false);
        setFormData({
          name: '',
          category: 'weapons',
          description: '',
          is_absolute: true,
          notes: ''
        });
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Remove "${name}" from the restricted items list?`)) {
      del.mutate({ id, name });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-mono font-bold">Restricted Items</h1>
          <p className="text-muted-foreground mt-1">Configure items banned from the platform.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <button className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors flex items-center shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Add Restriction
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Restricted Item</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium mb-1">Item Name</label>
                <input 
                  type="text" required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="e.g. Lithium Batteries"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select 
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full px-3 py-2 border border-input rounded-md"
                >
                  <option value="weapons">Weapons & Firearms</option>
                  <option value="drugs">Drugs & Narcotics</option>
                  <option value="hazmat">Hazardous Materials</option>
                  <option value="livestock">Live Animals</option>
                  <option value="perishables">Restricted Perishables</option>
                  <option value="currency">Cash & Currency</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 py-2">
                <input 
                  type="checkbox" 
                  id="absolute"
                  checked={formData.is_absolute}
                  onChange={e => setFormData({...formData, is_absolute: e.target.checked})}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="absolute" className="text-sm font-medium">
                  Absolute Ban (Zero Exceptions)
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description (Public)</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-input rounded-md h-20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Internal Notes (Admin Only)</label>
                <textarea 
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-input rounded-md h-20 bg-muted/50"
                />
              </div>

              <DialogFooter className="mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-input rounded-md"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={add.isPending || !formData.name}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 flex items-center"
                >
                  {add.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Rule
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items?.map(item => (
          <div key={item.id} className="bg-card border border-card-border rounded-xl p-5 shadow-sm relative group">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className={cn(
                  "h-5 w-5",
                  item.is_absolute ? "text-destructive" : "text-orange-500"
                )} />
                <h3 className="font-semibold text-foreground">{item.name}</h3>
              </div>
              <button 
                onClick={() => handleDelete(item.id, item.name)}
                disabled={del.isPending}
                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            
            <div className="text-xs uppercase tracking-wider font-mono text-muted-foreground mb-3">
              {item.category}
            </div>
            
            {item.description && (
              <p className="text-sm text-foreground/80 mb-4 line-clamp-2">
                {item.description}
              </p>
            )}
            
            <div className="mt-auto pt-4 border-t border-card-border flex justify-between items-center text-xs">
              <span className={cn(
                "px-2 py-0.5 rounded-full font-medium",
                item.is_absolute ? "bg-destructive/10 text-destructive" : "bg-orange-100 text-orange-700"
              )}>
                {item.is_absolute ? 'Absolute Ban' : 'Conditional'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
