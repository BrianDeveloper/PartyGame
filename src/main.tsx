import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CustomQuestionsProvider } from "./state/CustomQuestionsContext";
import { PlayersProvider } from "./state/PlayersContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PlayersProvider>
      <CustomQuestionsProvider>
        <App />
      </CustomQuestionsProvider>
    </PlayersProvider>
  </React.StrictMode>,
);
