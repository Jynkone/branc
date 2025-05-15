import React from 'react';
 import { Pencil, Check, Plus } from 'lucide-react';
 import type { RoomData } from './hooks/useBoardManager'; // Adjusted path
 import type { usePageSelector } from './hooks/usePageSelector'; // Adjusted path
 
 // Props expected by the PageSelector component
 interface PageSelectorProps {
  currentRoom: RoomData | null;
  availableRooms: RoomData[];
  pageSelectorHook: ReturnType<typeof usePageSelector>; // Pass the hook's return value
 }
 
 export function PageSelector({
  currentRoom,
  availableRooms,
  pageSelectorHook,
 }: PageSelectorProps) {
  const {
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
  menuRef,
  boardNameInputRef,
  boardButtonRef,
  } = pageSelectorHook;
 
  if (!currentRoom) {
  // Render nothing or a placeholder if there's no current room yet
  return null;
  }
 
  if (isEditingBoardName) {
  return (
  <div className="tldraw-page-selector">
  <input
  ref={boardNameInputRef}
  value={newBoardName}
  onChange={(e) => setNewBoardName(e.target.value)}
  onBlur={handleInputBlur} // Use the blur handler from the hook
  onKeyDown={handleInputKeyDown} // Use the keydown handler from the hook
  className="tldraw-page-name-input" // Style defined in Canvas.tsx global styles
  />
  </div>
  );
  }
 
  return (
  <div className="tldraw-page-selector">
  <button
  ref={boardButtonRef}
  onClick={toggleMenu} // Use the toggle handler from the hook
  className="tldraw-page-button h-8 pt-20" // Style defined in Canvas.tsx global styles
  >
  {currentRoom.name}
  </button>
 
  {isMenuOpen && (
  <div ref={menuRef} className="tldraw-pages-menu"> {/* Style defined in Canvas.tsx global styles */}
  <div className="tldraw-pages-menu-header"> {/* Style defined in Canvas.tsx global styles */}
  <span>Pages</span>
  <div className="tldraw-pages-menu-actions"> {/* Style defined in Canvas.tsx global styles */}
  <button onClick={handleStartEditing} className="tldraw-icon-button"> {/* Style defined in Canvas.tsx global styles */}
  <Pencil size={14} />
  </button>
  <button onClick={handleNewBoard} className="tldraw-icon-button"> {/* Style defined in Canvas.tsx global styles */}
  <Plus size={14} />
  </button>
  </div>
  </div>
  <div className="tldraw-pages-menu-list"> {/* Style defined in Canvas.tsx global styles */}
  {availableRooms.map((room) => (
  <button
  key={room.id}
  onClick={() => handleSelectBoard(room.id)}
  className={`tldraw-page-list-item ${currentRoom.id === room.id ? 'selected' : ''}`} // Style defined in Canvas.tsx global styles
  >
  {currentRoom.id === room.id && (
  <span className="tldraw-check-icon"><Check size={14} /></span> // Style defined in Canvas.tsx global styles
  )}
  {/* Placeholder for potential drag handle */}
  <span className="tldraw-page-list-item-handle"></span> {/* Style defined in Canvas.tsx global styles */}
  {room.name}
  </button>
  ))}
  </div>
  </div>
  )}
  </div>
  );
 }
