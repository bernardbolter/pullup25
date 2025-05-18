'use client';

import { Suspense, useEffect, useRef } from 'react';
import { ARView, ARAnchor } from 'react-three-mind';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const ARViewer = () => {
  const arViewRef = useRef<any>(null);

  useEffect(() => {
    if (arViewRef.current) {
      arViewRef.current.startTracking();
    }
  }, []);

  return (
    <div className="ar-viewer">
      <Suspense fallback={null}>
        <ARView
          ref={arViewRef}
          autoplay
          imageTargets="/targets.mind"
          className="ar-viewer__canvas"
        >
          <ambientLight intensity={.1} />
          <directionalLight color="white" position={[0, 0, 5]} />
            <ARAnchor 
              target={0}
              onAnchorFound={() => {
                console.log('Anchor found');
              }}
              onAnchorLost={() => {
                console.log('Anchor lost');
              }}
              >
              <mesh>
                <planeGeometry args={[1, 1]} />
                <meshStandardMaterial color="hotpink" />
              </mesh>
            </ARAnchor>
            <OrbitControls />
        </ARView>
      </Suspense>
      <div className="ar-viewer__instructions">
        <p>Point your camera at the target image to view the artwork</p>
      </div>
    </div>
  );
};

export default ARViewer; 