// components/canvas/hooks/useShareDialog.ts
import { useState, useCallback } from 'react';
import type { RoomData } from './useBoardManager';

interface UseShareDialogProps {
  currentRoom: RoomData | null; // Keep if still used elsewhere or for initial state
  ensureBoardIsShareable: (boardId: string) => string | null;
}

export function useShareDialog({ currentRoom, ensureBoardIsShareable }: UseShareDialogProps) {
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [boardBeingShared, setBoardBeingShared] = useState<RoomData | null>(null);


  const handleOpenShareDialog = useCallback((boardToShare?: RoomData) => {
    const boardToUse = boardToShare || currentRoom; // Use provided board or fallback to currentRoom

    if (!boardToUse) {
      console.error("Share dialog: No board specified or available.");
      return;
    }
    setBoardBeingShared(boardToUse); // Store the board being shared

    const link = ensureBoardIsShareable(boardToUse.id);

    if (link) {
      setShareLink(link);
      setLinkCopied(false);
      setIsShareDialogOpen(true);
      console.log("Opening share dialog for board:", boardToUse.id);
    } else {
      console.error("Failed to get share link for board:", boardToUse.id);
    }
  }, [currentRoom, ensureBoardIsShareable]); // Add currentRoom if still used as fallback

  const handleCloseShareDialog = useCallback(() => {
    setIsShareDialogOpen(false);
    setBoardBeingShared(null); // Clear the board being shared
  }, []);

  const copyShareLink = useCallback(async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      const timer = setTimeout(() => setLinkCopied(false), 2000);
      return () => clearTimeout(timer);
    } catch (err) {
      console.error("Failed to copy share link:", err);
    }
  }, [shareLink]);

  return {
    isShareDialogOpen,
    shareLink,
    linkCopied,
    boardBeingShared, // Expose this if needed by the dialog title
    handleOpenShareDialog,
    handleCloseShareDialog,
    copyShareLink,
    setIsShareDialogOpen,
  };
}