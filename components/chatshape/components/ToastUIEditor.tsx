// components/chatshape/ToastUIEditor.tsx
import React, { useRef, useEffect } from 'react';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';

export type ToastUIEditorProps = {
  initialValue: string;
  onChange: (value: string) => void;
  onBlur: () => void;
};

export const ToastUIEditor: React.FC<ToastUIEditorProps> = ({
  initialValue,
  onChange,
  onBlur,
}) => {
  const editorRef = useRef<Editor>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef(initialValue);
  const lastSyncTimeRef = useRef(Date.now());

  // Update editor when initialValue changes from an external source
  useEffect(() => {
    const instance = editorRef.current?.getInstance();
    if (!instance) return;

    const currentContent = instance.getMarkdown();
    if (initialValue !== currentContent && initialValue !== contentRef.current) {
      instance.setMarkdown(initialValue);
      contentRef.current = initialValue;
    }
  }, [initialValue]);

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

  // Set up real-time content monitoring with more frequent updates for better responsiveness
  useEffect(() => {
    const instance = editorRef.current?.getInstance();
    if (!instance) return;
    
    // Enhanced change detection for real-time collaboration
    const interval = setInterval(() => {
      const content = instance.getMarkdown() || '';
      if (content !== contentRef.current) {
        contentRef.current = content;
        onChange(content);
        lastSyncTimeRef.current = Date.now();
      }
    }, 50); // Check every 50ms for more responsive updates
    
    return () => clearInterval(interval);
  }, [onChange]);

  // Add event listeners directly to the editor using DOM access
  useEffect(() => {
    const instance = editorRef.current?.getInstance();
    if (!instance) return;

    // Access the editor element directly using the DOM
    // The editor is typically mounted within the container element
    if (containerRef.current) {
      // Find the editor's content editable div - it's usually the one with class 'toastui-editor-contents'
      const editorEl = containerRef.current.querySelector('.toastui-editor-contents') as HTMLElement;
      
      if (editorEl) {
        const handleInput = () => {
          // Debounce updates to avoid excessive updates
          const now = Date.now();
          if (now - lastSyncTimeRef.current > 50) { // 50ms debounce
            const content = instance.getMarkdown() || '';
            if (content !== contentRef.current) {
              contentRef.current = content;
              onChange(content);
              lastSyncTimeRef.current = now;
            }
          }
        };

        editorEl.addEventListener('keyup', handleInput);
        editorEl.addEventListener('input', handleInput);
        editorEl.addEventListener('paste', handleInput);
        
        return () => {
          editorEl.removeEventListener('keyup', handleInput);
          editorEl.removeEventListener('input', handleInput);
          editorEl.removeEventListener('paste', handleInput);
        };
      }
    }
  }, [onChange]);

  // Keep the original onChange handler for compatibility
  const handleChange = () => {
    const instance = editorRef.current?.getInstance();
    const content = instance?.getMarkdown() || '';
    contentRef.current = content;
    onChange(content);
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',  // Let this container fill its parent
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#F9FAFB', // Match chatshape color
      }}
    >
      <Editor
        ref={editorRef}
        initialValue={initialValue}
        initialEditType="wysiwyg"
        previewStyle="vertical"
        height="100%"       // Make the editor itself fill the container
        hideModeSwitch={true}  // <--- This hides the tabs
        usageStatistics={false}
        onChange={handleChange}
      />
    </div>
  );
};