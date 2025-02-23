// chatshape/components/ChatShapeFooter.tsx
import React from 'react'
import { Button } from '../../ui/button'
import { Play } from 'lucide-react'

export type ChatShapeFooterProps = {
  prompt: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSend: () => void
}

export const ChatShapeFooter: React.FC<ChatShapeFooterProps> = ({
  prompt,
  onChange,
  onSend,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: '8px',
        /* Add horizontal padding on left & right to move input away from borders */
        padding: '8px 16px ',
        boxSizing: 'border-box',
      }}
    >
      <textarea
        value={prompt}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder="How can I help?"
        style={{
          flex: 1,
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'none',
          minHeight: '40px',
          maxHeight: '200px',
          overflowY: 'auto',
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onMouseDown={(e) => {
          e.preventDefault()
          onSend()
        }}
      >
        <Play className="w-4 h-4" />
      </Button>
    </div>
  )
}
