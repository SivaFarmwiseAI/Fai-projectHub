import {
  NotificationProvider,
  NotificationBell,
} from "@enterprise/notification-sdk";

export default function App() {
  return (
    <NotificationProvider
      enable={false}
      applicationId="crm"
      userId="100"
      apiUrl="http://localhost:8000"
      // websocketUrl="ws://localhost:8000/ws"
      theme={{
        mode: "light",
        primaryColor: "#1976d2",
        backgroundColor: "#ffffff",
        textColor: "#1a1a1a",
        borderRadius: "12px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          background: "#f5f7fa",
          margin: 0,
        }}
      >
        <header
          style={{
            background: "#1976d2",
            color: "#fff",
            padding: "0 24px",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "18px" }}>
            Enterprise Admin
          </span>
          <NotificationBell />
        </header>

        <main style={{ padding: "32px 24px" }}>
          <h2 style={{ margin: "0 0 8px", color: "#1a1a1a" }}>Dashboard</h2>
          <p style={{ color: "#666", margin: 0 }}>
            Click the 🔔 bell in the header to view your notifications.
          </p>
        </main>
      </div>
    </NotificationProvider>
  );
}
