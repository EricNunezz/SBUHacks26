import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import DiagramBoard from "./components/DiagramBoard.jsx";

// Layout: sidebar on the left, diagram board fills the rest.
// Add more <Route>s here as the app grows.
export default function App() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 h-full">
        <Routes>
          <Route path="/" element={<DiagramBoard />} />
        </Routes>
      </main>
    </div>
  );
}
