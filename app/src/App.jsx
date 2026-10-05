import { BrowserRouter, Routes, Route } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import SelectionPage from "./pages/SelectionPage";
import WordgenerationPage from "./pages/WordgenerationPage";
import DeclarationPage from "./pages/DeclarationPage";
import ConfigurationPage from "./pages/ConfigurationPage";

function App() {
  return (
    <BrowserRouter>

      <Routes>

        <Route element={<MainLayout />}>

          <Route
            index
            element={<HomePage />}
          />

          <Route
            path="/selection"
            element={<SelectionPage />}
          />
          
          {/* <Route
            path="/declaration"
            element={<DeclarationPage />}
          /> */}

          {/* <Route
            path="/configuration"
            // element={<ConfigurationPage />}
          /> */}

       

          <Route
            path="/word"
            element={<WordgenerationPage />}
          />

        </Route>

      </Routes>

    </BrowserRouter>
  );
}

export default App;