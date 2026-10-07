import { useNavigate } from 'react-router-dom'
import Header from '../components/header'

export default function Difficulty() {
  const navigate = useNavigate()

  return (
    <main className="app-shell">
      <Header />
      <div className="menu-container">
        <div className="match-heading" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: '80px' }}>
          <div className="eyebrow" style={{ marginBottom: '16px' }}>INTELIGÊNCIA ARTIFICIAL</div>
          <h1>Nível de Dificuldade</h1>
          <p>Selecione a força de cálculo do motor Min-Max.</p>
        </div>
        
        <div className="menu-options">
          <button className="new-game menu-btn" onClick={() => navigate('/game?mode=ai&level=1')}>
            Nível 1 (Básico)
          </button>
          <button className="new-game menu-btn" disabled title="Em desenvolvimento pela equipe de Backend">
            Nível 2 (Intermediário) — Em breve
          </button>
          <button className="new-game menu-btn" disabled title="Em desenvolvimento pela equipe de Backend">
            Nível 3 (Avançado) — Em breve
          </button>
          
          <button className="new-game menu-btn secondary" onClick={() => navigate('/')}>
            Voltar
          </button>
        </div>
      </div>
    </main>
  )
}