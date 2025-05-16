// components/canvas/hooks/usePageSelector.ts
import { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import type { RoomData } from './useBoardManager';

interface UsePageSelectorProps {
  currentRoom: RoomData | null;
  availableRooms: RoomData[];
  selectBoard: (boardId: string) => void;
  createNewBoard: () => Promise<RoomData | null>;
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
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);
  const boardNameInputRef = useRef<HTMLInputElement>(null);
  const boardButtonRef = useRef<HTMLButtonElement>(null);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prev => {
      if (!prev) { 
        setEditingBoardId(null); 
      } else { 
        setEditingBoardId(null); 
      }
      return !prev;
    });
  }, []); 

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        boardButtonRef.current &&
        !boardButtonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
        setEditingBoardId(null);
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
  }, [isMenuOpen]);

  useEffect(() => {
    if (editingBoardId && boardNameInputRef.current) {
      boardNameInputRef.current.focus();
      boardNameInputRef.current.select();
    }
  }, [editingBoardId]);

  const handleStartEditingListItem = useCallback((board: RoomData) => {
    setEditingBoardId(board.id);
    setNewBoardName(board.name);
  }, []); 

  const handleSaveName = useCallback(() => {
    if (!editingBoardId || !newBoardName.trim()) {
      setEditingBoardId(null);
      return;
    }
    renameBoard(editingBoardId, newBoardName.trim());
    setEditingBoardId(null);
  }, [editingBoardId, newBoardName, renameBoard]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setEditingBoardId(null);
      setNewBoardName('');
    }
  }, [handleSaveName]); 

  const handleInputBlur = useCallback(() => {
    handleSaveName();
  }, [handleSaveName]);

  const handleNewBoard = useCallback(async () => {
    try {
      await createNewBoard();
      setEditingBoardId(null);
    } catch (error) {
      console.error("Error creating new board from PageSelector:", error);
    }
  }, [createNewBoard]);

  const handleSelectBoard = useCallback((boardId: string) => {
    if (editingBoardId === boardId) return;
    selectBoard(boardId);
    setIsMenuOpen(false);
    setEditingBoardId(null);
  }, [selectBoard, editingBoardId]);

  return {
    isMenuOpen,
    editingBoardId,
    newBoardName,
    setNewBoardName,
    setIsMenuOpen,
    setEditingBoardId,
    toggleMenu,
    handleStartEditingListItem,
    handleSaveName,
    handleInputKeyDown,
    handleInputBlur,
    handleNewBoard,
    handleSelectBoard,
    menuRef,
    boardNameInputRef,
    boardButtonRef,
  };
}