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

  // Set up a polling mechanism for content changes
  useEffect(() => {
    const interval = setInterval(() => {
      const instance = editorRef.current?.getInstance();
      if (!instance) return;
      
      const currentContent = instance.getMarkdown() || '';
      if (currentContent !== contentRef.current) {
        contentRef.current = currentContent;
        onChange(currentContent);
      }
    }, 300); // Poll every 300ms
    
    return () => {
      clearInterval(interval);
    };
  }, [onChange]);

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