// This version has NO Play button
import React from 'react'
import { Button } from "@/components/ui/button"
import { LoopIcon } from '@radix-ui/react-icons'
import { Scissors } from 'lucide-react' // Import Scissors

export type ChatShapeHeaderProps = {
  strokeColor: string
  onContextClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  onPruneHistory: (e: React.MouseEvent<HTMLButtonElement>) => void // Add prop type
}

export const ChatShapeHeader: React.FC<ChatShapeHeaderProps> = ({
  strokeColor,
  onContextClick,
  onPruneHistory, // Destructure prop
}) => {
  return (
    <div
      style={{
        height: 32,
        backgroundColor: strokeColor,
        borderBottom: '1px solid #ccc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 8px',
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onMouseDown={onContextClick}
        className="group" // mark the button as a group
      >
        <LoopIcon className="w-4 h-4 text-[#ffffff] group-hover:text-black" />
      </Button>
      {/* Add Prune History Button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onMouseDown={onPruneHistory}
        title="Prune history from this point"
        className="group"
      >
        <Scissors className="w-4 h-4 text-[#ffffff] group-hover:text-black" />
      </Button>
    </div>
  )
}
