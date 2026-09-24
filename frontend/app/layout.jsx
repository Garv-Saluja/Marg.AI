export const metadata = {
  title: "Marg.ai",
  description: "Personalized learning paths powered by knowledge graphs",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#f7f7fb" }}>
        {children}
      </body>
    </html>
  );
}
