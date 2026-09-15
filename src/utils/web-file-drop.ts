import { type View } from 'react-native';

export function isFileDragEvent(event: DragEvent) {
  const types = Array.from(event.dataTransfer?.types ?? []);
  return types.includes('Files') || (event.dataTransfer?.files?.length ?? 0) > 0;
}

export function filesFromDataTransfer(data: DataTransfer | null): File[] {
  return Array.from(data?.files ?? []);
}

export function getWebHostNode(ref: View | null): HTMLElement | null {
  if (!ref || typeof document === 'undefined') {
    return null;
  }

  const host = ref as unknown as {
    _nativeNode?: HTMLElement;
    getNode?: () => unknown;
  };

  if (host instanceof HTMLElement) {
    return host;
  }

  if (host._nativeNode instanceof HTMLElement) {
    return host._nativeNode;
  }

  const node = host.getNode?.();
  return node instanceof HTMLElement ? node : null;
}

export function isInsideWebNode(ref: View | null, target: EventTarget | null) {
  const node = getWebHostNode(ref);
  return Boolean(node && target instanceof Node && node.contains(target));
}
