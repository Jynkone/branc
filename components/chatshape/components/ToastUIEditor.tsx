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

  const handleChange = () => {
    const instance = editorRef.current?.getInstance();
    const content = instance?.getMarkdown() || '';
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
