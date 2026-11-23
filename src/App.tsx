import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './pages/Home'
import Difficulty from './pages/Difficulty'
import LocalSetup from './pages/LocalSetup'
import Game from './pages/Game'
import History from './pages/History'
import './App.css'

function App() {
  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/local" element={<LocalSetup />} />
        <Route path="/difficulty" element={<Difficulty />} />
        <Route path="/game" element={<Game />} />
        <Route path="/historico/:id?" element={<History />} />
      </Routes>
    </>
  )
}

export default App
