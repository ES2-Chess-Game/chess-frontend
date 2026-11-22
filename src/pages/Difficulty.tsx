import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'

export default function Difficulty() {
  const navigate = useNavigate()
  const startGame = (difficulty: 'EASY' | 'MEDIUM' | 'ADVANCED') => {
    navigate(`/game?mode=ai&difficulty=${difficulty}`)
  }

  return (
    <main className="app-shell">
      <Header />
      <div className="menu-container">
        <div className="match-heading" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: '80px' }}>
          <div className="eyebrow" style={{ marginBottom: '16px' }}>INTELIGÊNCIA ARTIFICIAL</div>
          <h1>Nível de Dificuldade</h1>
          <p>Selecione a profundidade de busca do motor Minimax.</p>
        </div>
        
        <div className="menu-options">
          <button className="new-game menu-btn" onClick={() => startGame('EASY')}>
            Fácil — busca de 1 lance
          </button>
          <button className="new-game menu-btn" onClick={() => startGame('MEDIUM')}>
            Médio — busca de 2 lances
          </button>
          <button className="new-game menu-btn" onClick={() => startGame('ADVANCED')}>
            Avançado — busca de 3 lances
          </button>
          
          <button className="new-game menu-btn secondary" onClick={() => navigate('/')}>
            Voltar
          </button>
        </div>
      </div>
    </main>
  )
}