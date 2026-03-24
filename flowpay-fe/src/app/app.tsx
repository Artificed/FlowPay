import { BrowserRouter } from "react-router-dom"
import Providers from "./providers"
import RouterRoutes from "./routes"

export default function App() {
  return (
    <BrowserRouter>
      <Providers>
        <RouterRoutes />
      </Providers>
    </BrowserRouter>
  )
}
