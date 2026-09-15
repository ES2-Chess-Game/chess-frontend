import { useEffect, useState } from 'react'
import './App.css'

type Color = 'BRANCA' | 'PRETA'
type PieceType = 'PEAO' | 'TORRE' | 'CAVALO' | 'BISPO' | 'RAINHA' | 'REI'
type GameStatus = 'EM_ANDAMENTO' | 'XEQUE_MATE' | 'EMPATE'
type Piece = { tipo: PieceType; cor: Color }
type Game = { id: string; tabuleiro: (Piece | null)[][]; turnoAtual: Color; status: GameStatus }

const API_URL = 'http://localhost:8080/api/partidas'
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const symbols: Record<Color, Record<PieceType, string>> = {
  BRANCA: { REI: '♔', RAINHA: '♕', TORRE: '♖', BISPO: '♗', CAVALO: '♘', PEAO: '♙' },
  PRETA: { REI: '♚', RAINHA: '♛', TORRE: '♜', BISPO: '♝', CAVALO: '♞', PEAO: '♟' },
}

function App() {
  const [game, setGame] = useState<Game | null>(null)
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const [moves, setMoves] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const createGame = async () => {
    setLoading(true); setError(''); setSelected(null); setMoves([])
    try {
      const response = await fetch(API_URL, { method: 'POST' })
      if (!response.ok) throw new Error('Não foi possível criar a partida.')
      setGame(await response.json())
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Servidor indisponível.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void createGame() }, [])

  const play = async (row: number, col: number) => {
    if (!game || loading || game.status !== 'EM_ANDAMENTO') return
    const piece = game.tabuleiro[row][col]
    if (!selected) {
      if (!piece || piece.cor !== game.turnoAtual) {
        setError(`Selecione uma peça ${game.turnoAtual === 'BRANCA' ? 'branca' : 'preta'} para jogar.`); return
      }
      setError(''); setSelected([row, col]); return
    }
    if (selected[0] === row && selected[1] === col) { setSelected(null); return }
    setLoading(true); setError('')
    try {
      const response = await fetch(`${API_URL}/${game.id}/lances`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origemLinha: selected[0], origemColuna: selected[1], destinoLinha: row, destinoColuna: col }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro ?? 'Movimento inválido.')
      const captured = game.tabuleiro[row][col]
      setGame(data); setMoves((current) => [...current, `${files[selected[1]]}${8 - selected[0]} → ${files[col]}${8 - row}${captured ? ' ×' : ''}`]); setSelected(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível realizar o movimento.'); setSelected(null)
    } finally { setLoading(false) }
  }

  return (
    <main className="app-shell">
      <header className="topbar"><div className="brand-mark">♞</div><div><strong>Clube 64</strong><span>arena de xadrez</span></div><div className="topbar-meta"><span className="live-dot" /> partida local <span className="profile">G8</span></div></header>
      <div className="content-grid">
        <section className="play-area">
          <div className="eyebrow">PARTIDA CASUAL</div>
          <div className="match-heading"><div><h1>Duelo no tabuleiro</h1><p>Concentre-se no próximo movimento.</p></div><button className="new-game" onClick={() => void createGame()} disabled={loading}>↻ <span>Nova partida</span></button></div>
          <div className="board-frame">
            <div className="player-row"><div className="avatar black-avatar">♟</div><div><strong>Adversário</strong><span>Convidado</span></div><div className="clock"><small>PRETAS</small><b>10:00</b></div></div>
            <div className="board-wrap"><div className="rank-labels">{[8, 7, 6, 5, 4, 3, 2, 1].map((rank) => <span key={rank}>{rank}</span>)}</div><div className="board">{game?.tabuleiro.map((row, rowIndex) => row.map((piece, colIndex) => { const isSelected = selected?.[0] === rowIndex && selected?.[1] === colIndex; return <button key={`${rowIndex}-${colIndex}`} className={`square ${(rowIndex + colIndex) % 2 ? 'dark' : 'light'} ${isSelected ? 'selected' : ''}`} onClick={() => void play(rowIndex, colIndex)} aria-label={`${files[colIndex]}${8 - rowIndex}`}>{piece && <span className={`piece ${piece.cor === 'BRANCA' ? 'white-piece' : 'black-piece'}`}>{symbols[piece.cor][piece.tipo]}</span>}</button> })) ?? Array.from({ length: 64 }, (_, index) => <span key={index} className="square" />)}</div></div>
            <div className="file-labels">{files.map((file) => <span key={file}>{file}</span>)}</div>
            <div className="player-row bottom-player"><div className="avatar white-avatar">♙</div><div><strong>Você</strong><span>Jogador local</span></div><div className="clock active-clock"><small>BRANCAS</small><b>10:00</b></div></div>
          </div>
          {error && <div className="error-message">! {error}</div>}
        </section>
        <aside className="side-panel">
          <div className="turn-card"><div className={`turn-indicator ${game?.turnoAtual === 'PRETA' ? 'turn-black' : ''}`} /><div><span>VEZ DE JOGAR</span><strong>{game?.turnoAtual === 'PRETA' ? 'Pretas' : 'Brancas'}</strong></div><div className="status-pill">{game?.status === 'EM_ANDAMENTO' ? 'Ao vivo' : game?.status}</div></div>
          <div className="panel-section"><div className="section-heading"><h2>Movimentos</h2><span>{moves.length}</span></div>{moves.length ? <div className="move-list">{moves.map((move, index) => <div key={`${move}-${index}`}><small>{String(index + 1).padStart(2, '0')}</small><span>{move}</span></div>)}</div> : <div className="empty-state"><span>♜</span><p>O jogo começa quando<br />você fizer o primeiro lance.</p></div>}</div>
          <div className="panel-section info-section"><h2>Como jogar</h2><p>Selecione uma peça da sua cor e depois escolha a casa de destino.</p><div className="legend"><span><i className="legend-square light" /> sua vez</span><span><i className="legend-square dark" /> tabuleiro</span></div></div>
        </aside>
      </div>
    </main>
  )
}

export default App