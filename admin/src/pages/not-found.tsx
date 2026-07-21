import { AlertCircle } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center space-y-4 p-8 bg-card border border-card-border rounded-xl shadow-sm max-w-md w-full">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-6" />
        <h1 className="text-2xl font-mono font-bold text-foreground">System Path Not Found</h1>
        <p className="text-muted-foreground">
          The module you are looking for does not exist or you lack sufficient clearance.
        </p>
        <div className="pt-4 mt-4 border-t border-border">
          <Link href="/">
            <button className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors w-full">
              Return to Command Center
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
