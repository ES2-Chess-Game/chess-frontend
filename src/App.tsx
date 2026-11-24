import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './pages/Home'
import Difficulty from './pages/Difficulty'
import LocalSetup from './pages/LocalSetup'
import Game from './pages/Game'
import History from './pages/History'
import AccountPage from './pages/Account'
import Ranking from './pages/Ranking'
import RequireAccount from './components/RequireAccount'
import { readSession, type Session } from './account'
import './App.css'

function App() {
  const [session, setSession] = useState<Session>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    void readSession(controller.signal).then(current => {
      if (!controller.signal.aborted) setSession(current)
    })
    return () => controller.abort()
  }, [])

  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <Header session={session} />
      <Routes>
        <Route path="/" element={<Home signedIn={session.status === 'signed-in'} />} />
        <Route path="/ranking" element={<Ranking currentUser={session.status === 'signed-in' ? session.account.username : undefined} />} />
        <Route element={<RequireAccount session={session} />}>
          <Route path="/local" element={<LocalSetup />} />
          <Route path="/difficulty" element={<Difficulty />} />
          <Route path="/game" element={<Game />} />
          <Route path="/historico/:id?" element={<History />} />
        </Route>
        <Route path="/conta" element={<AccountPage session={session} onChange={setSession} />} />
      </Routes>
    </>
  )
}

export default App
