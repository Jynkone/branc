// components/canvas/PageSelector.tsx
'use client';

import { Check, Pencil, Plus } from 'lucide-react';
import type { RoomData } from './hooks/useBoardManager';
import type { usePageSelector } from './hooks/usePageSelector';

interface Props {
  currentRoom: RoomData;
  availableRooms: RoomData[];
  pageSelectorHook: ReturnType<typeof usePageSelector>;
}

export function PageSelector({
  currentRoom,
  availableRooms,
  pageSelectorHook: h,
}: Props) {
  if (h.isEditingBoardName) {
    return (
      <input
        ref={h.boardNameInputRef}
        className="tldraw-page-name-input"
        value={h.newBoardName}
        onChange={(e) => h.setNewBoardName(e.target.value)}
        onBlur={h.handleInputBlur}
        onKeyDown={h.handleInputKeyDown}
      />
    );
  }

  return (
    <div className="tldraw-page-selector">
      <button ref={h.boardButtonRef} className="tldraw-page-button" onClick={h.toggleMenu}>
        {currentRoom.name} <span className="ml-1 text-xs">▾</span>
      </button>

      {h.isMenuOpen && (
        <div ref={h.menuRef} className="tldraw-pages-menu">
          <div className="tldraw-pages-menu-header">
            <span>Pages</span>
            <div className="tldraw-pages-menu-actions">
              <button
                className="tldraw-icon-button"
                onClick={h.handleStartEditing}
                title="Rename board"
              >
                <Pencil size={14} />
              </button>
              <button
                className="tldraw-icon-button"
                onClick={h.handleNewBoard}
                title="New board"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <ul className="tldraw-pages-menu-list">
            {availableRooms.map((room) => (
              <li key={room.id}>
                <button
                  className={`tldraw-page-list-item ${
                    room.id === currentRoom.id ? 'selected' : ''
                  }`}
                  onClick={() => h.handleSelectBoard(room.id)}
                >
                  {room.id === currentRoom.id && <Check className="h-3 w-3 mr-1" />}
                  {room.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
