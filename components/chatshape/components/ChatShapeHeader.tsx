// This version has NO Play button
import React from 'react'
import { Button } from "@/components/ui/button"
import { LoopIcon } from '@radix-ui/react-icons'

export type ChatShapeHeaderProps = {
  strokeColor: string
  onContextClick: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export const ChatShapeHeader: React.FC<ChatShapeHeaderProps> = ({
  strokeColor,
  onContextClick,
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
        className="group"  // mark the button as a group
      >
  <LoopIcon className="w-4 h-4 text-[#ffffff] group-hover:text-black" />
  </Button>
    </div>
  )
}
