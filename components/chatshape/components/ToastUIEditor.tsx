// components/chatshape/components/ToastUIEditor.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';

export type ToastUIEditorProps = {
  initialValue: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  sharedEditorState?: string; // New prop for shared editing state
};

export const ToastUIEditor: React.FC<ToastUIEditorProps> = ({
  initialValue,
  onChange,
  onBlur,
  sharedEditorState, // New prop to receive shared editor content
}) => {
  const editorRef = useRef<Editor>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef(initialValue);

  // Effect to update editor content from shared state
  useEffect(() => {
    const instance = editorRef.current?.getInstance();
    if (instance && sharedEditorState !== undefined) {
      const currentContent = instance.getMarkdown();
      if (currentContent !== sharedEditorState) {
        instance.setMarkdown(sharedEditorState);
      }
    }
  }, [sharedEditorState]);

  // Memoized change handler to reduce unnecessary re-renders
  const handleChange = useCallback(() => {
    const instance = editorRef.current?.getInstance();
    if (instance) {
      const content = instance.getMarkdown() || '';
      if (content !== contentRef.current) {
        contentRef.current = content;
        onChange(content);
      }
    }
  }, [onChange]);

  // Existing effects and handlers remain the same
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onBlur();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onBlur]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#F9FAFB',
      }}
    >
      <Editor
        ref={editorRef}
        initialValue={initialValue}
        initialEditType="wysiwyg"
        previewStyle="vertical"
        height="100%"
        hideModeSwitch={true}
        usageStatistics={false}
        onChange={handleChange}
      />
    </div>
  );
};