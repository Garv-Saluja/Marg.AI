import "./globals.css";

export const metadata = {
  title: "Marg.ai",
  description: "Personalized learning paths powered by knowledge graphs",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}