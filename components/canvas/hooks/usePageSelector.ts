import { useState, useEffect, useRef, useCallback } from 'react';
import type { RoomData } from './useBoardManager'; // Path is correct

interface UsePageSelectorProps {
  currentRoom: RoomData | null;
  availableRooms: RoomData[];
  selectBoard: (boardId: string) => void;
  createNewBoard: () => RoomData | undefined; // Updated return type based on useBoardManager
  renameBoard: (boardId: string, newName: string) => void;
}

export function usePageSelector({
  currentRoom,
  availableRooms,
  selectBoard,
  createNewBoard,
  renameBoard,
}: UsePageSelectorProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingBoardName, setIsEditingBoardName] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

  // Refs for DOM elements - these will be attached in the component using the hook
  const menuRef = useRef<HTMLDivElement>(null);
  const boardNameInputRef = useRef<HTMLInputElement>(null);
  const boardButtonRef = useRef<HTMLButtonElement>(null); // Ref for the main button that opens the menu

  // Toggle menu visibility
  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        boardButtonRef.current && // Also check if the click was on the button itself
        !boardButtonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]); // Depend only on isMenuOpen

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingBoardName && boardNameInputRef.current) {
      boardNameInputRef.current.focus();
      boardNameInputRef.current.select();
    }
  }, [isEditingBoardName]);

  // Handler to initiate renaming
  const handleStartEditing = useCallback(() => {
    if (!currentRoom) return;
    setNewBoardName(currentRoom.name);
    setIsEditingBoardName(true);
    setIsMenuOpen(false); // Close menu when starting edit
  }, [currentRoom]);

  // Handler to save the new board name
  const handleSaveName = useCallback(() => {
    if (!currentRoom || !newBoardName.trim()) {
      setIsEditingBoardName(false); // Exit editing mode even if name is invalid/unchanged
      return;
    }
    renameBoard(currentRoom.id, newBoardName.trim());
    setIsEditingBoardName(false);
  }, [currentRoom, newBoardName, renameBoard]);

  // Handler for keyboard events on the input
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setIsEditingBoardName(false);
      // Optionally reset newBoardName to currentRoom?.name here if desired
    }
  }, [handleSaveName]);

  // Handler for input blur event
  const handleInputBlur = useCallback(() => {
    // Save on blur only if the name is valid and different (optional, depends on desired UX)
    // handleSaveName();
    // For now, let's just exit editing mode on blur, Enter is the explicit save
     setIsEditingBoardName(false);
  }, []);


  // Handler to create a new board
  const handleNewBoard = useCallback(() => {
    createNewBoard(); // This now selects the board and updates URL via useBoardManager
    setIsMenuOpen(false); // Close menu after creating
  }, [createNewBoard]);

  // Handler to select a board from the list
  const handleSelectBoard = useCallback((boardId: string) => {
    selectBoard(boardId);
    setIsMenuOpen(false); // Close menu after selection
  }, [selectBoard]);

  return {
    isMenuOpen,
    isEditingBoardName,
    newBoardName,
    setNewBoardName,
    toggleMenu,
    handleStartEditing,
    handleSaveName,
    handleInputKeyDown,
    handleInputBlur,
    handleNewBoard,
    handleSelectBoard,
    // Refs to be attached by the component
    menuRef,
    boardNameInputRef,
    boardButtonRef,
  };
}
