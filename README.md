# Darkstone.cat - Board Games & RPG Association

Welcome to the official repository for the **Darkstone Catalunya** website. This project serves as the digital portal for our non-profit association, dedicated to promoting board games, role-playing games (RPGs), and the use of the Catalan language in the hobby.

## About the Project

This website is designed to provide information about who we are, what we do, where to find us, and how to join. It is built with a modern tech stack to ensure performance, accessibility, and an excellent user experience.

### Key Features
- **Modern Landing Page**: Scroll-driven animations, parallax effects, and smooth transitions between themed sections.
- **Multilingual Support**: Fully localized in **Catalan** (default), **Spanish**, and **English**.
- **Interactive Elements**: Smooth scrolling (Lenis), Google Maps integration, organic parallax photo galleries, and dynamic navigation.
- **Scroll-Driven Theme System**: Background and text colors animate automatically as the user scrolls between sections.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com)
- **Animations**: [Motion v12](https://motion.dev) (framer-motion compatible)
- **Smooth Scroll**: [Lenis](https://lenis.darkroom.engineering/)
- **State Management**: [Zustand](https://zustand.docs.pmnd.rs/)
- **Internationalization**: [next-intl](https://next-intl-docs.vercel.app/)
- **Icons**: [React Icons](https://react-icons.github.io/react-icons/) + [Lucide React](https://lucide.dev/)
- **Deployment**: [Vercel](https://vercel.com)

## Project Structure

```
├── src/
│   ├── app/[locale]/    # Next.js App Router pages (localized)
│   ├── components/      # UI components (NavBar, Hero, About, Activities, etc.)
│   ├── hooks/           # Custom hooks (useThemeSection)
│   ├── stores/          # Zustand stores (useThemeStore)
│   ├── lib/             # Utilities (cn)
│   ├── i18n/            # Internationalization configuration
│   ├── messages/        # Translation files (ca.json, es.json, en.json)
│   └── styles/          # Global styles and Tailwind CSS tokens
├── public/images/       # Static assets (logos, photos in .webp)
└── ...
```

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/darkstone-cat.git
   cd darkstone-cat
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
