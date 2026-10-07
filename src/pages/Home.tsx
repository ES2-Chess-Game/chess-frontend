import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'

export default function Home() {
  const navigate = useNavigate()

  return (
    <main className="app-shell">
      <Header />
      <div className="menu-container">
        <div className="match-heading" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: '80px' }}>
          <div className="eyebrow" style={{ marginBottom: '16px' }}>NOVA PARTIDA</div>
          <h1>Bem-vindo ao Clube 64</h1>
          <p>Concentre-se e escolha o seu modo de jogo.</p>
        </div>
        
        <div className="menu-options">
          <button className="new-game menu-btn" onClick={() => navigate('/game')}>
            ♙ Jogador vs Jogador (Local)
          </button>
          <button className="new-game menu-btn" onClick={() => navigate('/difficulty')}>
            🤖 Jogador vs Máquina (IA)
          </button>
        </div>
      </div>
    </main>
  )
}