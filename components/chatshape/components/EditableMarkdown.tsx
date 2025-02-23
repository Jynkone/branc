// chatshape/components/EditableMarkdown.tsx
import React from 'react'
import ReactMarkdown from 'react-markdown'

export type EditableMarkdownProps = {
  content: string
}

export const EditableMarkdown: React.FC<EditableMarkdownProps> = ({ content }) => {
  return (
    <ReactMarkdown
      components={{
        h1: ({ node, ...props }) => (
          <h1
            style={{ fontSize: '2rem', margin: '1rem 0', fontWeight: 'bold' }}
            {...props}
          />
        ),
        h2: ({ node, ...props }) => (
          <h2
            style={{ fontSize: '1.75rem', margin: '0.75rem 0', fontWeight: 'bold' }}
            {...props}
          />
        ),
        h3: ({ node, ...props }) => (
          <h3
            style={{ fontSize: '1.5rem', margin: '0.5rem 0', fontWeight: 'bold' }}
            {...props}
          />
        ),
        p: ({ node, ...props }) => (
          <p style={{ lineHeight: 1.5, margin: '0.5rem 0' }} {...props} />
        ),
        ul: ({ node, ...props }) => (
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }} {...props} />
        ),
        li: ({ node, ...props }) => (
          <li style={{ marginBottom: '0.25rem' }} {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
