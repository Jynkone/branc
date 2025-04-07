import { useState, useCallback } from 'react';
import type { RoomData } from './useBoardManager'; // Path is correct

interface UseShareDialogProps {
  currentRoom: RoomData | null;
  ensureBoardIsShareable: (boardId: string) => string | null; // Function from useBoardManager
}

export function useShareDialog({ currentRoom, ensureBoardIsShareable }: UseShareDialogProps) {
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  // Function to open the share dialog and generate the link
  const handleOpenShareDialog = useCallback(() => {
    if (!currentRoom) return;

    // Ensure the board is shareable and get the link
    const link = ensureBoardIsShareable(currentRoom.id);

    if (link) {
      setShareLink(link);
      setLinkCopied(false); // Reset copied state when opening
      setIsShareDialogOpen(true);
      console.log("Opening share dialog for board:", currentRoom.id);
    } else {
      console.error("Failed to get share link for board:", currentRoom.id);
      // Optionally show an error message to the user
    }
  }, [currentRoom, ensureBoardIsShareable]);

  // Function to close the share dialog
  const handleCloseShareDialog = useCallback(() => {
    setIsShareDialogOpen(false);
  }, []);

  // Function to copy the share link to clipboard
  const copyShareLink = useCallback(async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      // Reset copied state after a short delay
      const timer = setTimeout(() => setLinkCopied(false), 2000);
      // Clear timeout if the component unmounts or copy is clicked again
      return () => clearTimeout(timer);
    } catch (err) {
      console.error("Failed to copy share link:", err);
      // Optionally show an error message
    }
  }, [shareLink]);

  return {
    isShareDialogOpen,
    shareLink,
    linkCopied,
    handleOpenShareDialog,
    handleCloseShareDialog,
    copyShareLink,
    // Provide the setter for manual control if needed, though handleCloseShareDialog is preferred
    setIsShareDialogOpen,
  };
}
