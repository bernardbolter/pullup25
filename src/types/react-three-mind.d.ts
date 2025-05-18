declare module 'react-three-mind' {
  import { ReactNode, RefObject } from 'react';

  interface ARViewProps {
    ref?: RefObject<any>;
    autoplay?: boolean;
    imageTargets: string;
    className?: string;
    children?: ReactNode;
  }

  interface ARAnchorProps {
    target: number;
    children?: ReactNode;
    onAnchorFound?: () => void;
    onAnchorLost?: () => void;
  }

  export const ARView: React.FC<ARViewProps>;
  export const ARAnchor: React.FC<ARAnchorProps>;
} 