type ActivePhotoViewer = {
  close: () => void;
};

let activeViewer: ActivePhotoViewer | null = null;

export const registerActivePhotoViewer = (viewer: ActivePhotoViewer): void => {
  activeViewer = viewer;
};

export const clearActivePhotoViewer = (viewer?: ActivePhotoViewer): void => {
  if (!viewer || activeViewer === viewer) {
    activeViewer = null;
  }
};

export const closeActivePhotoViewer = (): boolean => {
  if (!activeViewer) {
    return false;
  }

  activeViewer.close();
  return true;
};

export const hasActivePhotoViewer = (): boolean => activeViewer !== null;
