# The Pullup Gallery

A global art experience platform that combines traditional art with augmented reality technology. Built with Next.js, TypeScript, and next-intl for internationalization.

## Features

- 🌍 Multi-language support (English, German, French, Spanish, Italian, Dutch)
- 🎨 Artist profiles and portfolios
- 📍 Art location mapping
- 📱 Augmented Reality (AR) art viewing
- 🔍 Search functionality for artists and locations
- 📱 Responsive design for all devices
- 🌐 SEO optimized

## Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** SCSS
- **Internationalization:** [next-intl](https://next-intl-docs.vercel.app/)
- **Maps:** [Mapbox](https://www.mapbox.com/)
- **AR:** [AR.js](https://ar-js-org.github.io/AR.js-Docs/)

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/pullup-gallery.git
cd pullup-gallery
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env.local` file in the root directory and add your environment variables:
```env
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── [locale]/          # Internationalized routes
│   │   ├── about/        # About page
│   │   ├── artists/      # Artists pages
│   │   ├── locations/    # Location pages
│   │   └── layout.tsx    # Locale layout
├── components/            # React components
│   ├── artists/          # Artist-related components
│   ├── locations/        # Location-related components
│   └── layout/           # Layout components
├── i18n/                 # Internationalization
│   └── request.ts        # i18n configuration
├── lib/                  # Utility functions
├── messages/             # Translation files
│   ├── en/              # English translations
│   ├── de/              # German translations
│   └── ...              # Other languages
└── styles/              # Global styles
```

## Internationalization

The project supports multiple languages through next-intl. To add a new language:

1. Create a new directory in `src/messages/` with your language code
2. Add a `common.json` file with translations
3. Add the language code to the locales array in `src/middleware.ts`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [next-intl](https://next-intl-docs.vercel.app/)
- [Mapbox](https://www.mapbox.com/)
- [AR.js](https://ar-js-org.github.io/AR.js-Docs/)
