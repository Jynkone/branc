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
      // If nothing is typed, do nothing
      if (!prompt.trim()) {
        e.preventDefault()
        return
      }
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        boxSizing: 'border-box',
        height: '100%',
      }}
    >
      <textarea
        value={prompt}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder="How can I help?"
        style={{
          flex: 1,
          height: '100%',
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'none',
          minHeight: '40px',
          overflowY: 'auto',
          paddingTop: '11px',
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onMouseDown={(e) => {
          if (!prompt.trim()) {
            e.preventDefault()
            return
          }
          e.preventDefault()
          onSend()
        }}
        disabled={!prompt.trim()}
      >
        <Play className="w-4 h-4" />
      </Button>
    </div>
  )
}
