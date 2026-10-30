import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CustomGameContentProvider } from "./state/CustomGameContentContext";
import { CustomQuestionsProvider } from "./state/CustomQuestionsContext";
import { PlayersProvider } from "./state/PlayersContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PlayersProvider>
      <CustomQuestionsProvider>
        <CustomGameContentProvider>
          <App />
        </CustomGameContentProvider>
      </CustomQuestionsProvider>
    </PlayersProvider>
  </React.StrictMode>,
);
