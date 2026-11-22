import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './pages/Home'
import Difficulty from './pages/Difficulty'
import Game from './pages/Game'
import './App.css'

function App() {
  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/difficulty" element={<Difficulty />} />
        <Route path="/game" element={<Game />} />
      </Routes>
    </>
  )
}

export default App
