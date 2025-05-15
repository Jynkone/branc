// components/canvas/SyncedTldrawCanvas.tsx
'use client';

import { useEffect, useState, ReactNode, useMemo } from 'react';
import { useSync } from '@tldraw/sync';
import { TLStoreWithStatus, Editor, defaultShapeUtils } from 'tldraw';
import { multiplayerAssetStore } from '@/lib/multiplayerAssetStore';
import { getCustomShapeUtils } from './Canvas'; // re-exported by Canvas.tsx
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface Props {
  syncUri: string;
  initialCurrentRoomName: string;
  initialCurrentRoomId: string;
  editorInstance: Editor | null;
  onEditorMount: (e: Editor) => void;
  children: (
    store: TLStoreWithStatus,
    editor: Editor | null,
    onEditorMount: (e: Editor) => void
  ) => ReactNode;
}

export function SyncedTldrawCanvas({
  syncUri,
  initialCurrentRoomName,
  initialCurrentRoomId,
  editorInstance,
  onEditorMount,
  children,
}: Props) {
  /* -------------------------------------------------------------- */
  /* 1.  Compose shape utils (defaults + any project-specific)      */
  /* -------------------------------------------------------------- */
  const shapeUtils = useMemo(
    () => [...defaultShapeUtils, ...getCustomShapeUtils()],
    []
  );

  /* -------------------------------------------------------------- */
  /* 2.  Connect to Yjs / backend                                   */
  /* -------------------------------------------------------------- */
  const store = useSync({
    uri: syncUri,
    shapeUtils,
    assets: multiplayerAssetStore,
  });

  /* simple retry */
  const [retries, setRetries] = useState(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    if (store.status === 'error' && retries < MAX_RETRIES) {
      const t = setTimeout(() => setRetries((n) => n + 1), 1500 * (retries + 1));
      return () => clearTimeout(t);
    }
  }, [store.status, retries]);

  if (store.status === 'error' && retries >= MAX_RETRIES) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Couldn’t join space</AlertTitle>
          <AlertDescription>
            Failed to connect to “{initialCurrentRoomName}” ({initialCurrentRoomId}).
          </AlertDescription>
          <Button className="mt-4" onClick={() => location.reload()}>
            Reload
          </Button>
        </Alert>
      </div>
    );
  }

  return <>{children(store, editorInstance, onEditorMount)}</>;
}
