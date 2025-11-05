// frontend/src/App.jsx
import Navbar from "./components/NavBa"
import { Outlet } from "react-router-dom"
export default function App() {
  return (
    <div>
      <Navbar />
      <Outlet />
      
    </div>
  )
}