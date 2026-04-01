export const metadata = { title: "Badjr-Pay", description: "Invoicing Platform" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
