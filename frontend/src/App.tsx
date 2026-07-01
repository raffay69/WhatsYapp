import { BrowserRouter, Route, Routes } from "react-router";
import "../styles/globals.css"
import Login from "./components/Login";
import RouteGuard from "./components/RouteGuard";
import { Toaster } from "sonner";
import { AuthProvider } from "./hooks/auth";
import { lazy } from "react";

const Chat = lazy(()=> import("./components/Chat"))

export function App() {
  return (
    <>
    <AuthProvider>
      <Toaster/>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login/>} />

          <Route element={<RouteGuard/>}>
            <Route path="/chat" element={<Chat/>} />
          </Route>
        </Routes>

      </BrowserRouter>
    </AuthProvider>
    </>
    )
}

export default App;
