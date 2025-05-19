import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Dispatch,
  SetStateAction,
} from 'react';
import type { RoomData } from './useBoardManager';

interface UsePageSelectorProps {
  currentRoom: RoomData | null;
  availableRooms: RoomData[];
  selectBoard: (boardId: string) => void;
  createNewBoard: () => Promise<RoomData | null>;
  renameBoard: (boardId: string, newName: string) => void;
  deleteBoard: (boardId: string) => Promise<void>;
}

export function usePageSelector({
  currentRoom,
  availableRooms,
  selectBoard,
  createNewBoard,
  renameBoard,
  deleteBoard,
}: UsePageSelectorProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingBoardId, setEditingBoardId] =
    useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);
  const boardNameInputRef = useRef<HTMLInputElement>(null);
  const boardButtonRef = useRef<HTMLButtonElement>(null);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => {
      setEditingBoardId(null);
      return !prev;
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        boardButtonRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setIsMenuOpen(false);
      setEditingBoardId(null);
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
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

  const handleStartEditingListItem = useCallback(
    (board: RoomData) => {
      setEditingBoardId(board.id);
      setNewBoardName(board.name);
    },
    []
  );

  const handleSaveName = useCallback(() => {
    if (!editingBoardId || !newBoardName.trim()) {
      setEditingBoardId(null);
      return;
    }
    renameBoard(editingBoardId, newBoardName.trim());
    setEditingBoardId(null);
  }, [editingBoardId, newBoardName, renameBoard]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSaveName();
      else if (e.key === 'Escape') {
        setEditingBoardId(null);
        setNewBoardName('');
      }
    },
    [handleSaveName]
  );

  const handleInputBlur = useCallback(() => {
    handleSaveName();
  }, [handleSaveName]);

  const handleNewBoard = useCallback(async () => {
    try {
      await createNewBoard();
      setEditingBoardId(null);
    } catch (err) {
      console.error('Error creating board:', err);
    }
  }, [createNewBoard]);

  const handleSelectBoard = useCallback(
    (boardId: string) => {
      if (editingBoardId === boardId) return;
      selectBoard(boardId);
      setEditingBoardId(null);
      setIsMenuOpen(false);
    },
    [selectBoard, editingBoardId]
  );

  // KEEP MENU OPEN on delete
  const handleDeleteBoard = useCallback(
    async (boardId: string) => {
      try {
        await deleteBoard(boardId);
        // no setIsMenuOpen(false)
      } catch (err) {
        console.error('Error deleting board:', err);
      }
    },
    [deleteBoard]
  );

  return {
    isMenuOpen,
    editingBoardId,
    newBoardName,
    setNewBoardName,
    toggleMenu,
    handleStartEditingListItem,
    handleSaveName,
    handleInputKeyDown,
    handleInputBlur,
    handleNewBoard,
    handleSelectBoard,
    handleDeleteBoard,
    menuRef,
    boardNameInputRef,
    boardButtonRef,
  };
}
