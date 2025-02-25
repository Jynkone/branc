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
  const lastKnownContentRef = useRef(initialValue);

  // Set up click outside detection for blur events
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

  // Initialize with proper content when it changes externally
  useEffect(() => {
    const instance = editorRef.current?.getInstance();
    if (!instance) return;
    
    // Only update editor content if it differs from our tracked content
    // This prevents infinite loops from the editor's own change events
    if (initialValue !== lastKnownContentRef.current) {
      lastKnownContentRef.current = initialValue;
      instance.setMarkdown(initialValue);
    }
  }, [initialValue]);

  // Set up change monitoring with events and a safety interval
  useEffect(() => {
    const instance = editorRef.current?.getInstance();
    if (!instance) return;
    
    // Primary method: Use editor events
    const handleEditorChange = () => {
      const content = instance.getMarkdown() || '';
      if (content !== lastKnownContentRef.current) {
        lastKnownContentRef.current = content;
        onChange(content);
      }
    };
    
    // Add event listeners
    // Different Toast UI Editor versions have different event names
    try {
      // For newer versions
      instance.on('change', () => handleEditorChange());
    } catch (e) {
      console.log('Using older Toast UI Editor event model');
      // For older versions
      const editorEl = editorRef.current?.getRootElement?.();
                       
      if (editorEl) {
        editorEl.addEventListener('input', handleEditorChange);
      }
    }
    
    // Backup method: Poll for changes (as safety measure)
    const interval = setInterval(() => {
      const content = instance.getMarkdown() || '';
      if (content !== lastKnownContentRef.current) {
        lastKnownContentRef.current = content;
        onChange(content);
      }
    }, 200); // More responsive polling
    
    return () => {
      try {
        instance.off('change');
      } catch (e) {
        const editorEl = editorRef.current?.getRootElement?.();
        if (editorEl) {
          editorEl.removeEventListener('input', handleEditorChange);
        }
      }
      clearInterval(interval);
    };
  }, [onChange]);

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
      />
    </div>
  );
};