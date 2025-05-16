// components/canvas/PageSelector.tsx
import React, { useCallback, Dispatch, SetStateAction, useRef } from 'react'; // Added useRef
import { Check, Plus, Save, X, Share2 as ShareIcon } from 'lucide-react';
import type { RoomData } from './hooks/useBoardManager';
import type { usePageSelector } from './hooks/usePageSelector';
import type { useShareDialog } from './hooks/useShareDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageSelectorProps {
  currentRoom: RoomData | null;
  availableRooms: RoomData[];
  pageSelectorHook: ReturnType<typeof usePageSelector> & {
    setEditingBoardId: Dispatch<SetStateAction<string | null>>;
  };
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
  } = pageSelectorHook;

  // Ref to manage click timing for double click detection
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleShareSpecificBoard = useCallback((event: React.MouseEvent, roomToShare: RoomData) => {
    event.stopPropagation();
    if (clickTimeoutRef.current) { // Clear any pending single click action
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    // Proceed with sharing logic
    if (currentRoom?.id !== roomToShare.id) {
      handleSelectBoard(roomToShare.id);
      setTimeout(() => {
        shareDialogHook.handleOpenShareDialog();
      }, 50);
    } else {
      shareDialogHook.handleOpenShareDialog();
    }
    setIsMenuOpen(false);
  }, [currentRoom, handleSelectBoard, shareDialogHook, setIsMenuOpen]);


  const handleItemInteraction = (room: RoomData) => {
    if (editingBoardId === room.id) return; // Already editing this one, do nothing

    if (clickTimeoutRef.current) {
      // This is a double click
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      if (editingBoardId !== room.id) { // Ensure not already editing another
        handleStartEditingListItem(room);
      }
    } else {
      // This is the first click, set a timeout
      clickTimeoutRef.current = setTimeout(() => {
        // If timeout runs, it's a single click
        if (editingBoardId !== room.id) { // Check again in case state changed
           handleSelectBoard(room.id); // This also closes the menu via the hook
        }
        clickTimeoutRef.current = null;
      }, 250); // 250ms window for double click
    }
  };


  return (
    <div className="tldraw-page-selector">
      <button
        ref={boardButtonRef}
        onClick={toggleMenu} // This toggles the main dropdown
        className="tldraw-page-button h-8"
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
        aria-controls="pages-menu-list"
      >
        <span className="truncate max-w-[120px] sm:max-w-[150px]">{currentRoom?.name || "Loading..."}</span>
      </button>

      {isMenuOpen && (
        <div ref={menuRef} className="tldraw-pages-menu">
          <div className="tldraw-pages-menu-header">
            <span>Pages</span>
            <div className="tldraw-pages-menu-actions">
              <button onClick={(e) => { e.stopPropagation(); handleNewBoard(); }} className="tldraw-icon-button" aria-label="Create new page">
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div id="pages-menu-list" className="tldraw-pages-menu-list">
            {availableRooms.map((room) => (
              <div
                key={room.id}
                className={cn(
                  "tldraw-page-list-item-row",
                  currentRoom?.id === room.id && !editingBoardId && "selected",
                  editingBoardId === room.id && "editing"
                )}
                onClick={(e) => {
                  e.stopPropagation(); // Prevent event bubbling
                  if (editingBoardId !== room.id) {
                    handleItemInteraction(room);
                  }
                  // If editing this item, click on row does nothing to avoid conflicts with input click
                }}
                // onDoubleClick is now handled by the custom handleItemInteraction
                role="button" // The row acts as a button
                aria-pressed={currentRoom?.id === room.id && !editingBoardId}
                tabIndex={editingBoardId === room.id ? -1 : 0}
                onKeyDown={(e) => {
                  if (editingBoardId !== room.id) {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectBoard(room.id);
                    } else if (e.key === 'F2') {
                      e.preventDefault();
                      handleStartEditingListItem(room);
                    }
                  }
                }}
              >
                {editingBoardId === room.id ? (
                  // Editing State
                  <div className="tldraw-page-list-item-edit-container">
                    <input
                      ref={boardNameInputRef}
                      type="text"
                      value={newBoardName}
                      onChange={(e) => setNewBoardName(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onBlur={handleInputBlur}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className="tldraw-page-list-item-input"
                      aria-label={`Edit name for ${room.name}`}
                    />
                    <Button
                      variant="ghost" size="icon"
                      onClick={(e) => { e.stopPropagation(); handleSaveName(); }}
                      className="tldraw-edit-action-button" aria-label="Save name"
                    ><Save size={14}/></Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={(e) => { e.stopPropagation(); setEditingBoardId(null); setNewBoardName(''); }}
                      className="tldraw-edit-action-button" aria-label="Cancel editing"
                    ><X size={14}/></Button>
                  </div>
                ) : (
                  // Default Display State
                  <>
                    <div className="tldraw-page-list-item-check-container">
                      {currentRoom?.id === room.id && (
                        <Check size={14} className="tldraw-check-icon" />
                      )}
                    </div>
                    <span
                      className="tldraw-page-list-item-name"
                      // onClick and onDoubleClick are now handled by the parent row div's onClick with custom logic
                    >
                      {room.name}
                    </span>
                    <Button
                      variant="ghost" size="icon"
                      onClick={(e) => handleShareSpecificBoard(e, room)}
                      className="tldraw-page-list-item-share-button"
                      aria-label={`Share ${room.name}`}
                      tabIndex={0}
                    ><ShareIcon size={14} /></Button>
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