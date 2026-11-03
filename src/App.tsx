
import { useState } from "react";
import "./styles/global.css";

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState("Чаты");

  return (
    <div className="app">
      <button
        className="menu-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? "×" : "☰"}
      </button>

      {menuOpen && (
        <>
          <div
            className="overlay"
            onClick={() => setMenuOpen(false)}
          />

          <aside className="sidebar">
            <div className="logo">WhiteMAX</div>

            <nav>
              {["Чаты", "Контакты", "Звонки", "Настройки", "Приватность"].map((item) => (
                <button
                  key={item}
                  className={page === item ? "active" : ""}
                  onClick={() => {
                    setPage(item);
                    setMenuOpen(false);
                  }}
                >
                  {item}
                </button>
              ))}
            </nav>

            <div className="version">
              WhiteMAX Desktop · 0.1.0
            </div>
          </aside>
        </>
      )}

      <main className="content">
        <iframe
          src="https://web.max.ru/"
          title="MAX Web"
          className="max-frame"
        />
      </main>
    </div>
  );
}

export default App;
