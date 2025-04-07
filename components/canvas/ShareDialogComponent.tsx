import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"; // Reverted to alias path
import { Input } from "@/components/ui/input"; // Reverted to alias path
import { Button } from "@/components/ui/button"; // Reverted to alias path
import type { useShareDialog } from './hooks/useShareDialog'; // Path is correct

// Props expected by the ShareDialogComponent
interface ShareDialogComponentProps {
  shareDialogHook: ReturnType<typeof useShareDialog>; // Pass the hook's return value
}

export function ShareDialogComponent({ shareDialogHook }: ShareDialogComponentProps) {
  const {
    isShareDialogOpen,
    shareLink,
    linkCopied,
    copyShareLink,
    handleCloseShareDialog, // Use the closing handler from the hook
    setIsShareDialogOpen, // Use the setter from the hook for onOpenChange
  } = shareDialogHook;

  return (
    <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this board</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            Anyone with this link can view and edit this board:
          </p>

          <div className="grid grid-cols-4 items-center gap-4">
            <Input
              id="share-link-input" // Added id for potential label association
              value={shareLink}
              readOnly
              className="col-span-3"
              // Select text on click for easy copying
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              onClick={copyShareLink}
              variant={linkCopied ? "outline" : "default"} // Change variant when copied
              aria-label={linkCopied ? "Link copied to clipboard" : "Copy share link"}
            >
              {linkCopied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          {/* Use the handler from the hook to close */}
          <Button variant="outline" onClick={handleCloseShareDialog}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
