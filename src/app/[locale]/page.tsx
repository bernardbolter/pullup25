import dynamic from 'next/dynamic';

// Dynamically import the AR viewer component to avoid SSR issues
const ARViewer = dynamic(() => import('@/components/ar/ARViewer'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="main__container">
      <section className="main__section">
        <div className="main__header">
          <h1 className="main__title">The Pullup Gallery</h1>
          <p className="main__subtitle">Experience art in augmented reality</p>
        </div>
        <ARViewer />
      </section>
    </div>
  );
}
