import React, { useCallback, useRef } from 'react';
import {
  Check,
  Plus,
  Save,
  X,
  Share2 as ShareIcon,
  Trash2 as DeleteIcon,
} from 'lucide-react';
import type { RoomData } from './hooks/useBoardManager';
import type { usePageSelector } from './hooks/usePageSelector';
import type { useShareDialog } from './hooks/useShareDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageSelectorProps {
  currentRoom: RoomData | null;
  availableRooms: RoomData[];
  pageSelectorHook: ReturnType<typeof usePageSelector>;
  shareDialogHook: ReturnType<typeof useShareDialog>;
}

export function PageSelector({
  currentRoom,
  availableRooms,
  pageSelectorHook,
  shareDialogHook,
}: PageSelectorProps) {
  const {
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
  } = pageSelectorHook;

  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleShareSpecificBoard = useCallback(
    (e: React.MouseEvent, room: RoomData) => {
      e.stopPropagation();
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      if (currentRoom?.id !== room.id) {
        handleSelectBoard(room.id);
        setTimeout(() => shareDialogHook.handleOpenShareDialog(), 50);
      } else {
        shareDialogHook.handleOpenShareDialog();
      }
      // menu stays open
    },
    [currentRoom, handleSelectBoard, shareDialogHook]
  );

  const handleItemInteraction = useCallback(
    (room: RoomData) => {
      if (editingBoardId === room.id) return;
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
        handleStartEditingListItem(room);
      } else {
        clickTimeoutRef.current = setTimeout(() => {
          handleSelectBoard(room.id);
          clickTimeoutRef.current = null;
        }, 250);
      }
    },
    [editingBoardId, handleStartEditingListItem, handleSelectBoard]
  );

  const onlyOne = availableRooms.length <= 1;

  return (
    <div className="tldraw-page-selector">
      <button
        ref={boardButtonRef}
        onClick={toggleMenu}
        className="tldraw-page-button h-8"
        aria-haspopup="true"
        aria-expanded={isMenuOpen}
      >
        <span className="truncate max-w-[120px] sm:max-w-[150px]">
          {currentRoom?.name || 'Loading...'}
        </span>
      </button>

      {isMenuOpen && (
        <div ref={menuRef} className="tldraw-pages-menu">
          <div className="tldraw-pages-menu-header">
            <span>Boards</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNewBoard();
              }}
              className="tldraw-icon-button"
              aria-label="New page"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="tldraw-pages-menu-list">
            {availableRooms.map((room) => (
              <div
                key={room.id}
                className={cn(
                  'tldraw-page-list-item-row',
                  currentRoom?.id === room.id && !editingBoardId && 'selected',
                  editingBoardId === room.id && 'editing'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!editingBoardId) handleItemInteraction(room);
                }}
                role="button"
                tabIndex={editingBoardId === room.id ? -1 : 0}
              >
                {editingBoardId === room.id ? (
                  <div className="tldraw-page-list-item-edit-container">
                    <input
                      ref={boardNameInputRef}
                      value={newBoardName}
                      onChange={(e) => setNewBoardName(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onBlur={handleInputBlur}
                      className="tldraw-page-list-item-input"
                      aria-label={`Edit name for ${room.name}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveName();
                      }}
                      aria-label="Save"
                    >
                      <Save size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewBoardName('');
                        handleStartEditingListItem({ ...room, name: '' });
                      }}
                      aria-label="Cancel"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="tldraw-page-list-item-check-container">
                      {currentRoom?.id === room.id && <Check size={14} />}
                    </div>
                    <span className="tldraw-page-list-item-name">
                      {room.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-500 hover:text-red-500"
                      onClick={(e) => handleShareSpecificBoard(e, room)}
                      aria-label={`Share ${room.name}`}
                    >
                      <ShareIcon size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'hover:text-red-500',
                        onlyOne
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-500'
                      )}
                      disabled={onlyOne}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!onlyOne) handleDeleteBoard(room.id);
                      }}
                      aria-label={`Delete ${room.name}`}
                    >
                      <DeleteIcon size={14} />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
